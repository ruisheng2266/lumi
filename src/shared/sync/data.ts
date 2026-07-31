/**
 * src/shared/sync/data.ts
 * Phase 2 本地数据快照与远端合并（LWW by updatedAt）。
 *
 * 说明：为避免过度改动 Dexie schema，记录 ID 采用「自然键」而非新增 UUID 列：
 *   period:    period:<startDate>
 *   dailyLog:  dailyLog:<date>
 *   profile:   profile:1
 *   setting:   setting:<key>
 *   insightPref: insightPref:<key>
 *   lifeEvent: lifeEvent:<date>:<type>:<createdAt>
 * 自然键在绝大多数情况下稳定；若用户修改了 period 的 startDate（极少见），会当作新记录，
 * 旧记录在对端成为孤儿——Phase 2 v1 可接受，后续可升级为显式 syncId UUID。
 */

import { db, type Period, type DailyLog, type UserProfile, type LifeEvent } from '../db/client';
import { decryptRecord } from './crypto';

export interface LocalRecord {
  recordId: string;
  updatedAt: number;
  data: unknown;
}

/** 读取本地全部待同步数据，组织为带稳定 recordId 的记录数组 */
export async function collectLocalRecords(): Promise<LocalRecord[]> {
  const [periods, dailyLogs, profileRows, settings, insightPrefs, lifeEvents] = await Promise.all([
    db.periods.toArray(),
    db.dailyLogs.toArray(),
    db.userProfile.toArray(),
    db.settings.toArray(),
    db.insightPrefs.toArray(),
    db.lifeEvents.toArray(),
  ]);

  const records: LocalRecord[] = [];

  for (const p of periods as Period[]) {
    records.push({ recordId: `period:${p.startDate}`, updatedAt: p.updatedAt, data: p });
  }
  for (const d of dailyLogs as DailyLog[]) {
    records.push({ recordId: `dailyLog:${d.date}`, updatedAt: d.updatedAt, data: d });
  }
  const profile = (profileRows as UserProfile[])[0];
  if (profile) {
    records.push({ recordId: 'profile:1', updatedAt: profile.updatedAt, data: profile });
  }
  for (const s of settings) {
    records.push({ recordId: `setting:${s.key}`, updatedAt: Date.now(), data: s });
  }
  for (const ip of insightPrefs) {
    records.push({ recordId: `insightPref:${ip.key}`, updatedAt: Date.now(), data: ip });
  }
  for (const le of lifeEvents as LifeEvent[]) {
    records.push({
      recordId: `lifeEvent:${le.date}:${le.type}:${le.createdAt}`,
      updatedAt: le.updatedAt,
      data: le,
    });
  }
  return records;
}

/**
 * 将远端拉取的记录合并进本地（LWW：仅当远端 updatedAt 更大时覆盖）。
 * @param records 已解密的远端记录（来自 applyRemoteEncrypted）
 * @param isApplyingRemote 标记当前正处于远端合并，供 Dexie hook 跳过触发上传
 */
export async function applyRemoteRecords(
  records: { recordId: string; updatedAt: number; data: unknown }[],
  guard: { value: boolean },
): Promise<void> {
  guard.value = true;
  try {
    for (const rec of records) {
      await applyOne(rec);
    }
  } finally {
    guard.value = false;
  }
}

async function applyOne(rec: { recordId: string; updatedAt: number; data: unknown }): Promise<void> {
  const [type, ...rest] = rec.recordId.split(':');
  switch (type) {
    case 'period': {
      const startDate = rest.join(':');
      const data = rec.data as Period;
      const existing = await db.periods.where('startDate').equals(startDate).first();
      if (!existing || existing.updatedAt < rec.updatedAt) {
        const { id: _id, ...obj } = data;
        if (existing?.id) await db.periods.update(existing.id, obj);
        else await db.periods.add(obj as Period);
      }
      break;
    }
    case 'dailyLog': {
      const date = rest.join(':');
      const data = rec.data as DailyLog;
      const existing = await db.dailyLogs.where('date').equals(date).first();
      if (!existing || existing.updatedAt < rec.updatedAt) {
        const { id: _id, ...obj } = data;
        if (existing?.id) await db.dailyLogs.update(existing.id, obj);
        else await db.dailyLogs.add(obj as DailyLog);
      }
      break;
    }
    case 'profile': {
      const data = rec.data as UserProfile;
      const existing = (await db.userProfile.toArray())[0];
      if (!existing || existing.updatedAt < rec.updatedAt) {
        const { id: _id, ...obj } = data;
        if (existing?.id) await db.userProfile.update(existing.id, obj);
        else await db.userProfile.add(obj as UserProfile);
      }
      break;
    }
    case 'setting': {
      const key = rest.join(':');
      const data = rec.data as { key: string; value: unknown };
      const existing = await db.settings.get(key);
      const remoteUpdated = (rec.data as { updatedAt?: number }).updatedAt ?? rec.updatedAt;
      const localUpdated = (existing?.value as { updatedAt?: number })?.updatedAt;
      if (localUpdated == null || localUpdated < remoteUpdated) {
        await db.settings.put({ key, value: data.value });
      }
      break;
    }
    case 'insightPref': {
      const key = rest.join(':');
      const data = rec.data as { key: string; enabled: boolean };
      const existing = await db.insightPrefs.get(key);
      if (!existing || !existing.enabled !== !data.enabled) {
        await db.insightPrefs.put({ key, enabled: data.enabled });
      }
      break;
    }
    case 'lifeEvent': {
      // rest = [date, type, createdAt]
      const createdAt = Number(rest[rest.length - 1]);
      const data = rec.data as LifeEvent;
      const existing = await db.lifeEvents.where('createdAt').equals(createdAt).first();
      if (!existing || existing.updatedAt < rec.updatedAt) {
        const { id: _id, ...obj } = data;
        if (existing?.id) await db.lifeEvents.update(existing.id, obj);
        else await db.lifeEvents.add(obj as LifeEvent);
      }
      break;
    }
    default:
      break;
  }
}

/** 处理删除 tombstone：从本地删除对应记录 */
export async function applyRemoteDeletion(
  recordId: string,
  guard: { value: boolean },
): Promise<void> {
  guard.value = true;
  try {
    const [type, ...rest] = recordId.split(':');
    switch (type) {
      case 'period': {
        const startDate = rest.join(':');
        await db.periods.where('startDate').equals(startDate).delete();
        break;
      }
      case 'dailyLog': {
        const date = rest.join(':');
        await db.dailyLogs.where('date').equals(date).delete();
        break;
      }
      case 'setting': {
        await db.settings.delete(rest.join(':'));
        break;
      }
      case 'insightPref': {
        await db.insightPrefs.delete(rest.join(':'));
        break;
      }
      case 'lifeEvent': {
        const createdAt = Number(rest[rest.length - 1]);
        await db.lifeEvents.where('createdAt').equals(createdAt).delete();
        break;
      }
      // profile 不删除
      default:
        break;
    }
  } finally {
    guard.value = false;
  }
}

/** 解密远端记录（blob → data），供 store 在合并前调用 */
export async function decryptRemoteRecords(
  vaultKey: CryptoKey,
  records: { recordId: string; updatedAt: number; blob: string; hmac: string; deleted?: boolean }[],
): Promise<{ recordId: string; updatedAt: number; data: unknown }[]> {
  const out: { recordId: string; updatedAt: number; data: unknown }[] = [];
  for (const r of records) {
    if (r.deleted) continue;
    const data = await decryptRecord(vaultKey, r.blob);
    out.push({ recordId: r.recordId, updatedAt: r.updatedAt, data });
  }
  return out;
}
