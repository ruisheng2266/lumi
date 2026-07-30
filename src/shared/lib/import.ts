/**
 * src/shared/lib/import.ts
 * 竞品数据导入解析（v0.4）
 *
 * 目标：让用户从 Flo / Clue / 经期助手 等竞品导出的文件迁移到 Lumi。
 * 提供两类解析：
 *   1. parseLumiJSON —— Lumi 自有导出格式（与 Settings.handleExport 对称）回灌
 *   2. parseGenericCSV —— 通用 CSV，靠列名同义词字典启发式识别，覆盖 Flo/Clue/经期助手 等常见导出
 *
 * 设计原则（见 ROADMAP v0.4）：导入是「获客钩子」，必须零门槛、非破坏（合并而非覆盖）。
 */

import type { Period, DailyLog, UserProfile } from '../db/client';

export type ImportFormat = 'lumi-json' | 'generic-csv' | 'unknown';

/** 解析后的标准化结构（不含 id/时间戳，由入库时补齐） */
export interface ImportPreview {
  format: ImportFormat;
  periods: Array<Omit<Period, 'id' | 'createdAt' | 'updatedAt'>>;
  dailyLogs: Array<Omit<DailyLog, 'id' | 'createdAt' | 'updatedAt'>>;
  profile?: Partial<UserProfile>;
  /** 解析过程中的提示/告警（未匹配列、跳过的行、无法识别的日期等） */
  warnings: string[];
  rowCount: number;
}

// ────────────────────────────────────────────────────────────
// 通用工具
// ────────────────────────────────────────────────────────────

/** 归一化表头：小写、去除空白与常见标点，保留中日韩字符便于中文匹配 */
function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s,.\·/()\-_：:，。、]/g, '');
}

/** 归一化单元格文本（用于症状/枚举匹配） */
function normalizeCell(s: string): string {
  return s.trim().toLowerCase();
}

const isBlank = (s?: string) => !s || s.trim() === '';

