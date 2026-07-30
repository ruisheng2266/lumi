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

export type LifeEventType =
  | 'pregnancy'
  | 'miscarriage'
  | 'birth'
  | 'hysterectomy'
  | 'menopause'
  | 'birthControlStart'
  | 'birthControlStop';

export interface LifeEvent {
  id?: number;
  type: LifeEventType;
  date: string; // 'YYYY-MM-DD'
  endDate?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

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
  specialState: SpecialState | null;
  rangeStart: string | null;
  rangeEnd: string | null;
}

export type SpecialStateType = 'pregnant' | 'postpartum' | 'menopause' | 'noCycle';
export interface SpecialState {
  type: SpecialStateType;
  since: string;
  until?: string;
}

/**
 * 根据特殊生理事件推断当前是否处于「不可预测经期」的状态（v0.4）。
 */
export function getSpecialState(
  events: LifeEvent[],
  periods: PeriodRecord[],
  today: Date = new Date(),
): SpecialState | null {
  const t0 = startOfDay(today);

  const menopause = events
    .filter((e) => e.type === 'menopause' && !isAfter(parseISO(e.date), t0))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (menopause) return { type: 'menopause', since: menopause.date };

  const hyst = events
    .filter((e) => e.type === 'hysterectomy' && !isAfter(parseISO(e.date), t0))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (hyst) return { type: 'noCycle', since: hyst.date };

  const preg = events.find(
    (e) =>
      e.type === 'pregnancy' &&
      !isAfter(parseISO(e.date), t0) &&
      (!e.endDate || !isBefore(parseISO(e.endDate), t0)),
  );
  if (preg) return { type: 'pregnant', since: preg.date, until: preg.endDate };

  const births = events
    .filter((e) => e.type === 'birth' && !isAfter(parseISO(e.date), t0))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (births.length) {
    const last = births[0];
    const daysSince = differenceInDays(t0, parseISO(last.date));
    const resumed = periods.some((p) => p.startDate > last.date);
    if (daysSince <= 365 && !resumed) {
      return { type: 'postpartum', since: last.date };
    }
  }
  return null;
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
  lifeEvents?: LifeEvent[],
): CyclePrediction {
  const cycleCount = periods.length;
  const avgCycle = userAvgCycle ?? avgCycleLen(periods);
  const periodLen = userAvgPeriod ?? DEFAULT_PERIOD_LEN;

  // 特殊生理状态（孕期/产后/绝经/无周期）：不做经期预测（v0.4）
  const specialState = lifeEvents ? getSpecialState(lifeEvents, periods, today) : null;
  if (
    specialState &&
    (specialState.type === 'pregnant' ||
      specialState.type === 'postpartum' ||
      specialState.type === 'menopause' ||
      specialState.type === 'noCycle')
  ) {
    return {
      nextPeriodStart: null,
      nextPeriodEnd: null,
      ovulationDay: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      currentDayInCycle: null,
      currentPhase: null,
      confidence: confidenceFor(cycleCount),
      avgCycleLen: avgCycle,
      cycleCount,
      specialState,
      rangeStart: null,
      rangeEnd: null,
    };
  }

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
      specialState: null,
      rangeStart: null,
      rangeEnd: null,
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

  // 不规律周期：下次月经的可能区间（诚实预测，v0.4）
  let rangeStart: string | null = null;
  let rangeEnd: string | null = null;
  if (cycleRegularity(periods) === 'irregular' && cycleCount >= 4) {
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(differenceInDays(parseISO(sorted[i].startDate), parseISO(sorted[i - 1].startDate)));
    }
    const valid = intervals.filter((n) => n >= 15 && n <= 60);
    if (valid.length) {
      rangeStart = format(addDays(latestStart, Math.min(...valid)), 'yyyy-MM-dd');
      rangeEnd = format(addDays(latestStart, Math.max(...valid)), 'yyyy-MM-dd');
    }
  }

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
    specialState: null,
    rangeStart,
    rangeEnd,
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