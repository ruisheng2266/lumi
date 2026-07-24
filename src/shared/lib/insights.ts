/**
 * src/shared/lib/insights.ts
 * AI 洞察引擎（PRD §6.4）—— 纯本地规则引擎，零网络请求
 */

import { differenceInDays, parseISO, startOfDay, format } from 'date-fns';
import {
  avgCycleLen,
  cycleRegularity,
  predictCycle,
  phaseOf,
  type Phase,
  type PeriodRecord,
  type CyclePrediction,
} from './predict';
import type { DailyLog } from '../db/client';

export type InsightCategory =
  | 'regularity'
  | 'pms'
  | 'energy_phase'
  | 'sleep_mood'
  | 'today'
  | 'anomaly';

export type InsightSeverity = 'info' | 'gentle' | 'important';

export interface Insight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  data: string;
  interpretation: string;
  suggestion: string;
  emoji?: string;
}

interface InsightContext {
  periods: PeriodRecord[];
  logs: DailyLog[];
  prediction: CyclePrediction;
  today: Date;
  userAvgCycle?: number;
  userAvgPeriod?: number;
}

/**
 * 主入口：生成所有洞察（按优先级排序）
 */
export function generateInsights(ctx: InsightContext): Insight[] {
  const insights: Insight[] = [];

  const r1 = cycleRegularityInsight(ctx.periods);
  if (r1) insights.push(r1);

  const r2 = pmsPatternInsight(ctx);
  if (r2) insights.push(r2);

  const r3 = energyPhaseInsight(ctx);
  if (r3) insights.push(r3);

  const r4 = sleepMoodInsight(ctx.logs);
  if (r4) insights.push(r4);

  const r5 = todayTipInsight(ctx);
  if (r5) insights.push(r5);

  const r6 = anomalyInsight(ctx);
  if (r6) insights.push(r6);

  return insights.sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
}

function severityRank(s: InsightSeverity): number {
  return { info: 1, gentle: 2, important: 3 }[s];
}

/**
 * 1. 周期规律性洞察
 */
function cycleRegularityInsight(periods: PeriodRecord[]): Insight | null {
  if (periods.length < 2) return null;

  const regularity = cycleRegularity(periods);
  const avg = avgCycleLen(periods);

  if (regularity === 'good') {
    return {
      id: 'regularity-good',
      category: 'regularity',
      severity: 'info',
      emoji: '✨',
      title: '周期规律性良好',
      data: `平均 ${avg} 天，波动 < 2 天`,
      interpretation: '你的月经周期非常稳定，这是健康的信号。',
      suggestion: '继续保持规律作息，这对预测准确性很有帮助。',
    };
  }

  if (regularity === 'ok') {
    return {
      id: 'regularity-ok',
      category: 'regularity',
      severity: 'info',
      emoji: '🌿',
      title: '周期波动在可接受范围',
      data: `平均 ${avg} 天，波动 2~4 天`,
      interpretation: '多数女性的周期都会有小幅波动，这很正常。',
      suggestion: '留意波动规律，比如是否与季节、压力或旅行相关。',
    };
  }

  if (regularity === 'irregular') {
    return {
      id: 'regularity-irregular',
      category: 'regularity',
      severity: 'gentle',
      emoji: '🍃',
      title: '近期周期波动较大',
      data: `波动 > 4 天`,
      interpretation: '周期不稳定可能与压力、作息、饮食变化有关，也可能反映激素波动。',
      suggestion: '建议记录睡眠和情绪，这有助于发现规律；如果持续不规律，可考虑就医。',
    };
  }

  return null;
}

/**
 * 2. PMS 模式洞察（经前综合征）
 *
 * 比较"经前 7 天"与"其他时间"的症状频率
 */
