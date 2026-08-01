/**
 * functions/api/billing/capture-order.ts
 * Phase 3：捕获 Founder 一次性订单并写入订阅（founder / 永久）。
 *
 *  POST /api/billing/capture-order  { orderId }
 *  先校验订单 custom_id 归属当前用户（防越权捕获他人订单），再捕获并 upsert 订阅。
 *  PayPal webhook PAYMENT.CAPTURE.COMPLETED 也会写一次（幂等 upsert），二者不冲突。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { upsertSubscription } from '../../utils/subscription-db';
import { buildPayPalConfig, captureOrder, getOrder } from '../../utils/paypal';

interface Env {
  DB: D1Database;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
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

    let body: { orderId?: string };
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }
    const orderId = body.orderId;
    if (typeof orderId !== 'string') return json({ error: 'invalid_body' }, { status: 400 });

    const cfg = buildPayPalConfig(context.env as unknown as Record<string, unknown>);
    if (!cfg) return json({ error: 'paypal_not_configured' }, { status: 503 });

    // 校验订单归属：custom_id 必须等于当前用户，否则拒绝（防越权）
    const order = await getOrder(cfg, orderId);
    if (order.customId !== userId) {
      return json({ error: 'order_mismatch' }, { status: 403 });
    }

    const result = await captureOrder(cfg, orderId);
    if (result.status !== 'COMPLETED') {
      return json({ error: 'capture_not_completed', status: result.status }, { status: 402 });
    }

    await upsertSubscription(context.env.DB, userId, {
      plan: 'founder',
      provider: 'paypal',
      provider_sub_id: orderId,
      expires_at: null,
    });

    return json({ ok: true, plan: 'founder', expiresAt: null });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'billing_error', detail }, { status: 500 });
  }
};
