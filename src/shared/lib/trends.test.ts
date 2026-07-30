import { describe, it, expect } from 'vitest';
import { cycleLengthSeries, symptomPhaseCorrelation } from './trends';
import type { DailyLog, Period } from '../db/client';

function period(start: string, end?: string): Period {
  return { startDate: start, endDate: end, createdAt: 0, updatedAt: 0 };
}

describe('cycleLengthSeries', () => {
  it('returns empty with fewer than 2 periods', () => {
    expect(cycleLengthSeries([period('2026-01-01')])).toEqual([]);
  });

  it('computes interval between consecutive starts', () => {
    const periods = [
      period('2026-01-01'),
      period('2026-01-29'),
      period('2026-02-26'),
    ];
    const pts = cycleLengthSeries(periods);
    expect(pts).toHaveLength(2);
    expect(pts[0].interval).toBe(28);
    expect(pts[1].interval).toBe(28);
    expect(pts[1].date).toBe('2026-02-26');
  });

  it('sorts out-of-order periods before computing', () => {
    const periods = [period('2026-02-26'), period('2026-01-01'), period('2026-01-29')];
    const pts = cycleLengthSeries(periods);
    expect(pts.map((p) => p.interval)).toEqual([28, 28]);
  });
});

describe('symptomPhaseCorrelation', () => {
  const periods = [
    period('2026-01-01'), // cycle 1
    period('2026-01-29'), // cycle 2
    period('2026-02-26'), // cycle 3
  ];
  // avg cycle ~28 -> phaseOf: day<=5 menstrual, ovulation ~ day 14

  it('returns empty with fewer than 2 periods', () => {
    expect(symptomPhaseCorrelation([period('2026-01-01')], [])).toEqual([]);
  });

  it('attributes symptoms to the correct phase', () => {
    const logs: DailyLog[] = [
      { date: '2026-01-01', symptoms: ['cramps'], createdAt: 0, updatedAt: 0 }, // menstrual day 1
      { date: '2026-01-14', symptoms: ['cramps'], createdAt: 0, updatedAt: 0 }, // follicular/ovulation
      { date: '2026-02-01', symptoms: ['headache'], createdAt: 0, updatedAt: 0 }, // cycle2 menstrual day1
      { date: '2026-02-28', symptoms: ['headache'], createdAt: 0, updatedAt: 0 }, // cycle3 menstrual day3
    ];
    const result = symptomPhaseCorrelation(periods, logs);
    const cramps = result.find((r) => r.symptom === 'cramps');
    expect(cramps).toBeDefined();
    expect(cramps!.menstrual).toBe(1); // 2026-01-01
    expect(cramps!.follicular + cramps!.ovulation).toBe(1); // 2026-01-14 (day 14 -> ovulation)
    const headache = result.find((r) => r.symptom === 'headache');
    expect(headache).toBeDefined();
    expect(headache!.menstrual).toBe(2);
    expect(headache!.total).toBe(2);
  });

  it('ignores symptoms outside any known cycle', () => {
    const logs: DailyLog[] = [
      { date: '2025-06-01', symptoms: ['cramps'], createdAt: 0, updatedAt: 0 },
    ];
    const result = symptomPhaseCorrelation(periods, logs);
    expect(result.find((r) => r.symptom === 'cramps')).toBeUndefined();
  });
});
