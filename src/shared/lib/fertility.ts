/**
 * src/shared/lib/fertility.ts
 * 备孕基础体温（BBT）分析（v0.5）
 *
 * 纯本地、非诊断：基于基础体温的"持续性升温"推测排卵日（标准 BBT 法）。
 * 算法透明、可测试，仅供参考——受睡眠、作息、疾病影响，不可作为避孕依据。
 */

import { parseISO, format } from 'date-fns';
import type { DailyLog } from '../db/client';

export interface BBTShift {
  /** 推测排卵升温起始日（体温开始持续高于基线的那天） */
  date: string;
  /** 升温幅度（℃）：当日体温 − 前 6 天基线均值 */
  shiftFrom: number;
}

/**
 * 基于 BBT 检测排卵升温日。
 *
 * 规则（简化、确定、易测）：
 * - 取按日期排序、含 bbt 的读数；
 * - 对每个候选日 i（需有 ≥6 个前置读数、且其后 ≥2 天也有读数）：
 *   基线 = 前 6 天 bbt 均值；
 *   若 bbt[i] ≥ 基线 + 0.2℃ 且其后连续 2 天均 ≥ 基线 + 0.15℃，视为"持续升温"，
 *   该日即排卵后体温上升的起始日（排卵通常发生在升温前 1–2 天）。
 * - 返回第一个满足条件的日期。
 *
 * 读数不足（< 8 条）时返回 null。
 */
export function detectOvulationFromBBT(logs: DailyLog[]): BBTShift | null {
  const readings = logs
    .filter((l) => typeof l.bbt === 'number' && l.bbt >= 34 && l.bbt <= 40)
    .map((l) => ({ date: l.date, bbt: l.bbt as number }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (readings.length < 8) return null;

  for (let i = 6; i <= readings.length - 3; i++) {
    const baseline =
      readings.slice(i - 6, i).reduce((s, r) => s + r.bbt, 0) / 6;
    const cur = readings[i].bbt;
    if (cur < baseline + 0.2) continue;
    const next1 = readings[i + 1].bbt;
    const next2 = readings[i + 2].bbt;
    if (next1 >= baseline + 0.15 && next2 >= baseline + 0.15) {
      return { date: readings[i].date, shiftFrom: +(cur - baseline).toFixed(2) };
    }
  }
  return null;
}

export interface BBTPoint {
  date: string;
  label: string;
  bbt: number;
}

/**
 * 构建 BBT 折线图数据（按日期升序）。
 */
export function buildBBTSeries(logs: DailyLog[]): BBTPoint[] {
  return logs
    .filter((l) => typeof l.bbt === 'number' && l.bbt >= 34 && l.bbt <= 40)
    .map((l) => {
      const d = parseISO(l.date);
      return {
        date: l.date,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        bbt: +(l.bbt as number).toFixed(2),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 便捷：同时返回序列与推测排卵日，供图表组件使用 */
export function buildBBTChart(logs: DailyLog[]): {
  points: BBTPoint[];
  ovulationDate: string | null;
} {
  const points = buildBBTSeries(logs);
  const shift = detectOvulationFromBBT(logs);
  // 升温起始日作为"推测排卵后升温"标记（排卵约在其前 1 天）
  return { points, ovulationDate: shift?.date ?? null };
}

/** 日期格式化（yyyy-MM-dd）兜底 */
export function fmtDate(d: string): string {
  return format(parseISO(d), 'yyyy-MM-dd');
}
