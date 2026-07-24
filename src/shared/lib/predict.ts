/**
 * src/predict.ts
 * 周期预测核心算法（PRD §6.1, §6.2）
 */

import {
  differenceInDays,
  addDays,
  format,
  parseISO,
  startOfDay,
  isAfter,
  isBefore,
} from 'date-fns';

export type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface PeriodRecord {
  id?: number;
  startDate: string; // ISO 'YYYY-MM-DD'
  endDate?: string;
  flow?: 'light' | 'medium' | 'heavy';
}

export interface CyclePrediction {
  nextPeriodStart: string | null;
  nextPeriodEnd: string | null;
  ovulationDay: string | null;
  fertileWindowStart: string | null;
  fertileWindowEnd: string | null;
  currentDayInCycle: number | null;
  currentPhase: Phase | null;
  confidence: 'none' | 'low' | 'medium' | 'high';
  avgCycleLen: number;
  cycleCount: number;
}

export const DEFAULT_CYCLE_LEN = 28;
export const DEFAULT_PERIOD_LEN = 5;
export const LUTEAL_PHASE_LEN = 14; // 黄体期（医学共识）

/**
 * 计算给定日期所在周期的"周期内第几天"（cycle day）
 * - cycle day 1 = 经期第一天
 */
export function cycleDayOf(date: Date, periods: PeriodRecord[]): number | null {
  const sorted = [...periods].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  let day: number | null = null;
  for (const p of sorted) {
    const start = parseISO(p.startDate);
    if (!isAfter(date, start) && !isBefore(date, start)) {
      day = 1;
      break;
    }
    if (isAfter(date, start)) {
      day = differenceInDays(date, start) + 1;
    }
  }
  return day;
}

/**
 * 计算平均周期长度
 */
export function avgCycleLen(periods: PeriodRecord[]): number {
  const sorted = [...periods].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  if (sorted.length < 2) return DEFAULT_CYCLE_LEN;

  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1].startDate);
    const cur = parseISO(sorted[i].startDate);
    intervals.push(differenceInDays(cur, prev));
  }
  // 去掉极端值（< 15 或 > 60 天）
  const valid = intervals.filter((n) => n >= 15 && n <= 60);
  if (valid.length === 0) return DEFAULT_CYCLE_LEN;
  return Math.round(valid.reduce((s, n) => s + n, 0) / valid.length);
}

/**
 * 周期规律性评级（标准差系数 CV）
 */
export function cycleRegularity(
  periods: PeriodRecord[],
): 'insufficient' | 'irregular' | 'ok' | 'good' {
  const sorted = [...periods].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  if (sorted.length < 4) return 'insufficient';

  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1].startDate);
    const cur = parseISO(sorted[i].startDate);
    intervals.push(differenceInDays(cur, prev));
  }
  const mean = intervals.reduce((s, n) => s + n, 0) / intervals.length;
  const variance =
    intervals.reduce((s, n) => s + (n - mean) ** 2, 0) / intervals.length;
  const cv = Math.sqrt(variance) / mean;

  if (cv < 0.05) return 'good';
  if (cv < 0.1) return 'ok';
  return 'irregular';
}

/**
 * 置信度分级
 */
function confidenceFor(cycleCount: number): CyclePrediction['confidence'] {
  if (cycleCount === 0) return 'none';
  if (cycleCount === 1) return 'low';
  if (cycleCount <= 3) return 'medium';
  return 'high';
}

/**
 * 识别当前阶段
 */
export function phaseOf(
  dayInCycle: number,
  avgCycle: number,
): Phase {
  if (dayInCycle <= 0) return 'menstrual';
  if (dayInCycle <= 5) return 'menstrual';
  // 排卵日 ≈ avgCycle - 14；排卵窗口 = ±1 天（3 天）
  const ovulationDay = avgCycle - LUTEAL_PHASE_LEN;
  const windowStart = ovulationDay - 1;
  const windowEnd = ovulationDay + 1;
  if (dayInCycle >= windowStart && dayInCycle <= windowEnd) return 'ovulation';
  if (dayInCycle < windowStart) return 'follicular';
  return 'luteal';
}

/**
 * 主预测函数
 */
export function predictCycle(
  periods: PeriodRecord[],
  today: Date = new Date(),
  userAvgCycle?: number,
  userAvgPeriod?: number,
): CyclePrediction {
  const cycleCount = periods.length;
  const avgCycle = userAvgCycle ?? avgCycleLen(periods);
  const periodLen = userAvgPeriod ?? DEFAULT_PERIOD_LEN;

  if (cycleCount === 0) {
    return {
      nextPeriodStart: null,
      nextPeriodEnd: null,
      ovulationDay: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      currentDayInCycle: null,
      currentPhase: null,
      confidence: 'none',
      avgCycleLen: avgCycle,
      cycleCount: 0,
    };
  }

  // 取最近一次月经
  const sorted = [...periods].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const latest = sorted[sorted.length - 1];
  const latestStart = parseISO(latest.startDate);

  // 当前周期第几天
  const today0 = startOfDay(today);
  const dayInCycle = differenceInDays(today0, latestStart) + 1;

  // 当前周期：今天在 [latest.start, latest.start + avgCycle)
  // 下次月经开始：lastStart + avgCycle
  const nextStart = addDays(latestStart, avgCycle);
  const nextEnd = addDays(nextStart, periodLen - 1);

  // 排卵日：nextStart - 14
  const ovulation = addDays(nextStart, -LUTEAL_PHASE_LEN);
  // 易孕窗口：[ovulation - 5, ovulation + 1]
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);

  return {
    nextPeriodStart: format(nextStart, 'yyyy-MM-dd'),
    nextPeriodEnd: format(nextEnd, 'yyyy-MM-dd'),
    ovulationDay: format(ovulation, 'yyyy-MM-dd'),
    fertileWindowStart: format(fertileStart, 'yyyy-MM-dd'),
    fertileWindowEnd: format(fertileEnd, 'yyyy-MM-dd'),
    currentDayInCycle: dayInCycle > 0 ? dayInCycle : null,
    currentPhase: dayInCycle > 0 ? phaseOf(dayInCycle, avgCycle) : null,
    confidence: confidenceFor(cycleCount),
    avgCycleLen: avgCycle,
    cycleCount,
  };
}

/**
 * 工具：判断今天是否在易孕窗口
 */
export function isInFertileWindow(
  today: Date,
  prediction: CyclePrediction,
): boolean {
  if (!prediction.fertileWindowStart || !prediction.fertileWindowEnd) {
    return false;
  }
  const start = parseISO(prediction.fertileWindowStart);
  const end = parseISO(prediction.fertileWindowEnd);
  const t = startOfDay(today);
  return (
    (t.getTime() === start.getTime() || isAfter(t, start)) &&
    (t.getTime() === end.getTime() || isBefore(t, end))
  );
}