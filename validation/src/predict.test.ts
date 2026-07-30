/**
 * src/predict.test.ts
 * predict.ts 单元测试（PRD §6.1.4 / §6.2.5 / §12.2）
 */
import { describe, it, expect } from 'vitest';
import {
  predictCycle,
  avgCycleLen,
  cycleRegularity,
  phaseOf,
  isInFertileWindow,
  getSpecialState,
  DEFAULT_CYCLE_LEN,
  type PeriodRecord,
  type LifeEvent,
} from './predict';

const today = new Date('2026-07-24T00:00:00');

describe('avgCycleLen', () => {
  it('returns default when < 2 periods', () => {
    expect(avgCycleLen([])).toBe(DEFAULT_CYCLE_LEN);
    expect(avgCycleLen([{ startDate: '2026-07-01' }])).toBe(DEFAULT_CYCLE_LEN);
  });

  it('computes correct average for 3 cycles of 28 days', () => {
    const periods: PeriodRecord[] = [
      { startDate: '2026-04-01' },
      { startDate: '2026-04-29' }, // +28
      { startDate: '2026-05-27' }, // +28
    ];
    expect(avgCycleLen(periods)).toBe(28);
  });

  it('filters out outliers (< 15 or > 60 days)', () => {
    const periods: PeriodRecord[] = [
      { startDate: '2026-04-01' },
      { startDate: '2026-04-29' }, // +28
      { startDate: '2026-05-27' }, // +28
      { startDate: '2026-05-30' }, // +3 (异常)
      { startDate: '2026-06-27' }, // +28 (from 5-30 outlier)
    ];
    // intervals: [28, 28, 3, 28] → after filter (drop 3) → [28, 28, 28] → avg = 28
    expect(avgCycleLen(periods)).toBe(28);
  });

  it('handles irregular cycles (PCOS-like 40 days)', () => {
    const periods: PeriodRecord[] = [
      { startDate: '2026-03-01' },
      { startDate: '2026-04-10' }, // +40
      { startDate: '2026-05-20' }, // +40
    ];
    expect(avgCycleLen(periods)).toBe(40);
  });
});

describe('cycleRegularity', () => {
  it('returns insufficient when < 4 periods', () => {
    expect(cycleRegularity([])).toBe('insufficient');
    expect(
      cycleRegularity([
        { startDate: '2026-04-01' },
        { startDate: '2026-04-29' },
        { startDate: '2026-05-27' },
      ]),
    ).toBe('insufficient');
  });

  it('returns good for consistent cycles', () => {
    const periods: PeriodRecord[] = [
      { startDate: '2026-01-01' },
      { startDate: '2026-01-29' }, // 28
      { startDate: '2026-02-26' }, // 28
      { startDate: '2026-03-26' }, // 28
      { startDate: '2026-04-23' }, // 28
    ];
    expect(cycleRegularity(periods)).toBe('good');
  });

  it('returns irregular for varied cycles', () => {
    const periods: PeriodRecord[] = [
      { startDate: '2026-01-01' }, // 28
      { startDate: '2026-01-29' }, // 35
      { startDate: '2026-03-05' }, // 25
      { startDate: '2026-03-30' }, // 40
      { startDate: '2026-05-09' },
    ];
    const r = cycleRegularity(periods);
    expect(['irregular', 'ok']).toContain(r);
  });
});

describe('phaseOf', () => {
  it('identifies menstrual phase (days 1-5)', () => {
    expect(phaseOf(1, 28)).toBe('menstrual');
    expect(phaseOf(5, 28)).toBe('menstrual');
  });

  it('identifies follicular phase (days 6-12)', () => {
    expect(phaseOf(6, 28)).toBe('follicular');
    expect(phaseOf(12, 28)).toBe('follicular');
  });

  it('identifies ovulation (days 13-15 for 28-day cycle)', () => {
    expect(phaseOf(13, 28)).toBe('ovulation'); // day 14 ± 1
    expect(phaseOf(14, 28)).toBe('ovulation');
    expect(phaseOf(15, 28)).toBe('ovulation');
  });

  it('identifies luteal phase (days 16+)', () => {
    expect(phaseOf(16, 28)).toBe('luteal');
    expect(phaseOf(28, 28)).toBe('luteal');
  });
});

