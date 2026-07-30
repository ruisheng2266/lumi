/**
 * src/shared/lib/trends.ts
 * 多年趋势 & 症状-阶段相关性（v0.5）
 *
 * 纯本地、非诊断：基于历史周期与日记计算长期趋势与模式。
 */

import { parseISO, differenceInDays } from 'date-fns';
import {
  avgCycleLen,
  phaseOf,
  type Phase,
  type PeriodRecord,
} from './predict';
import type { DailyLog } from '../db/client';

export interface CycleLengthPoint {
  date: string; // 当前周期开始日
  label: string;
  interval: number; // 距上次月经的天数（= 上一周期长度）
}

/**
 * 每个周期间隔随时间的变化（长期趋势）。
 * - 至少 2 次月经才返回数据，否则返回 []。
 */
export function cycleLengthSeries(periods: PeriodRecord[]): CycleLengthPoint[] {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (sorted.length < 2) return [];

  const points: CycleLengthPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1].startDate);
    const cur = parseISO(sorted[i].startDate);
    const d = new Date(cur);
    points.push({
      date: sorted[i].startDate,
      label: `${d.getFullYear()}/${d.getMonth() + 1}`,
      interval: differenceInDays(cur, prev),
    });
  }
  return points;
}

export interface SymptomPhaseCount {
  symptom: string;
  menstrual: number;
  follicular: number;
  ovulation: number;
  luteal: number;
  total: number;
}

function findCycleStart(date: Date, periods: PeriodRecord[]): Date | null {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let cycleStart: Date | null = null;
  for (const p of sorted) {
    const start = parseISO(p.startDate);
    if (start.getTime() <= date.getTime()) cycleStart = start;
    else break;
  }
  return cycleStart;
}

/**
 * 症状在各阶段（经期/卵泡期/排卵期/黄体期）的出现次数。
 * 仅统计落在已知周期内的日志（能推算出 phase）。
 */
export function symptomPhaseCorrelation(
  periods: PeriodRecord[],
  logs: DailyLog[],
  avgCycle?: number,
): SymptomPhaseCount[] {
  if (periods.length < 2) return [];
  const avg = avgCycle ?? avgCycleLen(periods);

  const map: Record<string, SymptomPhaseCount> = {};
  for (const log of logs) {
    if (!log.symptoms || log.symptoms.length === 0) continue;
    const logDate = parseISO(log.date);
    const cycleStart = findCycleStart(logDate, periods);
    if (!cycleStart) continue;
    const dayInCycle = differenceInDays(logDate, cycleStart) + 1;
    const phase: Phase = phaseOf(dayInCycle, avg);
    for (const sym of log.symptoms) {
      if (!map[sym]) {
        map[sym] = {
          symptom: sym,
          menstrual: 0,
          follicular: 0,
          ovulation: 0,
          luteal: 0,
          total: 0,
        };
      }
      map[sym][phase] += 1;
      map[sym].total += 1;
    }
  }

  return Object.values(map)
    .filter((m) => m.total >= 2)
    .sort((a, b) => b.total - a.total);
}

export const PHASE_ORDER: Phase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];
