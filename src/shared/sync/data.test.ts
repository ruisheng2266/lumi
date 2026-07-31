/**
 * src/shared/sync/data.test.ts
 * Phase 2 本地快照与远端合并（LWW by updatedAt）单测。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db, type Period } from '../db/client';
import { collectLocalRecords, applyRemoteRecords, applyRemoteDeletion } from './data';

const guard = { value: false };

async function resetDb() {
  await db.periods.clear();
  await db.dailyLogs.clear();
  await db.userProfile.clear();
  await db.settings.clear();
  await db.insightPrefs.clear();
  await db.lifeEvents.clear();
}

describe('sync data merge', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('collectLocalRecords 为 period 生成稳定 recordId', async () => {
    const now = Date.now();
    await db.periods.add({
      startDate: '2026-03-03',
      flow: 'light',
      createdAt: now,
      updatedAt: now,
    });
    const records = await collectLocalRecords();
    const rec = records.find((r) => r.recordId === 'period:2026-03-03');
    expect(rec).toBeTruthy();
    expect(rec!.updatedAt).toBe(now);
    expect((rec!.data as Period).startDate).toBe('2026-03-03');
  });

  it('LWW：远端更新时间更大时覆盖本地，更小则保留本地', async () => {
    const old = Date.now() - 1000;
    const latest = Date.now();
    await db.periods.add({ startDate: '2026-04-04', flow: 'light', notes: '本地', createdAt: old, updatedAt: old });

    // 远端更新（时间更大）
    await applyRemoteRecords(
      [
        {
          recordId: 'period:2026-04-04',
          updatedAt: latest,
          data: { startDate: '2026-04-04', flow: 'heavy', notes: '远端', createdAt: old, updatedAt: latest },
        },
      ],
      guard,
    );
    let local = await db.periods.where('startDate').equals('2026-04-04').first();
    expect(local!.notes).toBe('远端');

    // 远端更旧 → 不应覆盖
    await applyRemoteRecords(
      [
        {
          recordId: 'period:2026-04-04',
          updatedAt: old - 5000,
          data: { startDate: '2026-04-04', flow: 'medium', notes: '旧远端', createdAt: old, updatedAt: old - 5000 },
        },
      ],
      guard,
    );
    local = await db.periods.where('startDate').equals('2026-04-04').first();
    expect(local!.notes).toBe('远端');
  });

  it('删除 tombstone 会移除本地对应记录', async () => {
    await db.periods.add({ startDate: '2026-05-05', flow: 'light', createdAt: 1, updatedAt: 1 });
    await applyRemoteDeletion('period:2026-05-05', guard);
    const local = await db.periods.where('startDate').equals('2026-05-05').first();
    expect(local).toBeUndefined();
  });
});
