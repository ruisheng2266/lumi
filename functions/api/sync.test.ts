/**
 * functions/api/sync.test.ts
 * Phase 2 同步端点的端到端测试（fake D1 + 内存 R2）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../test/fakeD1';
import type { D1Database, R2Bucket } from '../utils/types';
import { onRequestGet as setupGet, onRequestPost as setupPost } from './sync-setup';
import { onRequestPut, onRequestGet, onRequestDelete } from './sync';
import { onRequestPut as recoveryPut } from './recovery';
import { onRequestPost as redeemPost } from './recovery-redeem';

const USER_ID = 'user-1';
const SESSION_ID = 'sess-1';

function b64(s: string): string {
  return btoa(s);
}

function makeBucket(): R2Bucket & { _store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>();
  return {
    _store: store,
    async put(key: string, value: ArrayBuffer | ArrayBufferView | string | ReadableStream) {
      let bytes: Uint8Array;
      if (value instanceof Uint8Array) bytes = value;
      else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
      else if (typeof value === 'string') bytes = new TextEncoder().encode(value);
      else bytes = new Uint8Array(value as unknown as ArrayBuffer);
      store.set(key, bytes);
      return { etag: 'x' };
    },
    async get(key: string) {
      const v = store.get(key);
      if (!v) return null;
      return { key, arrayBuffer: async () => v.slice().buffer as ArrayBuffer };
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function makeCtx(req: Request, db: D1Database, bucket: R2Bucket) {
  return {
    request: req,
    env: { DB: db, BUCKET: bucket },
    params: {},
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: () => Promise.resolve(new Response()),
    data: {},
  } as unknown as Parameters<typeof onRequestPut>[0];
}

function req(method: string, url: string, body?: unknown, cookie = `session=${SESSION_ID}`) {
  const headers: Record<string, string> = cookie ? { cookie } : {};
  return new Request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Phase 2 sync endpoints', () => {
  let db: ReturnType<typeof createFakeD1>;
  let bucket: ReturnType<typeof makeBucket>;

  beforeEach(() => {
    db = createFakeD1();
    db.tables.users.push({
      id: USER_ID,
      google_id: 'g1',
      apple_id: null,
      email: 'a@b.c',
      name: 'x',
      picture: null,
      created_at: 1,
      last_login_at: 1,
    });
    db.tables.sessions.push({ id: SESSION_ID, user_id: USER_ID, expires_at: Date.now() + 1e9, created_at: 1 });
    // Phase 3：同步改为 Plus 专属，这些测试以"已订阅（entitled）用户"身份验证同步机制本身，
    // 权益门控逻辑由 billing.test.ts 单独覆盖。
    db.tables.subscriptions.push({
      user_id: USER_ID, plan: 'plus', provider: 'paypal', provider_sub_id: null, expires_at: null, created_at: 1,
    });
    bucket = makeBucket();
  });

  it('setup GET reports not initialized, then initialized after POST', async () => {
    const g0 = await setupGet(makeCtx(req('GET', 'https://x/api/sync-setup'), db, bucket));
    expect((await g0.json()).initialized).toBe(false);

    const p = await setupPost(
      makeCtx(
        req('POST', 'https://x/api/sync-setup', {
          wrappedVaultKey: b64('wrappedvault'),
          salt: b64('salt'),
          recoveryCodes: [{ codeHash: 'h1', wrappedVaultKey: b64('rc1') }],
        }),
        db,
        bucket,
      ),
    );
    expect((await p.json()).ok).toBe(true);

    const g1 = await setupGet(makeCtx(req('GET', 'https://x/api/sync-setup'), db, bucket));
    const j = await g1.json();
    expect(j.initialized).toBe(true);
    expect(j.wrappedVaultKey).toBe(b64('wrappedvault'));
    expect(j.salt).toBe(b64('salt'));
  });

  it('PUT applies LWW (higher updatedAt wins, lower skipped)', async () => {
    const bA = b64('blobA');
    const bB = b64('blobB');
    const bC = b64('blobC');
    const rec = (updatedAt: number, blob: string) => ({
      records: [{ recordId: 'period:2026-01-01', updatedAt, blob, hmac: `h${updatedAt}` }],
    });
    const put1 = await onRequestPut(makeCtx(req('PUT', 'https://x/api/sync', rec(100, bA)), db, bucket));
    expect((await put1.json()).applied).toBe(1);

    const put2 = await onRequestPut(makeCtx(req('PUT', 'https://x/api/sync', rec(200, bB)), db, bucket));
    expect((await put2.json()).applied).toBe(1);

    // 更低版本应被跳过
    const put3 = await onRequestPut(makeCtx(req('PUT', 'https://x/api/sync', rec(150, bC)), db, bucket));
    const r3 = await put3.json();
    expect(r3.applied).toBe(0);
    expect(r3.skipped).toBe(1);

    const getRes = await onRequestGet(makeCtx(req('GET', 'https://x/api/sync'), db, bucket));
    const gj = await getRes.json();
    expect(gj.records).toHaveLength(1);
    expect(gj.records[0].blob).toBe(bB);
  });

  it('DELETE creates a tombstone that GET reports as deleted', async () => {
    await onRequestPut(
      makeCtx(
        req('PUT', 'https://x/api/sync', {
          records: [{ recordId: 'dailyLog:2026-02-02', updatedAt: 300, blob: b64('blobD'), hmac: 'h300' }],
        }),
        db,
        bucket,
      ),
    );
    const del = await onRequestDelete(
      makeCtx(req('DELETE', 'https://x/api/sync?recordId=dailyLog:2026-02-02'), db, bucket),
    );
    expect((await del.json()).ok).toBe(true);

    const getRes = await onRequestGet(makeCtx(req('GET', 'https://x/api/sync'), db, bucket));
    const gj = await getRes.json();
    expect(gj.records).toHaveLength(1);
    expect(gj.records[0].deleted).toBe(true);
    expect(gj.records[0].blob).toBeUndefined();
  });

  it('recovery code reset: redeem → reset updates key_backup and consumes code', async () => {
    const raw = 'KX7G-9M2P-ABCD-EFGH';
    const codeHash = await sha256Hex(raw);
    await setupPost(
      makeCtx(
        req('POST', 'https://x/api/sync-setup', {
          wrappedVaultKey: b64('old'),
          salt: b64('salt'),
          recoveryCodes: [{ codeHash, wrappedVaultKey: b64('recovered') }],
        }),
        db,
        bucket,
      ),
    );

    // 1) redeem
    const redeem = await redeemPost(
      makeCtx(req('POST', 'https://x/api/recovery-redeem', { recoveryCode: raw }), db, bucket),
    );
    const rj = await redeem.json();
    expect(rj.wrappedVaultKey).toBe(b64('recovered'));
    expect(rj.salt).toBe(b64('salt'));

    // 2) reset
    const reset = await recoveryPut(
      makeCtx(
        req('PUT', 'https://x/api/recovery', {
          recoveryCode: raw,
          newWrappedVaultKey: b64('newkey'),
          newSalt: b64('salt'),
          newRecoveryCodes: [{ codeHash: 'h-new', wrappedVaultKey: b64('rc-new') }],
        }),
        db,
        bucket,
      ),
    );
    expect((await reset.json()).ok).toBe(true);

    const kb = db.tables.key_backup[0];
    expect(kb.wrapped_vault_key).toBe(b64('newkey'));
    expect(db.tables.recovery_codes[0].code_hash).toBe('h-new');
    expect(db.tables.recovery_codes.find((c) => c.code_hash === codeHash)?.used_at).not.toBeNull();
  });

  it('unauthorized without session cookie', async () => {
    const res = await onRequestGet(
      makeCtx(req('GET', 'https://x/api/sync-setup', undefined, ''), db, bucket),
    );
    expect(res.status).toBe(401);
  });
});
