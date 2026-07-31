/**
 * functions/api/sync.ts
 * E2EE 同步核心端点（Phase 2）。
 *
 *  PUT    /api/sync          上传增量加密记录（逐条 LWW：updated_at 大者覆盖）
 *  GET    /api/sync?since=    增量拉取（since 省略则全量快照）；服务端只回传 opaque blob
 *  DELETE /api/sync?recordId= 删除 tombstone（标记 __deleted__，对端据此删除本地记录）
 *
 * 服务端不解密、不校验内容，只当 opaque blob 存储；HMAC 由客户端生成/校验。
 */

import type { PagesFunctionContext, D1Database, R2Bucket, SyncRecordInput } from '../utils/types';
import { getUserId } from '../utils/auth';
import { getSyncMeta, upsertSyncMeta, listSyncMeta } from '../utils/sync-db';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

const DELETED_MARKER = '__deleted__';

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init?.headers || {}),
    },
  });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function r2Key(userId: string, recordId: string): string {
  return `${userId}/${recordId}`;
}

export const onRequestPut: Handler = async (context) => {
  const userId = await getUserId(context.request, context.env.DB);
  if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

  let body: { records?: SyncRecordInput[] };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!Array.isArray(body.records)) {
    return json({ error: 'invalid_body' }, { status: 400 });
  }

  let applied = 0;
  let skipped = 0;

  for (const rec of body.records) {
    if (typeof rec?.recordId !== 'string' || typeof rec?.updatedAt !== 'number') {
      skipped++;
      continue;
    }
    const existing = await getSyncMeta(context.env.DB, userId, rec.recordId);
    // LWW：服务端已有更新或相等版本 → 跳过
    if (existing && existing.updated_at >= rec.updatedAt) {
      skipped++;
      continue;
    }

    const key = r2Key(userId, rec.recordId);
    if (rec.deleted) {
      await context.env.BUCKET.delete(key);
      await upsertSyncMeta(context.env.DB, userId, {
        record_id: rec.recordId,
        updated_at: rec.updatedAt,
        blob_ref: '',
        hmac: DELETED_MARKER,
      });
    } else {
      if (typeof rec.blob !== 'string') {
        skipped++;
        continue;
      }
      await context.env.BUCKET.put(key, b64ToBytes(rec.blob));
      await upsertSyncMeta(context.env.DB, userId, {
        record_id: rec.recordId,
        updated_at: rec.updatedAt,
        blob_ref: key,
        hmac: rec.hmac ?? '',
      });
    }
    applied++;
  }

  return json({ ok: true, applied, skipped });
};

export const onRequestGet: Handler = async (context) => {
  const userId = await getUserId(context.request, context.env.DB);
  if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

  const sinceParam = new URL(context.request.url).searchParams.get('since');
  const since = sinceParam ? Number(sinceParam) : undefined;
  const metas = await listSyncMeta(context.env.DB, userId, since);

  const records: Array<{
    recordId: string;
    updatedAt: number;
    blob?: string;
    hmac: string;
    deleted?: boolean;
  }> = [];

  for (const meta of metas) {
    if (meta.hmac === DELETED_MARKER) {
      records.push({
        recordId: meta.record_id,
        updatedAt: meta.updated_at,
        hmac: DELETED_MARKER,
        deleted: true,
      });
      continue;
    }
    const obj = await context.env.BUCKET.get(meta.blob_ref);
    if (!obj) continue; // 孤立索引，跳过
    const buf = await obj.arrayBuffer();
    records.push({
      recordId: meta.record_id,
      updatedAt: meta.updated_at,
      blob: bytesToB64(new Uint8Array(buf)),
      hmac: meta.hmac,
    });
  }

  return json({ ok: true, records, serverTime: Date.now() });
};

export const onRequestDelete: Handler = async (context) => {
  const userId = await getUserId(context.request, context.env.DB);
  if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

  const recordId = new URL(context.request.url).searchParams.get('recordId');
  if (!recordId) return json({ error: 'missing_record_id' }, { status: 400 });

  const key = r2Key(userId, recordId);
  await context.env.BUCKET.delete(key);
  await upsertSyncMeta(context.env.DB, userId, {
    record_id: recordId,
    updated_at: Date.now(),
    blob_ref: '',
    hmac: DELETED_MARKER,
  });

  return json({ ok: true });
};
