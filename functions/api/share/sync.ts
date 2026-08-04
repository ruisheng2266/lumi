/**
 * functions/api/share/sync.ts
 * 共享 vault 的加密同步端点（Phase 4），与 /api/sync 同构，作用域为 vault_id（非 user_id）。
 *
 *  GET    /api/share/sync?vaultId=    增量拉取共享记录（since 省略则全量）；仅 active 成员可访问
 *  PUT    /api/share/sync?vaultId=    上传增量加密记录（per-record LWW）
 *  DELETE /api/share/sync?vaultId=&recordId=  删除 tombstone
 *
 * 服务端不解密、不校验内容。门控为「是 active 成员」，伴侣免费用户也可同步。
 */

import type { PagesFunctionContext, D1Database, R2Bucket, SyncRecordInput } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { getMember, getSharedMeta, upsertSharedMeta, listSharedMeta, deleteSharedMeta } from '../../utils/share-db';
import { json, b64ToBytes, bytesToB64 } from '../../utils/http';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

const DELETED_MARKER = '__deleted__';

function r2Key(vaultId: string, recordId: string): string {
  return `shared/${vaultId}/${recordId}`;
}

export const onRequestPut: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    const vaultId = new URL(context.request.url).searchParams.get('vaultId') ?? '';
    if (!vaultId) return json({ error: 'missing_vault_id' }, { status: 400 });
    const member = await getMember(context.env.DB, vaultId, userId);
    if (!member || member.status !== 'active') {
      return json({ error: 'not_member' }, { status: 403 });
    }

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
      const existing = await getSharedMeta(context.env.DB, vaultId, rec.recordId);
      if (existing && existing.updated_at >= rec.updatedAt) {
        skipped++;
        continue;
      }
      const key = r2Key(vaultId, rec.recordId);
      if (rec.deleted) {
        await context.env.BUCKET.delete(key);
        await upsertSharedMeta(context.env.DB, vaultId, {
          vault_id: vaultId,
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
        await upsertSharedMeta(context.env.DB, vaultId, {
          vault_id: vaultId,
          record_id: rec.recordId,
          updated_at: rec.updatedAt,
          blob_ref: key,
          hmac: rec.hmac ?? '',
        });
      }
      applied++;
    }
    return json({ ok: true, applied, skipped });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};

export const onRequestGet: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    const vaultId = new URL(context.request.url).searchParams.get('vaultId') ?? '';
    if (!vaultId) return json({ error: 'missing_vault_id' }, { status: 400 });
    const member = await getMember(context.env.DB, vaultId, userId);
    if (!member || member.status !== 'active') {
      return json({ error: 'not_member' }, { status: 403 });
    }

    const sinceParam = new URL(context.request.url).searchParams.get('since');
    const since = sinceParam ? Number(sinceParam) : undefined;
    const metas = await listSharedMeta(context.env.DB, vaultId, since);

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
      if (!meta.blob_ref) {
        records.push({
          recordId: meta.record_id,
          updatedAt: meta.updated_at,
          hmac: meta.hmac || '',
          blob: '',
        });
        continue;
      }
      const obj = await context.env.BUCKET.get(meta.blob_ref);
      if (!obj) continue;
      const buf = await obj.arrayBuffer();
      records.push({
        recordId: meta.record_id,
        updatedAt: meta.updated_at,
        blob: bytesToB64(new Uint8Array(buf)),
        hmac: meta.hmac,
      });
    }
    return json({ ok: true, records, serverTime: Date.now() });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};

export const onRequestDelete: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    const url = new URL(context.request.url);
    const vaultId = url.searchParams.get('vaultId') ?? '';
    const recordId = url.searchParams.get('recordId');
    if (!vaultId || !recordId) return json({ error: 'missing_params' }, { status: 400 });
    const member = await getMember(context.env.DB, vaultId, userId);
    if (!member || member.status !== 'active') {
      return json({ error: 'not_member' }, { status: 403 });
    }

    await context.env.BUCKET.delete(r2Key(vaultId, recordId));
    await upsertSharedMeta(context.env.DB, vaultId, {
      vault_id: vaultId,
      record_id: recordId,
      updated_at: Date.now(),
      blob_ref: '',
      hmac: DELETED_MARKER,
    });
    return json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};
