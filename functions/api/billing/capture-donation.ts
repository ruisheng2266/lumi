/**
 * functions/api/billing/capture-donation.ts
 * 打赏（捐赠）一次性订单捕获。
 *
 *  POST /api/billing/capture-donation  { orderId }
 *  匿名（不要求登录）。校验订单 custom_id 以 donation: 开头（防越权捕获他人订单），
 *  捕获但**不写任何 entitlement / subscription**。打赏仅表达支持，不解锁任何功能。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
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

    // 校验订单归属：custom_id 必须以 donation: 开头，否则拒绝（防越权捕获他人订单）
    const order = await getOrder(cfg, orderId);
    if (!order.customId || !order.customId.startsWith('donation:')) {
      return json({ error: 'order_mismatch' }, { status: 403 });
    }

    const result = await captureOrder(cfg, orderId);
    if (result.status !== 'COMPLETED') {
      return json({ error: 'capture_not_completed', status: result.status }, { status: 402 });
    }
    return json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'billing_error', detail }, { status: 500 });
  }
};
