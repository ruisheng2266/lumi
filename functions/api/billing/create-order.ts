/**
 * functions/api/billing/create-order.ts
 * Phase 3：创建 Founder（创始终身）一次性 PayPal 订单。
 *
 *  POST /api/billing/create-order  → { orderId, approveUrl }
 *  前端拿到 approveUrl 后打开让用户在 PayPal approve；
 *  完成后 PayPal 跳回 return_url，前端再调 capture-order 完成捕获并写入订阅。
 *  不在此预写订阅（避免未付款即解锁）。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { buildPayPalConfig, createOrder } from '../../utils/paypal';
import { PRICES } from '../../utils/billing-config';

interface Env {
  DB: D1Database;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
  PUBLIC_URL?: string;
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

    const cfg = buildPayPalConfig(context.env as unknown as Record<string, unknown>);
    if (!cfg) return json({ error: 'paypal_not_configured' }, { status: 503 });

    const { orderId, approveUrl } = await createOrder(cfg, {
      amountUsd: PRICES.founderUsd,
      description: 'Lumi Founder (lifetime)',
      customId: userId,
    });
    return json({ orderId, approveUrl });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'billing_error', detail }, { status: 500 });
  }
};