describe('predictCycle', () => {
  it('returns nulls and confidence "none" for empty data', () => {
    const r = predictCycle([], today);
    expect(r.nextPeriodStart).toBeNull();
    expect(r.ovulationDay).toBeNull();
    expect(r.confidence).toBe('none');
    expect(r.cycleCount).toBe(0);
  });

  it('returns confidence "low" for 1 cycle', () => {
    const r = predictCycle([{ startDate: '2026-07-20' }], today);
    expect(r.confidence).toBe('low');
    expect(r.nextPeriodStart).toBe('2026-08-17'); // 7-20 + 28
  });

  it('computes correct next period start for 28-day cycle', () => {
    const periods: PeriodRecord[] = [
      { startDate: '2026-04-01' },
      { startDate: '2026-04-29' },
      { startDate: '2026-05-27' },
      { startDate: '2026-06-24' }, // latest
    ];
    const r = predictCycle(periods, today);
    expect(r.nextPeriodStart).toBe('2026-07-22'); // 6-24 + 28
    expect(r.confidence).toBe('high');
  });

  it('computes ovulation day as nextStart - 14', () => {
    const periods: PeriodRecord[] = [
      { startDate: '2026-04-01' },
      { startDate: '2026-04-29' },
      { startDate: '2026-05-27' },
      { startDate: '2026-06-24' },
    ];
    const r = predictCycle(periods, today);
    expect(r.ovulationDay).toBe('2026-07-08'); // 7-22 - 14
    expect(r.fertileWindowStart).toBe('2026-07-03'); // ovulation - 5
    expect(r.fertileWindowEnd).toBe('2026-07-09'); // ovulation + 1
  });

  it('respects user-set avgCycleLen override', () => {
    const periods: PeriodRecord[] = [
      { startDate: '2026-06-24' },
    ];
    const r = predictCycle(periods, today, 35); // 用户自定义 35 天
    expect(r.nextPeriodStart).toBe('2026-07-29'); // 6-24 + 35
    expect(r.avgCycleLen).toBe(35);
  });

  it('respects user-set avgPeriodLen override', () => {
    const periods: PeriodRecord[] = [{ startDate: '2026-07-20' }];
    const r = predictCycle(periods, today, undefined, 7);
    expect(r.nextPeriodStart).toBe('2026-08-17');
    expect(r.nextPeriodEnd).toBe('2026-08-23'); // +7 - 1
  });

  it('calculates current day in cycle correctly', () => {
    // 假设今天 2026-07-24，最近月经 2026-07-20 → 第 5 天
    const r = predictCycle([{ startDate: '2026-07-20' }], today);
    expect(r.currentDayInCycle).toBe(5);
    expect(r.currentPhase).toBe('menstrual');
  });

  it('returns confidence levels correctly', () => {
    expect(predictCycle([], today).confidence).toBe('none');
    expect(predictCycle([{ startDate: '2026-07-01' }], today).confidence).toBe('low');
    expect(
      predictCycle(
        [
          { startDate: '2026-06-01' },
          { startDate: '2026-06-29' },
        ],
        today,
      ).confidence,
    ).toBe('medium');
    expect(
      predictCycle(
        [
          { startDate: '2026-04-01' },
          { startDate: '2026-04-29' },
          { startDate: '2026-05-27' },
          { startDate: '2026-06-24' },
        ],
        today,
      ).confidence,
    ).toBe('high');
  });
});