// ────────────────────────────────────────────────────────────
// 日期解析：兼容 YYYY-MM-DD / YYYY/MM/DD / MM/DD/YYYY / DD/MM/YYYY / YYYY年M月D日
// ────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function parseDate(raw?: string): string | null {
  if (isBlank(raw)) return null;
  const s = raw!.trim();

  // YYYY年M月D日 / YYYY年M月
  const cn = s.match(/^(\d{4})年(\d{1,2})月(?:(\d{1,2})日?)?$/);
  if (cn) {
    const y = +cn[1];
    const m = +cn[2];
    const d = cn[3] ? +cn[3] : 1;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  // 含分隔符的数字组
  const parts = s.split(/[-/]/).map((p) => p.trim());
  if (parts.length === 3 && parts.every((p) => /^\d{1,4}$/.test(p))) {
    let y: number, m: number, d: number;
    if (parts[0].length === 4) {
      // ISO: Y-M-D
      [y, m, d] = [+parts[0], +parts[1], +parts[2]];
    } else if (parts[2].length === 4) {
      // 末尾为年份：先按 M/D/Y，若首段>12 则视为 D/M/Y
      const a = +parts[0];
      const b = +parts[1];
      if (a > 12 && b <= 12) {
        [d, m, y] = [a, b, +parts[2]];
      } else {
        [m, d, y] = [a, b, +parts[2]];
      }
    } else {
      return null;
    }
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
    return null;
  }

  // 最后兜底：交给 JS Date（依赖运行环境，仅作为容错）
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const dt = new Date(t);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// 枚举映射：流量 / 心情精力 / 症状
// ────────────────────────────────────────────────────────────

export function mapFlow(raw?: string): Period['flow'] {
  if (isBlank(raw)) return undefined;
  const s = normalizeCell(raw!);
  if (/(light|spotting|少|淡|轻|微量|trace|low)/.test(s)) return 'light';
  if (/(heavy|多|重|大量|血块|high)/.test(s)) return 'heavy';
  return 'medium';
}

/** 文本 → 1~5 评分；数字直接用，描述词做轻量映射 */
function mapRating(raw?: string): 1 | 2 | 3 | 4 | 5 | undefined {
  if (isBlank(raw)) return undefined;
  const s = normalizeCell(raw!);
  const num = Number(s);
  if (Number.isInteger(num) && num >= 1 && num <= 5) return num as 1 | 2 | 3 | 4 | 5;
  // 描述词（心情/精力通用）
  if (/(great|good|happy|calm|excellent|开心|高兴|愉快|好|棒|轻松|精力充沛|活力)/.test(s)) return 5;
  if (/(fine|ok|okay|content|还行|一般|普通|尚可|正常)/.test(s)) return 3;
  if (/(bad|sad|down|low|anxious|angry|tired|depressed|难过|低落|焦虑|烦躁|生气|累|疲惫|无力)/.test(s)) return 2;
  return undefined;
}

/** 症状名同义词 → Lumi symptom id（双语） */
const SYMPTOM_SYNONYMS: Record<string, string> = {
  // cramps
  cramps: 'cramps', cramp: 'cramps', dysmenorrhea: 'cramps',
  经痛: 'cramps', 痛经: 'cramps', 肚子痛: 'cramps', 腹痛: 'cramps', 下腹疼痛: 'cramps',
  // headache
  headache: 'headache', head: 'headache',
  头痛: 'headache', 头疼: 'headache',
  // bloating
  bloating: 'bloating', bloat: 'bloating',
  腹胀: 'bloating', 胀气: 'bloating',
  // discharge
  discharge: 'discharge',
  白带: 'discharge', 分泌物: 'discharge', 白带变化: 'discharge',
  // breast
  breast: 'breast', 'breasttenderness': 'breast', 'sorebreasts': 'breast', 'tenderbreasts': 'breast',
  乳房胀痛: 'breast', 胸胀: 'breast', 乳房: 'breast', 乳腺: 'breast',
  // nausea
  nausea: 'nausea', nauseous: 'nausea',
  恶心: 'nausea', 想吐: 'nausea', 反胃: 'nausea', 孕吐: 'nausea',
  // appetite
  appetite: 'appetite', cravings: 'appetite', craving: 'appetite',
  食欲变化: 'appetite', 食欲: 'appetite', 胃口: 'appetite', 嘴馋: 'appetite',
  // fever
  fever: 'fever',
  发热: 'fever', 发烧: 'fever',
  // sleepy
  fatigue: 'sleepy', tired: 'sleepy', sleepy: 'sleepy', lethargy: 'sleepy',
  嗜睡: 'sleepy', 疲倦: 'sleepy', 乏力: 'sleepy', 疲劳: 'sleepy', 累: 'sleepy',
  // insomnia
  insomnia: 'insomnia', sleepless: 'insomnia',
  失眠: 'insomnia', 睡不着: 'insomnia',
  // acne
  acne: 'acne', pimples: 'acne', pimple: 'acne', breakout: 'acne',
  痤疮: 'acne', 痘痘: 'acne', 爆痘: 'acne',
  // constipated
  constipation: 'constipated', constipated: 'constipated',
  便秘: 'constipated',
  // diarrhea
  diarrhea: 'diarrhea', diarrhoea: 'diarrhea', 'loosestool': 'diarrhea',
  腹泻: 'diarrhea', 拉肚子: 'diarrhea',
};

export function mapSymptoms(raw?: string): string[] | undefined {
  if (isBlank(raw)) return undefined;
  const tokens = raw!
    .split(/[,;、/，；]/)
    .map((t) => normalizeCell(t))
    .filter(Boolean);
  const ids = new Set<string>();
  for (const tok of tokens) {
    const id = SYMPTOM_SYNONYMS[tok];
    if (id) ids.add(id);
  }
  return ids.size ? Array.from(ids) : undefined;
}

// ────────────────────────────────────────────────────────────
// CSV 解析（支持引号包裹、字段内逗号/换行）
// ────────────────────────────────────────────────────────────

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // 收尾
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 丢弃完全空白的行
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ────────────────────────────────────────────────────────────
// 列名同义词 → 字段
// ────────────────────────────────────────────────────────────

const COLUMN_SYNONYMS: Record<string, string[]> = {
  date: ['date', 'day', '日期', '记录日期', '记录日', '当天', '日志日期', '记录时间'],
  start: ['periodstart', 'startdate', 'periodstartdate', 'menstruationstart', '月经开始', '经期开始', '开始日期', '月经第一天', '经期第一天', '出血开始', 'mensesstart'],
  end: ['periodend', 'enddate', 'periodenddate', 'menstruationend', '月经结束', '经期结束', '结束日期', '出血结束', 'mensesend'],
  flow: ['flow', 'intensity', 'periodintensity', '流量', '经量', '出血量', '出血程度', 'flowintensity'],
  mood: ['mood', '情绪', '心情', '情感', 'feeling'],
  energy: ['energy', '精力', '活力', '能量', 'energylevel'],
  sleep: ['sleep', 'sleephours', 'sleepduration', '睡眠', '睡眠时长', '睡眠时间', '睡觉', 'sleepinghours'],
  notes: ['notes', 'note', '备注', '备注症状', '症状备注', '评论', 'comment', 'description', '描述', '笔记', 'memo'],
  symptoms: ['symptoms', 'symptom', '症状', '症状记录', 'tag', 'tags', '标记', 'signs'],
};

type FieldKey = keyof typeof COLUMN_SYNONYMS;

function buildColumnMap(headers: string[]): Record<FieldKey, number> {
  const map = {} as Record<FieldKey, number>;
  const norm = headers.map(normalizeHeader);
  (Object.keys(COLUMN_SYNONYMS) as FieldKey[]).forEach((field) => {
    const syns = COLUMN_SYNONYMS[field];
    const idx = norm.findIndex((h) => syns.includes(h));
    if (idx >= 0) map[field] = idx;
  });
  return map;
}

// ────────────────────────────────────────────────────────────
// 通用 CSV 解析 → ImportPreview
// ────────────────────────────────────────────────────────────

export function parseGenericCSV(text: string): ImportPreview {
  const warnings: string[] = [];
  const rows = parseCSV(text);

  if (rows.length < 2) {
    return { format: 'generic-csv', periods: [], dailyLogs: [], warnings: ['文件没有可解析的数据行'], rowCount: 0 };
  }

  const colMap = buildColumnMap(rows[0]);
  const headers = rows[0];
  const unmapped = headers
    .filter((_, idx) => !Object.values(colMap).includes(idx))
    .filter((h) => h.trim() !== '');
  if (unmapped.length) {
    warnings.push(`以下列未识别，已忽略：${unmapped.join('、')}`);
  }
  if (colMap.date === undefined && colMap.start === undefined) {
    warnings.push('未找到日期/经期开始列，无法导入');
    return { format: 'generic-csv', periods: [], dailyLogs: [], warnings, rowCount: 0 };
  }

  const periods: ImportPreview['periods'] = [];
  const dailyLogs: ImportPreview['dailyLogs'] = [];
  let rowCount = 0;
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    // 主日期：优先 start（经期开始），否则 date
    const primaryDate = parseDate(cells[colMap.start]) ?? parseDate(cells[colMap.date]);
    if (!primaryDate) {
      skipped++;
      continue;
    }
    rowCount++;

    // 周期记录：仅当该天确实含经期信号（有开始日/结束日/流量）才创建，避免把普通日志误判为周期
    const startDateVal = colMap.start !== undefined ? parseDate(cells[colMap.start]) : undefined;
    const endDateVal = colMap.end !== undefined ? parseDate(cells[colMap.end]) : undefined;
    const flowVal = mapFlow(cells[colMap.flow]);
    if (startDateVal || endDateVal || flowVal) {
      periods.push({
        startDate: startDateVal ?? endDateVal ?? primaryDate,
        endDate: endDateVal ?? undefined,
        flow: flowVal,
        notes: isBlank(cells[colMap.notes]) ? undefined : cells[colMap.notes].trim(),
      });
    }

    // 每日日志：只要该日期有任一维度就建一条
    const mood = mapRating(cells[colMap.mood]);
    const energy = mapRating(cells[colMap.energy]);
    const sleepRaw = isBlank(cells[colMap.sleep]) ? undefined : Number(cells[colMap.sleep]);
    const sleepHours = sleepRaw !== undefined && !Number.isNaN(sleepRaw) ? sleepRaw : undefined;
    const symptoms = mapSymptoms(cells[colMap.symptoms]);
    const notes = isBlank(cells[colMap.notes]) ? undefined : cells[colMap.notes].trim();

    if (mood || energy || sleepHours || symptoms || notes) {
      dailyLogs.push({ date: primaryDate, mood, energy, sleepHours, symptoms, notes });
    }
  }

  if (skipped > 0) warnings.push(`跳过 ${skipped} 行（缺少可识别的日期）`);

  return { format: 'generic-csv', periods, dailyLogs, warnings, rowCount };
}

