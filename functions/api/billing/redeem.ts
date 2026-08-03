/**
 * functions/api/billing/redeem.ts
 * Phase 3：用激活码兑换 Plus / Founder（国内过渡方案）。
 *
 *  POST /api/billing/redeem  { code }
 *  - 码明文 SHA-256 → 查 activation_codes；未找到 / 已用 / 过期均拒绝
 *  - 兑换成功：upsert 订阅（provider=code，永久），标记 used_by
 *  码明文仅一次性展示，服务端只存 hash。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { getActivationCode, redeemActivationCode, upsertSubscription } from '../../utils/subscription-db';
import { hashActivationCode } from '../../utils/billing-config';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(init?.headers || {}) },
  });
}

export const onRequestPost: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    let body: { code?: string };
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }
    const raw = body.code;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    const codeHash = await hashActivationCode(raw);
    const row = await getActivationCode(context.env.DB, codeHash);
    if (!row) return json({ error: 'invalid_code' }, { status: 404 });
    if (row.used_by != null) return json({ error: 'code_already_used' }, { status: 409 });
    if (row.expires_at != null && row.expires_at < Date.now()) {
      return json({ error: 'code_expired' }, { status: 410 });
    }

    // 兑换：写订阅（永久，expires_at=null，billing_cycle=null 非循环）+ 标记已用（幂等）
    await upsertSubscription(context.env.DB, userId, {
      plan: row.plan,
      provider: 'code',
      provider_sub_id: codeHash,
      billing_cycle: null,
      expires_at: null,
    });
    await redeemActivationCode(context.env.DB, userId, codeHash);

    return json({ ok: true, plan: row.plan, expiresAt: null });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'redeem_error', detail }, { status: 500 });
  }
};
