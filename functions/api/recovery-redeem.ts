/**
 * functions/api/recovery-redeem.ts
 * 用恢复码换回「该恢复码包裹的 vault 密钥」与 salt（重置口令流程的第一步）。
 *
 *  POST { recoveryCode } → { wrappedVaultKey, salt }
 * 客户端用 recoveryCode 派生密钥解开 wrappedVaultKey 得到 vault 密钥，再用新 passphrase 重新包裹。
 * 仅当 recoveryCode 命中「未使用」记录才返回；返回的是密文，零知识不受影响。
 */

import type { PagesFunctionContext, D1Database, R2Bucket } from '../utils/types';
import { getUserId } from '../utils/auth';
import { getKeyBackup, findUnusedRecoveryCode } from '../utils/sync-db';

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

  let body: { recoveryCode?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid_body' }, { status: 400 });
  }
  if (typeof body.recoveryCode !== 'string') {
    return json({ error: 'invalid_body' }, { status: 400 });
  }

  const codeHash = await sha256Hex(body.recoveryCode);
  const matched = await findUnusedRecoveryCode(context.env.DB, userId, codeHash);
  if (!matched) return json({ error: 'invalid_recovery_code' }, { status: 401 });

  const backup = await getKeyBackup(context.env.DB, userId);
  if (!backup) return json({ error: 'no_backup' }, { status: 409 });

  return json({ wrappedVaultKey: matched.wrapped_vault_key, salt: backup.salt });
};
