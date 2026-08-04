/**
 * functions/api/share/keys.ts
 * 上报 / 补传当前用户的共享密钥对（Phase 4）。
 *
 * 用途：Phase 4 之前已启用加密同步的老用户没有密钥对，解锁同步时客户端会生成一对
 *      并调用本端点补传（惰性升级），避免必须重设口令。
 *
 * 零知识：public_key 是公开材料；wrapped_private_key 是「同步口令派生密钥」加密后的
 *        私钥密文，服务端无法解开。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { upsertUserKeys } from '../../utils/db';
import { json, isB64ish } from '../../utils/http';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

export const onRequestPost: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    // Phase 4（2026-08-04 修复）：任何登录用户都可上报共享密钥对——公钥公开、私钥由本人
    // 口令（或同步 vault 密钥）包裹，服务端无法解开。门控已移除，使「伴侣免费」可落地：
    // 免费伴侣无需启用付费的 E2EE 同步也能生成共享密钥对并接收共享。

    let body: { publicKey?: string; wrappedPrivateKey?: string; privateKeySalt?: string };
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    const { publicKey, wrappedPrivateKey, privateKeySalt } = body;
    if (
      typeof publicKey !== 'string' ||
      typeof wrappedPrivateKey !== 'string' ||
      typeof privateKeySalt !== 'string' ||
      !isB64ish(publicKey) ||
      !isB64ish(wrappedPrivateKey) ||
      !isB64ish(privateKeySalt)
    ) {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    await upsertUserKeys(context.env.DB, userId, {
      publicKey,
      wrappedPrivateKey,
      privateKeySalt,
    });
    return json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};
