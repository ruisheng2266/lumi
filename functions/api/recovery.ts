/**
 * functions/api/recovery.ts
 * 恢复码管理（Phase 2）。
 *
 *  POST → 重新生成恢复码（需已登录 + 已解锁；用现有 vault 密钥生成新一组并整体替换）
 *         body: { recoveryCodes: [{ codeHash, wrappedVaultKey }] }
 *  PUT  → 用恢复码重置口令（遗忘 passphrase 时的兜底）
 *         body: { recoveryCode, newWrappedVaultKey, newSalt, newRecoveryCodes: [{ codeHash, wrappedVaultKey }] }
 *         服务端：校验 recoveryCode 的 hash 命中未使用记录 → 写入新 key_backup → 标记旧码已用 → 替换恢复码组
 */

import type { PagesFunctionContext, D1Database, R2Bucket } from '../utils/types';
import { getUserId } from '../utils/auth';
import {
  upsertKeyBackup,
  replaceRecoveryCodes,
  markRecoveryCodeUsed,
  findUnusedRecoveryCode,
} from '../utils/sync-db';

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

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const onRequestPost: Handler = async (context) => {
  const userId = await getUserId(context.request, context.env.DB);
  if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

  let body: { recoveryCodes?: { codeHash: string; wrappedVaultKey: string }[] };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!Array.isArray(body.recoveryCodes) || body.recoveryCodes.length === 0) {
    return json({ error: 'invalid_body' }, { status: 400 });
  }

  await replaceRecoveryCodes(
    context.env.DB,
    userId,
    body.recoveryCodes.map((c) => ({ code_hash: c.codeHash, wrapped_vault_key: c.wrappedVaultKey })),
  );
  return json({ ok: true });
};

export const onRequestPut: Handler = async (context) => {
  const userId = await getUserId(context.request, context.env.DB);
  if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

  let body: {
    recoveryCode?: string;
    newWrappedVaultKey?: string;
    newSalt?: string;
    newRecoveryCodes?: { codeHash: string; wrappedVaultKey: string }[];
  };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid_body' }, { status: 400 });
  }

  const { recoveryCode, newWrappedVaultKey, newSalt, newRecoveryCodes } = body;
  if (
    typeof recoveryCode !== 'string' ||
    typeof newWrappedVaultKey !== 'string' ||
    typeof newSalt !== 'string' ||
    !Array.isArray(newRecoveryCodes) ||
    newRecoveryCodes.length === 0
  ) {
    return json({ error: 'invalid_body' }, { status: 400 });
  }

  const codeHash = await sha256Hex(recoveryCode);
  const matched = await findUnusedRecoveryCode(context.env.DB, userId, codeHash);
  if (!matched) {
    return json({ error: 'invalid_recovery_code' }, { status: 401 });
  }

  await upsertKeyBackup(context.env.DB, userId, {
    wrapped_vault_key: newWrappedVaultKey,
    salt: newSalt,
  });
  await markRecoveryCodeUsed(context.env.DB, userId, codeHash);
  await replaceRecoveryCodes(
    context.env.DB,
    userId,
    newRecoveryCodes.map((c) => ({ code_hash: c.codeHash, wrapped_vault_key: c.wrappedVaultKey })),
  );

  return json({ ok: true });
};
