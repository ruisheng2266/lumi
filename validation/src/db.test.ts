/**
 * src/db.test.ts
 * Dexie schema + repository 集成测试（PRD §7 / §12）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  periodRepo,
  dailyLogRepo,
  userProfileRepo,
  settingsRepo,
  type Period,
} from './db';

describe('LumiDB schema', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('opens database with all 4 tables', async () => {
    const tables = db.tables.map((t) => t.name).sort();
    expect(tables).toEqual(['dailyLogs', 'periods', 'settings', 'userProfile']);
  });

  it('persists periods with indexes', async () => {
    const id = await periodRepo.add({ startDate: '2026-07-20', flow: 'medium' });
    const fetched = await db.periods.get(id);
    expect(fetched?.startDate).toBe('2026-07-20');
    expect(fetched?.flow).toBe('medium');
    expect(typeof fetched?.createdAt).toBe('number');
  });

  it('orders periods by startDate desc', async () => {
    await periodRepo.add({ startDate: '2026-05-01' });
    await periodRepo.add({ startDate: '2026-07-20' });
    await periodRepo.add({ startDate: '2026-06-15' });
    const list = await periodRepo.list();
    expect(list.map((p) => p.startDate)).toEqual([
      '2026-07-20',
      '2026-06-15',
      '2026-05-01',
    ]);
  });

  it('updates and deletes periods', async () => {
    const id = await periodRepo.add({ startDate: '2026-07-20', flow: 'light' });
    await periodRepo.update(id, { flow: 'heavy', endDate: '2026-07-25' });
    const updated = await db.periods.get(id);
    expect(updated?.flow).toBe('heavy');
    expect(updated?.endDate).toBe('2026-07-25');
    await periodRepo.remove(id);
    expect(await db.periods.get(id)).toBeUndefined();
  });
});

describe('dailyLogRepo', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('upserts by date (unique)', async () => {
    const id1 = await dailyLogRepo.upsertByDate('2026-07-24', {
      mood: 4,
      energy: 3,
      sleepHours: 7.5,
      symptoms: ['cramps', 'fatigue'],
    });
    const id2 = await dailyLogRepo.upsertByDate('2026-07-24', {
      mood: 2,
      energy: 1,
      symptoms: ['headache'],
    });
    expect(id1).toBe(id2); // 同一天覆盖
    const log = await dailyLogRepo.getByDate('2026-07-24');
    expect(log?.mood).toBe(2);
    expect(log?.energy).toBe(1);
    expect(log?.symptoms).toEqual(['headache']);
  });

  it('returns undefined for non-existent date', async () => {
    const log = await dailyLogRepo.getByDate('1999-01-01');
    expect(log).toBeUndefined();
  });
});

describe('userProfileRepo', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('upserts a single profile record', async () => {
    const id1 = await userProfileRepo.upsert({
      displayName: '珊珊',
      avgCycleLen: 30,
      avgPeriodLen: 6,
    });
    expect(typeof id1).toBe('number');

    await userProfileRepo.upsert({
      displayName: '珊珊',
      avgCycleLen: 31,
      avgPeriodLen: 5,
    });
    const all = await db.userProfile.toArray();
    expect(all.length).toBe(1); // 仍然只有 1 条
    expect(all[0].avgCycleLen).toBe(31);
  });
});

describe('settingsRepo', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('stores and retrieves typed values', async () => {
    await settingsRepo.set('language', 'zh-CN');
    await settingsRepo.set<string>('theme', 'dark');
    await settingsRepo.set<number>('onboarded', 1 as unknown as number);
    expect(await settingsRepo.get('language')).toBe('zh-CN');
    expect(await settingsRepo.get('theme')).toBe('dark');
  });

  it('returns undefined for missing key', async () => {
    expect(await settingsRepo.get('nonexistent')).toBeUndefined();
  });
});

describe('end-to-end scenario', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('simulates user onboarding + 1 period + 1 daily log', async () => {
    // 1. 入职
    await userProfileRepo.upsert({
      displayName: 'Linda',
      avgCycleLen: 28,
      avgPeriodLen: 5,
    });
    await settingsRepo.set('language', 'zh-CN');
    await settingsRepo.set('theme', 'light');

    // 2. 记录月经
    await periodRepo.add({
      startDate: '2026-07-20',
      endDate: '2026-07-25',
      flow: 'medium',
    });

    // 3. 记录日记
    await dailyLogRepo.upsertByDate('2026-07-20', {
      mood: 2,
      energy: 1,
      sleepHours: 6,
      symptoms: ['cramps', 'fatigue'],
      notes: '经期第一天，痛经。',
    });

    // 4. 验证
    const periods = await periodRepo.list();
    expect(periods.length).toBe(1);
    const logs = await dailyLogRepo.list();
    expect(logs.length).toBe(1);
    const profile = await userProfileRepo.get();
    expect(profile?.displayName).toBe('Linda');
    expect(await settingsRepo.get('language')).toBe('zh-CN');
  });
});