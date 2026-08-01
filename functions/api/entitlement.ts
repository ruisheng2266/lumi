/**
 * functions/api/entitlement.ts
 * Phase 3：返回当前登录用户的套餐与同步权益。
 *
 *  GET /api/entitlement  → { plan, expiresAt, syncEntitled }
 *   - plan: free | plus | founder
 *   - syncEntitled: 是否可使用跨设备同步（已订阅 或 祖父老用户）
 */

import type { PagesFunctionContext, D1Database } from '../utils/types';
import { getUserId } from '../utils/auth';
import { getSyncEntitlement } from '../utils/subscription-db';

interface Env {
  DB: D1Database;
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
  const userId = await getUserId(context.request, context.env.DB);
  if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

  try {
    const entitlement = await getSyncEntitlement(context.env.DB, userId);
    return json(entitlement);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};