// ────────────────────────────────────────────────────────────
// Lumi 自有 JSON 导出回灌
// ────────────────────────────────────────────────────────────

export function parseLumiJSON(text: string): ImportPreview {
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { format: 'unknown', periods: [], dailyLogs: [], warnings: ['不是合法的 JSON 文件'], rowCount: 0 };
  }
  const obj = data as Record<string, any>;
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.periods) || !Array.isArray(obj.dailyLogs)) {
    warnings.push('JSON 缺少 periods / dailyLogs 字段，可能不是 Lumi 备份文件');
    return { format: 'unknown', periods: [], dailyLogs: [], warnings, rowCount: 0 };
  }

  const periods: ImportPreview['periods'] = [];
  const dailyLogs: ImportPreview['dailyLogs'] = [];
  let rowCount = 0;

  for (const p of obj.periods) {
    const startDate = parseDate(p?.startDate);
    if (!startDate) continue;
    periods.push({
      startDate,
      endDate: parseDate(p?.endDate) ?? undefined,
      flow: p?.flow,
      notes: typeof p?.notes === 'string' ? p.notes : undefined,
    });
    rowCount++;
  }
  for (const l of obj.dailyLogs) {
    const date = parseDate(l?.date);
    if (!date) continue;
    dailyLogs.push({
      date,
      mood: l?.mood,
      energy: l?.energy,
      sleepHours: typeof l?.sleepHours === 'number' ? l.sleepHours : undefined,
      symptoms: Array.isArray(l?.symptoms) ? l.symptoms.filter((s: unknown) => typeof s === 'string') : undefined,
      notes: typeof l?.notes === 'string' ? l.notes : undefined,
    });
    rowCount++;
  }

  const profile = obj.profile as Partial<UserProfile> | undefined;

  return {
    format: 'lumi-json',
    periods,
    dailyLogs,
    profile: profile ? { avgCycleLen: profile.avgCycleLen, avgPeriodLen: profile.avgPeriodLen, displayName: profile.displayName } : undefined,
    warnings,
    rowCount,
  };
}

// ────────────────────────────────────────────────────────────
// 格式探测 + 分发
// ────────────────────────────────────────────────────────────

export function detectAndParse(text: string, filename?: string): ImportPreview {
  const trimmed = text.trim();
  // JSON 优先：以 { 开头，或文件名以 .json 结尾
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || filename?.toLowerCase().endsWith('.json')) {
    // 若 JSON 解析失败，再退回 CSV 尝试
    const jsonResult = parseLumiJSON(text);
    if (jsonResult.format !== 'unknown' || jsonResult.warnings.some((w) => w.includes('不是合法'))) {
      if (jsonResult.format === 'lumi-json' || jsonResult.warnings.length === 0) return jsonResult;
    }
  }
  if (trimmed.includes(',') || filename?.toLowerCase().endsWith('.csv')) {
    return parseGenericCSV(text);
  }
  return { format: 'unknown', periods: [], dailyLogs: [], warnings: ['无法识别文件格式，请使用 Lumi 导出的 JSON 或竞品的 CSV'], rowCount: 0 };
}
