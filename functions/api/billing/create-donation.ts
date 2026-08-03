/**
 * functions/api/billing/create-donation.ts
 * 打赏（捐赠）一次性 PayPal 订单创建。
 *
 *  POST /api/billing/create-donation  { amountUsd }
 *  匿名（不要求登录），custom_id 用 donation:<anonUuid> 标记，便于 webhook 区分、不写 entitlement。
 *  金额仅做基础格式校验（正数、≤2 位小数、>0），不设定业务上限（产品决策：用户自选任意金额）。
 *  不预写任何 subscription。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { buildPayPalConfig, createOrder } from '../../utils/paypal';

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
    let body: { amountUsd?: unknown };
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    const raw = body.amountUsd;
    // 基础格式校验：必须为正数、≤2 位小数、>0。不设定业务上限（产品决策）。
    if (typeof raw !== 'string' || !/^\d+(\.\d{1,2})?$/.test(raw) || !(Number(raw) > 0)) {
      return json({ error: 'invalid_amount' }, { status: 400 });
    }

    const cfg = buildPayPalConfig(context.env as unknown as Record<string, unknown>);
    if (!cfg) return json({ error: 'paypal_not_configured' }, { status: 503 });

    const anonId = crypto.randomUUID();
    const { orderId, approveUrl } = await createOrder(cfg, {
      amountUsd: raw,
      description: 'Lumi Donation',
      customId: `donation:${anonId}`,
    });
    return json({ orderId, approveUrl });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'billing_error', detail }, { status: 500 });
  }
};
