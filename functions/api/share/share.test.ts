/**
 * functions/api/share/share.test.ts
 * Phase 4 伴侣加密共享端到端测试（fake D1 + 内存 R2 + 真实 WebCrypto 包裹）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../../test/fakeD1';
import type { D1Database, R2Bucket } from '../../utils/types';
import { onRequestGet as usersPubGet } from '../users/public-key';
import { onRequestPost as invitePost } from './invite';
import { onRequestGet as listGet } from './list';
import { onRequestPost as acceptPost } from './accept';
import { onRequestPut as sharePut, onRequestGet as shareGet, onRequestDelete as shareDelete } from './sync';
import { onRequestPost as revokePost } from './revoke';
import {
  generateUserKeyPair,
  importPublicKeySpki,
  wrapVaultKeyForUser,
  unwrapVaultKeyWithPrivate,
  generateVaultKey,
  encryptRecord,
  decryptRecord,
} from '../../../src/shared/sync/crypto';

const OWNER = 'owner-1';
const PARTNER = 'partner-1';
const OWNER_SESS = 'sess-owner';
const PARTNER_SESS = 'sess-partner';

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

function makeCtx(req: Request, db: D1Database, bucket: R2Bucket, _cookie?: string) {
  return {
    request: req,
    env: { DB: db, BUCKET: bucket },
    params: {},
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: () => Promise.resolve(new Response()),
    data: {},
  } as unknown as Parameters<typeof sharePut>[0];
}

function req(method: string, url: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = cookie ? { cookie } : {};
  return new Request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function seedUser(
  db: ReturnType<typeof createFakeD1>,
  id: string,
  sessId: string,
  opts: { entitled?: boolean; hasKeys?: boolean; email?: string } = {},
) {
  db.tables.users.push({
    id,
    google_id: `g-${id}`,
    apple_id: null,
    email: opts.email ?? `${id}@example.com`,
    name: id,
    picture: null,
    created_at: 1,
    last_login_at: 1,
    public_key: opts.hasKeys ? 'FAKE_PUB' : undefined,
    wrapped_private_key: opts.hasKeys ? 'FAKE_WPK' : undefined,
    private_key_salt: opts.hasKeys ? 'FAKE_SALT' : undefined,
  });
  db.tables.sessions.push({ id: sessId, user_id: id, expires_at: Date.now() + 1e9, created_at: 1 });
  if (opts.entitled) {
    db.tables.subscriptions.push({
      user_id: id, plan: 'plus', provider: 'paypal', provider_sub_id: null, billing_cycle: null, expires_at: null, created_at: 1,
    });
  }
}

describe('Phase 4 伴侣共享 — 公钥查询', () => {
  let db: ReturnType<typeof createFakeD1>;
  let bucket: ReturnType<typeof makeBucket>;
  beforeEach(() => {
    db = createFakeD1();
    bucket = makeBucket();
    seedUser(db, OWNER, OWNER_SESS, { entitled: true, hasKeys: true });
    seedUser(db, PARTNER, PARTNER_SESS, { hasKeys: true });
  });

  it('GET /api/users/public-key 返回对方公钥', async () => {
    const res = await usersPubGet(makeCtx(req('GET', `https://x/api/users/public-key?email=${PARTNER}@example.com`, undefined, `session=${OWNER_SESS}`), db, bucket));
    const j = await res.json();
    expect(j.publicKey).toBe('FAKE_PUB');
    expect(j.userId).toBe(PARTNER);
  });

  it('未知邮箱 → 404', async () => {
    const res = await usersPubGet(makeCtx(req('GET', 'https://x/api/users/public-key?email=ghost@example.com', undefined, `session=${OWNER_SESS}`), db, bucket));
    expect(res.status).toBe(404);
  });
});

describe('Phase 4 伴侣共享 — 邀请 / 接受 / 同步', () => {
  let db: ReturnType<typeof createFakeD1>;
  let bucket: ReturnType<typeof makeBucket>;

  // 真实密钥对（测试内持有双方私钥，模拟端到端零知识）
  let ownerKeys: Awaited<ReturnType<typeof generateUserKeyPair>>;
  let partnerKeys: Awaited<ReturnType<typeof generateUserKeyPair>>;

  beforeEach(async () => {
    db = createFakeD1();
    bucket = makeBucket();
    ownerKeys = await generateUserKeyPair();
    partnerKeys = await generateUserKeyPair();
    // 把真实公钥写入 fakeD1（私钥不入库，仅测试内持有）
    seedUser(db, OWNER, OWNER_SESS, { entitled: true, hasKeys: true, email: 'owner@example.com' });
    seedUser(db, PARTNER, PARTNER_SESS, { hasKeys: true, email: 'partner@example.com' });
    db.tables.users.find((u) => u.id === OWNER)!.public_key = ownerKeys.publicKeySpkiB64;
    db.tables.users.find((u) => u.id === PARTNER)!.public_key = partnerKeys.publicKeySpkiB64;
  });

  it('免费无权益用户发起邀请被 402 拦截', async () => {
    // owner 回落 free：清空订阅，且无 key_backup（不触发祖父条款）
    db.tables.subscriptions.length = 0;
    db.tables.key_backup.length = 0;

    const shared = await generateVaultKey();
    const ownerWrapped = await wrapVaultKeyForUser(shared, await importPublicKeySpki(ownerKeys.publicKeySpkiB64));
    const partnerWrapped = await wrapVaultKeyForUser(shared, await importPublicKeySpki(partnerKeys.publicKeySpkiB64));
    const res = await invitePost(
      makeCtx(req('POST', 'https://x/api/share/invite', { partnerEmail: 'partner@example.com', ownerWrapped, partnerWrapped }, `session=${OWNER_SESS}`), db, bucket),
    );
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe('upgrade_required');
  });

  it('邀请目标未启用加密同步 → 409 partner_not_ready', async () => {
    // partner 无公钥
    db.tables.users.find((u) => u.id === PARTNER)!.public_key = undefined;
    const shared = await generateVaultKey();
    const ownerWrapped = await wrapVaultKeyForUser(shared, await importPublicKeySpki(ownerKeys.publicKeySpkiB64));
    const partnerWrapped = await wrapVaultKeyForUser(shared, await importPublicKeySpki(ownerKeys.publicKeySpkiB64));
    const res = await invitePost(
      makeCtx(req('POST', 'https://x/api/share/invite', { partnerEmail: 'partner@example.com', ownerWrapped, partnerWrapped }, `session=${OWNER_SESS}`), db, bucket),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('partner_not_ready');
  });

  it('完整链路：邀请 → 接受 → 双方加解密共享数据 → 撤销后伴侣无法访问', async () => {
    // 1) 邀请（owner 用双方公钥包裹共享 vault 密钥）
    const shared = await generateVaultKey();
    const ownerPub = await importPublicKeySpki(ownerKeys.publicKeySpkiB64);
    const partnerPub = await importPublicKeySpki(partnerKeys.publicKeySpkiB64);
    const ownerWrapped = await wrapVaultKeyForUser(shared, ownerPub);
    const partnerWrapped = await wrapVaultKeyForUser(shared, partnerPub);

    const inv = await invitePost(
      makeCtx(req('POST', 'https://x/api/share/invite', { partnerEmail: 'partner@example.com', ownerWrapped, partnerWrapped }, `session=${OWNER_SESS}`), db, bucket),
    );
    expect(inv.status).toBe(200);
    const { vaultId } = await inv.json();

    // 2) owner 视图：partner 为 pending
    const ownerList = await listGet(makeCtx(req('GET', 'https://x/api/share/list', undefined, `session=${OWNER_SESS}`), db, bucket));
    const ol = await ownerList.json();
    expect(ol.vaults).toHaveLength(1);
    expect(ol.vaults[0].status).toBe('active');
    expect(ol.vaults[0].partner.status).toBe('pending');

    // 3) partner 接受（免费用户即可）
    const acc = await acceptPost(makeCtx(req('POST', 'https://x/api/share/accept', { vaultId }, `session=${PARTNER_SESS}`), db, bucket));
    expect((await acc.json()).ok).toBe(true);

    const partnerList = await listGet(makeCtx(req('GET', 'https://x/api/share/list', undefined, `session=${PARTNER_SESS}`), db, bucket));
    const pl = await partnerList.json();
    expect(pl.vaults[0].status).toBe('active');

    // 4) owner 推送一条共享记录
    const payload = { note: '共享给伴侣的私密记录', count: 3 };
    const { blob, hmac } = await encryptRecord(shared, payload);
    const push = await sharePut(
      makeCtx(req('PUT', `https://x/api/share/sync?vaultId=${vaultId}`, { records: [{ recordId: 'profile:1', updatedAt: 100, blob, hmac }] }, `session=${OWNER_SESS}`), db, bucket),
    );
    expect((await push.json()).applied).toBe(1);

    // 5) partner 拉取并解密（用自身私钥解开共享 vault 密钥）
    const partnerSharedKey = await unwrapVaultKeyWithPrivate(
      pl.vaults[0].wrappedVaultKey,
      partnerKeys.privateKey,
    );
    const pull = await shareGet(makeCtx(req('GET', `https://x/api/share/sync?vaultId=${vaultId}`, undefined, `session=${PARTNER_SESS}`), db, bucket));
    const pj = await pull.json();
    expect(pj.records).toHaveLength(1);
    const decrypted = await decryptRecord(partnerSharedKey, pj.records[0].blob);
    expect(decrypted).toEqual(payload);

    // 6) owner 撤销 partner（先重加密：用新密钥重推同记录，再提交新包裹密钥）
    const newShared = await generateVaultKey();
    const newOwnerWrapped = await wrapVaultKeyForUser(newShared, ownerPub);
    const { blob: newBlob, hmac: newHmac } = await encryptRecord(newShared, payload);
    await sharePut(
      makeCtx(req('PUT', `https://x/api/share/sync?vaultId=${vaultId}`, { records: [{ recordId: 'profile:1', updatedAt: 200, blob: newBlob, hmac: newHmac }] }, `session=${OWNER_SESS}`), db, bucket),
    );
    const rev = await revokePost(
      makeCtx(req('POST', 'https://x/api/share/revoke', { vaultId, memberUserId: PARTNER, newWrappedKeys: { [OWNER]: newOwnerWrapped }, newEpoch: 2 }, `session=${OWNER_SESS}`), db, bucket),
    );
    expect((await rev.json()).ok).toBe(true);

    // 7) 撤销后 partner 访问被拒
    const after = await shareGet(makeCtx(req('GET', `https://x/api/share/sync?vaultId=${vaultId}`, undefined, `session=${PARTNER_SESS}`), db, bucket));
    expect(after.status).toBe(403);
    // 且 partner 的成员行已被删除
    const afterList = await listGet(makeCtx(req('GET', 'https://x/api/share/list', undefined, `session=${PARTNER_SESS}`), db, bucket));
    expect((await afterList.json()).vaults).toHaveLength(0);
  });

  it('pending 状态的伴侣无法同步（需先 accept）', async () => {
    const shared = await generateVaultKey();
    const ownerWrapped = await wrapVaultKeyForUser(shared, await importPublicKeySpki(ownerKeys.publicKeySpkiB64));
    const partnerWrapped = await wrapVaultKeyForUser(shared, await importPublicKeySpki(partnerKeys.publicKeySpkiB64));
    const inv = await invitePost(
      makeCtx(req('POST', 'https://x/api/share/invite', { partnerEmail: 'partner@example.com', ownerWrapped, partnerWrapped }, `session=${OWNER_SESS}`), db, bucket),
    );
    const { vaultId } = await inv.json();
    // partner 未 accept，直接同步 → 403
    const denied = await shareGet(makeCtx(req('GET', `https://x/api/share/sync?vaultId=${vaultId}`, undefined, `session=${PARTNER_SESS}`), db, bucket));
    expect(denied.status).toBe(403);
  });

  it('DELETE 创建墓碑，GET 回报 deleted', async () => {
    const shared = await generateVaultKey();
    const ownerWrapped = await wrapVaultKeyForUser(shared, await importPublicKeySpki(ownerKeys.publicKeySpkiB64));
    const partnerWrapped = await wrapVaultKeyForUser(shared, await importPublicKeySpki(partnerKeys.publicKeySpkiB64));
    const inv = await invitePost(
      makeCtx(req('POST', 'https://x/api/share/invite', { partnerEmail: 'partner@example.com', ownerWrapped, partnerWrapped }, `session=${OWNER_SESS}`), db, bucket),
    );
    const { vaultId } = await inv.json();
    await acceptPost(makeCtx(req('POST', 'https://x/api/share/accept', { vaultId }, `session=${PARTNER_SESS}`), db, bucket));

    const { blob, hmac } = await encryptRecord(shared, { x: 1 });
    await sharePut(makeCtx(req('PUT', `https://x/api/share/sync?vaultId=${vaultId}`, { records: [{ recordId: 'dailyLog:2026-03-03', updatedAt: 50, blob, hmac }] }, `session=${OWNER_SESS}`), db, bucket));
    const del = await shareDelete(makeCtx(req('DELETE', `https://x/api/share/sync?vaultId=${vaultId}&recordId=dailyLog:2026-03-03`, undefined, `session=${OWNER_SESS}`), db, bucket));
    expect((await del.json()).ok).toBe(true);

    const pull = await shareGet(makeCtx(req('GET', `https://x/api/share/sync?vaultId=${vaultId}`, undefined, `session=${OWNER_SESS}`), db, bucket));
    const pj = await pull.json();
    expect(pj.records).toHaveLength(1);
    expect(pj.records[0].deleted).toBe(true);
  });
});