function pmsPatternInsight(ctx: InsightContext): Insight | null {
  const { periods, logs } = ctx;
  if (periods.length < 2 || logs.length < 6) return null;

  // 对每个 period，找出"经前 7 天"和"卵泡期"（经期后 ~14 天）的日志
  const sortedPeriods = [...periods].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  // 统计每个症状在不同阶段的频率
  const symptomPhaseCount: Record<string, { pms: number; other: number }> = {};

  for (let i = 1; i < sortedPeriods.length; i++) {
    const currentStart = parseISO(sortedPeriods[i].startDate);
    const previousStart = parseISO(sortedPeriods[i - 1].startDate);
    const pmsWindowStart = new Date(currentStart);
    pmsWindowStart.setDate(pmsWindowStart.getDate() - 7);
    const pmsWindowEnd = new Date(currentStart);
    pmsWindowEnd.setDate(pmsWindowEnd.getDate() - 1);

    for (const log of logs) {
      const logDate = parseISO(log.date);
      if (!log.symptoms || log.symptoms.length === 0) continue;
      // 只考虑上一个周期内的日志（previousStart <= logDate < currentStart）
      if (
        logDate.getTime() < previousStart.getTime() ||
        logDate.getTime() >= currentStart.getTime()
      ) {
        continue;
      }
      const inPms =
        logDate.getTime() >= pmsWindowStart.getTime() &&
        logDate.getTime() <= pmsWindowEnd.getTime();

      for (const symptom of log.symptoms) {
        if (!symptomPhaseCount[symptom]) {
          symptomPhaseCount[symptom] = { pms: 0, other: 0 };
        }
        if (inPms) symptomPhaseCount[symptom].pms += 1;
        else symptomPhaseCount[symptom].other += 1;
      }
    }
  }

  // 找 PMS 期显著高于其他期的症状（>= 2 倍频率）
  const pmsSymptoms = Object.entries(symptomPhaseCount)
    .filter(([, counts]) => {
      const total = counts.pms + counts.other;
      if (total < 2) return false;
      // PMS 出现 >= 2 次 且 (other = 0 或 PMS 占比 >= 50%)
      if (counts.pms < 2) return false;
      if (counts.other === 0) return true;
      return counts.pms >= counts.other;
    })
    .map(([symptom]) => symptom);

  if (pmsSymptoms.length === 0) return null;

  // 取最显著的 3 个
  const top3 = pmsSymptoms.slice(0, 3);
  return {
    id: 'pms-pattern',
    category: 'pms',
    severity: 'gentle',
    emoji: '🌸',
    title: '发现 PMS 模式',
    data: `经前 7 天最常出现：${top3.join('、')}`,
    interpretation: '这些症状在经前期明显更频繁，可能是经前综合征的表现。',
    suggestion: '记下出现的时间和强度，未来可以提前准备（如备好止痛药、调整日程）。',
  };
}

/**
 * 3. 精力-阶段关联
 */
function energyPhaseInsight(ctx: InsightContext): Insight | null {
  const { periods, logs, prediction } = ctx;
  if (periods.length < 2 || logs.length < 14 || !prediction.avgCycleLen) return null;

  // 计算每个阶段的平均精力
  const phaseEnergy: Record<Phase, number[]> = {
    menstrual: [],
    follicular: [],
    ovulation: [],
    luteal: [],
  };

  // 对每个日志，判断它在哪个阶段
  for (const log of logs) {
    if (log.energy === undefined) continue;
    // 找到该日期所在周期的"开始日"
    const logDate = parseISO(log.date);
    const cycleStart = findCycleStart(logDate, periods);
    if (!cycleStart) continue;
    const dayInCycle = differenceInDays(logDate, cycleStart) + 1;
    const phase = phaseOf(dayInCycle, prediction.avgCycleLen);
    phaseEnergy[phase].push(log.energy);
  }

  const phaseAvgs: Record<Phase, number | null> = {
    menstrual: avgOrNull(phaseEnergy.menstrual),
    follicular: avgOrNull(phaseEnergy.follicular),
    ovulation: avgOrNull(phaseEnergy.ovulation),
    luteal: avgOrNull(phaseEnergy.luteal),
  };

  const peak = (['menstrual', 'follicular', 'ovulation', 'luteal'] as Phase[])
    .filter((p) => phaseAvgs[p] !== null)
    .reduce<{ phase: Phase; avg: number } | null>(
      (best, p) => {
        const v = phaseAvgs[p]!;
        if (!best || v > best.avg) return { phase: p, avg: v };
        return best;
      },
      null,
    );

  if (!peak) return null;
  if (peak.avg < 3) return null; // 数据无显著峰值

  const phaseName = { menstrual: '经期', follicular: '卵泡期', ovulation: '排卵期', luteal: '黄体期' }[peak.phase];

  return {
    id: 'energy-phase',
    category: 'energy_phase',
    severity: 'info',
    emoji: '⚡',
    title: '精力随周期的变化',
    data: `${phaseName}平均精力 ${peak.avg.toFixed(1)}/5`,
    interpretation: `你在${phaseName}的精力水平最高，这符合大多数女性的激素周期规律。`,
    suggestion: `${phaseName}适合安排需要专注和创造力的工作；其他阶段注意休息。`,
  };
}

/**
 * 4. 睡眠-情绪关联
 */
function sleepMoodInsight(logs: DailyLog[]): Insight | null {
  if (logs.length < 7) return null;

  // 按睡眠时长分两组
  const short: number[] = []; // < 6h
  const long: number[] = [];  // >= 7h

  for (const log of logs) {
    if (log.mood === undefined) continue;
    if (log.sleepHours === undefined) continue;
    if (log.sleepHours < 6) short.push(log.mood);
    else if (log.sleepHours >= 7) long.push(log.mood);
  }

  if (short.length < 3 || long.length < 3) return null;

  const shortAvg = avgOrNull(short);
  const longAvg = avgOrNull(long);
  if (shortAvg === null || longAvg === null) return null;

  const diff = longAvg - shortAvg;
  if (Math.abs(diff) < 0.5) return null;

  return {
    id: 'sleep-mood',
    category: 'sleep_mood',
    severity: diff > 1 ? 'gentle' : 'info',
    emoji: '🌙',
    title: '睡眠影响情绪',
    data: `睡眠 < 6h：情绪 ${shortAvg.toFixed(1)}/5，睡眠 ≥ 7h：${longAvg.toFixed(1)}/5`,
    interpretation: `充足睡眠的日子里情绪明显更好（差异 ${diff.toFixed(1)} 分）。`,
    suggestion: '尽量保证 7 小时以上睡眠，对情绪稳定很关键。',
  };
}