describe('isInFertileWindow', () => {
  const periods: PeriodRecord[] = [
    { startDate: '2026-04-01' },
    { startDate: '2026-04-29' },
    { startDate: '2026-05-27' },
    { startDate: '2026-06-24' },
  ];
  const prediction = predictCycle(periods, today);

  it('returns true when today is in fertile window', () => {
    expect(isInFertileWindow(new Date('2026-07-08'), prediction)).toBe(true);
    expect(isInFertileWindow(new Date('2026-07-05'), prediction)).toBe(true);
  });

  it('returns false when today is outside fertile window', () => {
    expect(isInFertileWindow(new Date('2026-07-01'), prediction)).toBe(false);
    expect(isInFertileWindow(new Date('2026-07-20'), prediction)).toBe(false);
  });
});
describe('getSpecialState (v0.4)', () => {
  const periods: PeriodRecord[] = [
    { startDate: '2026-01-01' },
    { startDate: '2026-01-29' },
    { startDate: '2026-02-26' },
    { startDate: '2026-03-25' },
  ];

  it('returns menopause state when menopause event is on/before today', () => {
    const events: LifeEvent[] = [{ type: 'menopause', date: '2026-06-01', createdAt: 0, updatedAt: 0 }];
    const state = getSpecialState(events, periods, new Date('2026-07-24'));
    expect(state?.type).toBe('menopause');
  });

  it('returns noCycle for hysterectomy', () => {
    const events: LifeEvent[] = [{ type: 'hysterectomy', date: '2026-05-01', createdAt: 0, updatedAt: 0 }];
    expect(getSpecialState(events, periods, new Date('2026-07-24'))?.type).toBe('noCycle');
  });

  it('returns pregnant while pregnancy is active (no endDate)', () => {
    const events: LifeEvent[] = [{ type: 'pregnancy', date: '2026-07-01', createdAt: 0, updatedAt: 0 }];
    expect(getSpecialState(events, periods, new Date('2026-07-24'))?.type).toBe('pregnant');
  });

  it('does not return pregnant once pregnancy endDate passed', () => {
    const events: LifeEvent[] = [{ type: 'pregnancy', date: '2026-07-01', endDate: '2026-07-10', createdAt: 0, updatedAt: 0 }];
    expect(getSpecialState(events, periods, new Date('2026-07-24'))).toBeNull();
  });

  it('returns postpartum within 1 year of birth with no later period', () => {
    const events: LifeEvent[] = [{ type: 'birth', date: '2026-06-01', createdAt: 0, updatedAt: 0 }];
    expect(getSpecialState(events, periods, new Date('2026-07-24'))?.type).toBe('postpartum');
  });

  it('does not return postpartum once a period is logged after birth', () => {
    const events: LifeEvent[] = [{ type: 'birth', date: '2026-06-01', createdAt: 0, updatedAt: 0 }];
    const withLater: PeriodRecord[] = [...periods, { startDate: '2026-07-01' }];
    expect(getSpecialState(events, withLater, new Date('2026-07-24'))).toBeNull();
  });

  it('birth control events never suppress prediction', () => {
    const events: LifeEvent[] = [
      { type: 'birthControlStart', date: '2026-05-01', createdAt: 0, updatedAt: 0 },
    ];
    expect(getSpecialState(events, periods, new Date('2026-07-24'))).toBeNull();
  });
});

describe('predictCycle special-state suppression (v0.4)', () => {
  const periods: PeriodRecord[] = [
    { startDate: '2026-01-01' },
    { startDate: '2026-01-29' },
    { startDate: '2026-02-26' },
    { startDate: '2026-03-25' },
  ];
  const menopause: LifeEvent[] = [{ type: 'menopause', date: '2026-06-01', createdAt: 0, updatedAt: 0 }];

  it('suppresses period prediction during a no-cycle special state', () => {
    const p = predictCycle(periods, new Date('2026-07-24'), undefined, undefined, menopause);
    expect(p.specialState?.type).toBe('menopause');
    expect(p.nextPeriodStart).toBeNull();
    expect(p.currentDayInCycle).toBeNull();
  });
});

describe('predictCycle irregular range (v0.4)', () => {
  // 4 cycles with high variance (PCOS-like): 21, 45, 24, 40 days
  const periods: PeriodRecord[] = [
    { startDate: '2026-01-01' },
    { startDate: '2026-01-22' }, // +21
    { startDate: '2026-03-08' }, // +45
    { startDate: '2026-04-01' }, // +24
    { startDate: '2026-05-11' }, // +40
  ];
  const latest = '2026-05-11';

  it('flags cycle as irregular with >= 4 cycles', () => {
    expect(cycleRegularity(periods)).toBe('irregular');
  });

  it('provides a next-period range from min/max observed intervals', () => {
    const p = predictCycle(periods, new Date('2026-07-24'));
    expect(p.rangeStart).not.toBeNull();
    expect(p.rangeEnd).not.toBeNull();
    // latest start + min interval (21) .. latest start + max interval (45)
    expect(p.rangeStart).toBe('2026-06-01');
    expect(p.rangeEnd).toBe('2026-06-25');
  });

  it('leaves range null when cycle is regular', () => {
    const regular: PeriodRecord[] = [
      { startDate: '2026-04-01' },
      { startDate: '2026-04-29' },
      { startDate: '2026-05-27' },
      { startDate: '2026-06-24' },
    ];
    const p = predictCycle(regular, new Date('2026-07-24'));
    expect(p.rangeStart).toBeNull();
    expect(p.rangeEnd).toBeNull();
  });
});
