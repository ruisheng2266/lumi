/**
 * functions/api/users/public-key.ts
 * 仅返回目标用户的公钥（明文、非敏感），用于伴侣共享的密钥投递。
 * 不返回姓名 / 邮箱 / 其他字段，保护隐私。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { findUserByEmail, getUserKeyMaterial } from '../../utils/db';
import { json } from '../../utils/http';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

export const onRequestGet: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    const email = new URL(context.request.url).searchParams.get('email');
    if (!email || !email.includes('@')) {
      return json({ error: 'missing_email' }, { status: 400 });
    }

    const target = await findUserByEmail(context.env.DB, email);
    if (!target) return json({ error: 'user_not_found' }, { status: 404 });
    const keys = await getUserKeyMaterial(context.env.DB, target.id);
    if (!keys?.publicKey) {
      // 对方尚未启用加密同步（无密钥对），无法接收共享
      return json({ error: 'user_not_ready' }, { status: 409 });
    }

    return json({ userId: target.id, publicKey: keys.publicKey });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};
