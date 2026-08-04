/**
 * functions/api/sync-setup.ts
 * 同步密钥备份的初始化与查询（Phase 2）。
 *
 *  GET  → 返回该用户是否已初始化加密 vault（{ initialized }）
 *  POST → 首次启用同步时，由客户端上传：
 *           wrappedVaultKey (base64(iv||ct)，passphrase 包裹的 vault 密钥)
 *           salt            (base64，PBKDF2 salt)
 *           recoveryCodes   [{ codeHash, wrappedVaultKey }]（每个恢复码单独包裹的 vault 密钥）
 *         服务端只存密文，永远看不到明文 vault 密钥 / passphrase。
 */

import type { PagesFunctionContext, D1Database, R2Bucket } from '../utils/types';
import { getUserId } from '../utils/auth';
import { getKeyBackup, upsertKeyBackup, replaceRecoveryCodes } from '../utils/sync-db';
import { getSyncEntitlement } from '../utils/subscription-db';
import { getUserKeyMaterial, upsertUserKeys } from '../utils/db';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

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

export const onRequestGet: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    const backup = await getKeyBackup(context.env.DB, userId);
    if (!backup) return json({ initialized: false });
    // wrapped_vault_key / salt 是「passphrase 加密的密文」，对登录用户可见不破坏零知识
    const keys = await getUserKeyMaterial(context.env.DB, userId);
    return json({
      initialized: true,
      wrappedVaultKey: backup.wrapped_vault_key,
      salt: backup.salt,
      // 共享密钥材料：public_key 明文无碍；wrapped_private_key/salt 是口令加密密文，对登录用户可见不破坏零知识
      publicKey: keys?.publicKey ?? null,
      wrappedPrivateKey: keys?.wrappedPrivateKey ?? null,
      privateKeySalt: keys?.privateKeySalt ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync-setup GET]', msg, err);
    return json({ error: 'internal_error', detail: msg }, { status: 500 });
  }
};

export const onRequestPost: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    // Phase 3 门控：启用同步需具备同步权益（已订阅 或 祖父老用户）
    // 否则新免费用户可通过 POST 写入 key_backup 而被错误祖父化、永久白嫖同步
    const ent = await getSyncEntitlement(context.env.DB, userId);
    if (!ent.syncEntitled) {
      return json({ error: 'upgrade_required' }, { status: 402 });
    }

    let body: {
      wrappedVaultKey?: string;
      salt?: string;
      recoveryCodes?: { codeHash: string; wrappedVaultKey: string }[];
      publicKey?: string;
      wrappedPrivateKey?: string;
      privateKeySalt?: string;
    };
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    const { wrappedVaultKey, salt, recoveryCodes } = body;
    if (
      typeof wrappedVaultKey !== 'string' ||
      typeof salt !== 'string' ||
      !Array.isArray(recoveryCodes) ||
      recoveryCodes.length === 0
    ) {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

  // 基本格式校验：wrappedVaultKey 格式为 base64(iv)|base64(ct)，含管道符
  if (!/^[A-Za-z0-9+/=|]+$/.test(wrappedVaultKey) || !/^[A-Za-z0-9+/=]+$/.test(salt)) {
      return json({ error: 'invalid_encoding' }, { status: 400 });
    }
    for (const c of recoveryCodes) {
      if (typeof c?.codeHash !== 'string' || typeof c?.wrappedVaultKey !== 'string') {
        return json({ error: 'invalid_recovery_code' }, { status: 400 });
      }
    }

    await upsertKeyBackup(context.env.DB, userId, { wrapped_vault_key: wrappedVaultKey, salt });
    await replaceRecoveryCodes(
      context.env.DB,
      userId,
      recoveryCodes.map((c) => ({ code_hash: c.codeHash, wrapped_vault_key: c.wrappedVaultKey })),
    );

    // Phase 4：若客户端一并上报了共享密钥对（首次启用同步时生成），则存储
    const { publicKey, wrappedPrivateKey, privateKeySalt } = body;
    if (
      typeof publicKey === 'string' &&
      typeof wrappedPrivateKey === 'string' &&
      typeof privateKeySalt === 'string'
    ) {
      if (
        !/^[A-Za-z0-9+/=]+$/.test(publicKey) ||
        !/^[A-Za-z0-9+/=|]+$/.test(wrappedPrivateKey) ||
        !/^[A-Za-z0-9+/=]+$/.test(privateKeySalt)
      ) {
        return json({ error: 'invalid_encoding' }, { status: 400 });
      }
      await upsertUserKeys(context.env.DB, userId, {
        publicKey,
        wrappedPrivateKey,
        privateKeySalt,
      });
    }

    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync-setup POST]', msg, err);
    return json({ error: 'internal_error', detail: msg }, { status: 500 });
  }
};