/**
 * 5. 今日提醒（基于当前阶段）
 */
function todayTipInsight(ctx: InsightContext): Insight | null {
  const { prediction, today, logs } = ctx;
  if (!prediction.currentPhase) return null;

  const phase = prediction.currentPhase;
  const day = prediction.currentDayInCycle!;

  // 查找该日期的日志，识别今日已记录的症状
  const todayISO = format(today, 'yyyy-MM-dd');
  const todayLog = logs.find((l) => l.date === todayISO);

  const baseTips: Record<Phase, { title: string; suggestion: string }> = {
    menstrual: {
      title: `经期第 ${day} 天`,
      suggestion: '注意保暖，避免剧烈运动。多喝温热饮品，补充铁元素。',
    },
    follicular: {
      title: `卵泡期第 ${day} 天`,
      suggestion: '精力回升，适合开始新项目、学习新技能、做有挑战的事。',
    },
    ovulation: {
      title: `排卵期第 ${day} 天`,
      suggestion: '精力和社交欲达到峰值，适合重要会议、约会、户外活动。',
    },
    luteal: {
      title: `黄体期第 ${day} 天`,
      suggestion: '身体在为可能的孕期做准备，可能感到疲倦。适合温和运动、自我关怀。',
    },
  };

  const tip = baseTips[phase];

  return {
    id: `today-${phase}`,
    category: 'today',
    severity: 'info',
    emoji: '🌿',
    title: tip.title,
    data: todayLog
      ? `今日已记录：${
          todayLog.mood ? `心情 ${todayLog.mood}/5` : ''
        }${todayLog.energy ? `、精力 ${todayLog.energy}/5` : ''}`
      : '今天还没有记录',
    interpretation: '根据你的周期阶段给出建议。',
    suggestion: tip.suggestion,
  };
}

/**
 * 6. 异常检测
 *
 * 检查当前周期是否与历史均值显著偏离（±2 个标准差）
 */
function anomalyInsight(ctx: InsightContext): Insight | null {
  const { periods, userAvgCycle, today } = ctx;
  if (periods.length < 4) return null;

  const sorted = [...periods].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const latest = sorted[sorted.length - 1];
  const latestStart = parseISO(latest.startDate);

  // 计算历史间隔
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(
      differenceInDays(
        parseISO(sorted[i].startDate),
        parseISO(sorted[i - 1].startDate),
      ),
    );
  }
  const mean = intervals.reduce((s, n) => s + n, 0) / intervals.length;
  const std = Math.sqrt(
    intervals.reduce((s, n) => s + (n - mean) ** 2, 0) / intervals.length,
  );

  // 当前距上次月经的天数
  const daysSinceLast = differenceInDays(today, latestStart);
  const expected = userAvgCycle ?? mean;

  if (daysSinceLast < expected - 2 * std) {
    return {
      id: 'anomaly-early',
      category: 'anomaly',
      severity: 'important',
      emoji: '🌸',
      title: '周期比平时提前',
      data: `距上次月经 ${daysSinceLast} 天（平均 ${expected.toFixed(0)} 天）`,
      interpretation: '周期提前可能与近期压力、作息变化、剧烈运动或饮食改变相关。',
      suggestion: '留意近期生活变化，如果经常提前可咨询医生。',
    };
  }

  if (daysSinceLast > expected + 2 * std) {
    const diff = daysSinceLast - expected;
    return {
      id: 'anomaly-late',
      category: 'anomaly',
      severity: 'important',
      emoji: '🌸',
      title: '周期比平时延后',
      data: `距上次月经 ${daysSinceLast} 天（平均 ${expected.toFixed(0)} 天，已延后 ${diff.toFixed(0)} 天）`,
      interpretation: '周期延后可能与压力、体重变化、激素水平相关。如果你近期有性生活，延后也可能是怀孕的信号。',
      suggestion: '留意身体其他信号；如果延后超过 2 周或经常延后，可考虑就医。',
    };
  }

  return null;
}

// ===== 辅助函数 =====

function avgOrNull(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

/**
 * 找到某日期所在周期的开始日
 */
function findCycleStart(date: Date, periods: PeriodRecord[]): Date | null {
  const sorted = [...periods].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  let cycleStart: Date | null = null;
  for (const p of sorted) {
    const start = parseISO(p.startDate);
    if (start.getTime() <= date.getTime()) {
      cycleStart = start;
    } else {
      break;
    }
  }
  return cycleStart;
}

/**
 * 便捷函数：包装整个流程
 */
export function buildInsights(
  periods: PeriodRecord[],
  logs: DailyLog[],
  today: Date = startOfDay(new Date()),
  userAvgCycle?: number,
  userAvgPeriod?: number,
): Insight[] {
  const prediction = predictCycle(periods, today, userAvgCycle, userAvgPeriod);
  return generateInsights({
    periods,
    logs,
    prediction,
    today,
    userAvgCycle,
    userAvgPeriod,
  });
}