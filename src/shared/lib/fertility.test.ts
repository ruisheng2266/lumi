import { describe, it, expect } from 'vitest';
import { detectOvulationFromBBT, buildBBTSeries, buildBBTChart } from './fertility';
import type { DailyLog } from '../db/client';

function log(date: string, bbt: number): DailyLog {
  return { date, bbt, createdAt: 0, updatedAt: 0 };
}

describe('detectOvulationFromBBT', () => {
  it('returns null when fewer than 8 readings', () => {
    const logs = Array.from({ length: 7 }, (_, i) =>
      log(`2026-01-0${i + 1}`, 36.3 + (i % 2) * 0.4),
    );
    expect(detectOvulationFromBBT(logs)).toBeNull();
  });

  it('detects a sustained temperature shift', () => {
    // 6 baseline days at 36.30, then 3 elevated days
    const logs: DailyLog[] = [
      ...Array.from({ length: 6 }, (_, i) => log(`2026-01-0${i + 1}`, 36.3)),
      log('2026-01-07', 36.75),
      log('2026-01-08', 36.78),
      log('2026-01-09', 36.8),
      log('2026-01-10', 36.79),
    ];
    const shift = detectOvulationFromBBT(logs);
    expect(shift).not.toBeNull();
    expect(shift!.date).toBe('2026-01-07');
    expect(shift!.shiftFrom).toBeCloseTo(0.45, 1);
  });

  it('ignores a transient single-day spike', () => {
    const logs: DailyLog[] = [
      ...Array.from({ length: 6 }, (_, i) => log(`2026-01-0${i + 1}`, 36.3)),
      log('2026-01-07', 36.9), // spike but not sustained
      log('2026-01-08', 36.31),
      log('2026-01-09', 36.32),
      log('2026-01-10', 36.33),
    ];
    expect(detectOvulationFromBBT(logs)).toBeNull();
  });

  it('excludes out-of-range bbt values', () => {
    const logs: DailyLog[] = [
      ...Array.from({ length: 6 }, (_, i) => log(`2026-01-0${i + 1}`, 36.3)),
      { date: '2026-01-07', bbt: 99 as any, createdAt: 0, updatedAt: 0 }, // out of range -> filtered
      log('2026-01-08', 36.78),
      log('2026-01-09', 36.8),
      log('2026-01-10', 36.79),
    ];
    const shift = detectOvulationFromBBT(logs);
    // invalid day 7 dropped, sustained shift detected starting at 2026-01-08
    expect(shift).not.toBeNull();
    expect(shift!.date).toBe('2026-01-08');
  });
});

describe('buildBBTSeries / buildBBTChart', () => {
  it('sorts readings ascending by date and strips bbt', () => {
    const logs = [log('2026-01-03', 36.7), log('2026-01-01', 36.3), log('2026-01-02', 36.4)];
    const points = buildBBTSeries(logs);
    expect(points.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(points[0].label).toBe('1/1');
  });

  it('buildBBTChart returns ovulation date when a shift exists', () => {
    const logs: DailyLog[] = [
      ...Array.from({ length: 6 }, (_, i) => log(`2026-01-0${i + 1}`, 36.3)),
      log('2026-01-07', 36.75),
      log('2026-01-08', 36.78),
      log('2026-01-09', 36.8),
      log('2026-01-10', 36.79),
    ];
    const { points, ovulationDate } = buildBBTChart(logs);
    expect(points.length).toBe(10);
    expect(ovulationDate).toBe('2026-01-07');
  });
});
