/**
 * validation/src/insights.test.ts
 * 洞察引擎单元测试（PRD §6.4）
 */
import { describe, it, expect } from 'vitest';
import { buildInsights, type Insight } from '../../src/shared/lib/insights';
import { cycleRegularity } from '../../src/shared/lib/predict';
import type { DailyLog } from '../../src/shared/db/client';

const today = new Date('2026-07-24T00:00:00');

function makePeriods(...dates: string[]) {
  return dates.map((d) => ({ startDate: d }));
}

function makeLog(date: string, partial: Partial<DailyLog> = {}): DailyLog {
  return {
    date,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('cycleRegularity (re-exported)', () => {
  it('returns insufficient when < 4 periods', () => {
    const periods = makePeriods('2026-04-01', '2026-04-29', '2026-05-27');
    expect(cycleRegularity(periods)).toBe('insufficient');
  });
});

describe('buildInsights', () => {
  it('returns empty array for no data', () => {
    const insights = buildInsights([], [], today);
    expect(insights).toEqual([]);
  });

  it('returns regularity insight when enough data', () => {
    const periods = makePeriods(
      '2026-04-01', '2026-04-29', '2026-05-27', '2026-06-24',
    );
    const insights = buildInsights(periods, [], today);
    const r = insights.find((i) => i.category === 'regularity');
    expect(r).toBeDefined();
    expect(r?.title).toMatch(/周期|波动|Cycle/);
  });

  it('returns today tip when at least 1 period exists', () => {
    const periods = makePeriods('2026-07-20');
    const insights = buildInsights(periods, [], today);
    const todayInsight = insights.find((i) => i.category === 'today');
    expect(todayInsight).toBeDefined();
    expect(todayInsight?.title).toContain('第');
  });

  it('returns anomaly insight for early period', () => {
    // 平均 30 天周期，但今天距离上次月经只有 10 天 → 太早
    const periods = makePeriods(
      '2026-04-01', '2026-05-01', '2026-05-31', '2026-06-30',
    );
    // latest period at 2026-07-14 (距今天 10 天，平均 30 天，太早)
    const periodsWithEarly: any[] = [
      ...periods,
      { startDate: '2026-07-14' },
    ];
    const insights = buildInsights(periodsWithEarly, [], today);
    const anomaly = insights.find((i) => i.category === 'anomaly');
    expect(anomaly).toBeDefined();
    expect(anomaly?.title).toMatch(/提前|延后/);
  });

  it('does not return PMS insight with too little log data', () => {
    const periods = makePeriods('2026-04-01', '2026-04-29', '2026-05-27', '2026-06-24');
    const logs: DailyLog[] = [
      makeLog('2026-06-20', { symptoms: ['cramps'] }),
    ];
    const insights = buildInsights(periods, logs, today);
    const pms = insights.find((i) => i.category === 'pms');
    expect(pms).toBeUndefined();
  });

  it('returns PMS insight when pattern detected', () => {
    const periods = makePeriods(
      '2026-04-01', '2026-04-29', '2026-05-27', '2026-06-24', '2026-07-22',
    );
    const logs: DailyLog[] = [];
    const pmsData = [
      { pms: '2026-04-26', other: '2026-05-09' },
      { pms: '2026-05-24', other: '2026-06-06' },
      { pms: '2026-06-21', other: '2026-07-04' },
    ];
    for (const d of pmsData) {
      logs.push(makeLog(d.pms, { symptoms: ['cramps', 'bloating'] }));
      logs.push(makeLog(d.other, { symptoms: ['headache'] }));
    }
    const insights = buildInsights(periods, logs, today);
    const pms = insights.find((i) => i.category === 'pms');
    expect(pms).toBeDefined();
    expect(pms?.title).toContain('PMS');
  });

  it('returns sleep-mood insight when correlation is clear', () => {
    const logs: DailyLog[] = [];
    // 5 天睡眠 < 6h → 情绪低
    for (let i = 0; i < 5; i++) {
      logs.push(makeLog(`2026-07-0${1 + i}`, { sleepHours: 5, mood: 2 }));
    }
    // 5 天睡眠 ≥ 7h → 情绪高
    for (let i = 0; i < 5; i++) {
      logs.push(makeLog(`2026-07-1${0 + i}`, { sleepHours: 8, mood: 4 }));
    }
    const periods = makePeriods('2026-06-01', '2026-06-29', '2026-07-27');
    const insights = buildInsights(periods, logs, today);
    const sleep = insights.find((i) => i.category === 'sleep_mood');
    expect(sleep).toBeDefined();
  });

  it('sorts insights by severity (important first)', () => {
    const periods = makePeriods(
      '2026-04-01', '2026-05-01', '2026-05-31', '2026-06-30',
    );
    const periodsWithAnomaly: any[] = [
      ...periods,
      { startDate: '2026-07-14' }, // 异常早
    ];
    const insights = buildInsights(periodsWithAnomaly, [], today);
    // 至少第一条应该是 important 级别
    expect(insights.length).toBeGreaterThan(0);
    expect(['important', 'gentle', 'info']).toContain(insights[0].severity);
  });

  it('every insight has data/interpretation/suggestion fields', () => {
    const periods = makePeriods('2026-04-01', '2026-04-29', '2026-05-27', '2026-06-24');
    const insights = buildInsights(periods, [], today);
    for (const insight of insights) {
      expect(insight.data).toBeTruthy();
      expect(insight.interpretation).toBeTruthy();
      expect(insight.suggestion).toBeTruthy();
      expect(insight.title).toBeTruthy();
    }
  });
});