/**
 * functions/api/billing/create-subscription.ts
 * Phase 3：创建 Plus 订阅（PayPal Subscriptions API），支持月付 / 年付分档。
 *
 *  POST /api/billing/create-subscription  { cycle?: 'monthly' | 'annual' }
 *    → { subscriptionId, approveUrl }
 *  需预先在 PayPal 后台创建对应 Plan：
 *    - 年付：PAYPAL_PLUS_PLAN_ID
 *    - 月付（含 7 天免费试用）：PAYPAL_PLUS_PLAN_ID_MONTHLY
 *  订阅激活由 webhook BILLING.SUBSCRIPTION.ACTIVATED 写入（此处不预写）。
 *  前端打开 approveUrl 完成授权后，轮询 /api/entitlement 直至 plan=plus。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { buildPayPalConfig, createSubscription } from '../../utils/paypal';

interface Env {
  DB: D1Database;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
  PAYPAL_PLUS_PLAN_ID?: string;
  PAYPAL_PLUS_PLAN_ID_MONTHLY?: string;
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

    let body: { cycle?: string } = {};
    try {
      body = await context.request.json();
    } catch {
      // 无 body 视为年付（向后兼容）
    }
    const cycle: 'monthly' | 'annual' = body.cycle === 'monthly' ? 'monthly' : 'annual';

    const planId =
      cycle === 'monthly' ? cfg.plusPlanIdMonthly : cfg.plusPlanIdAnnual;
    if (!planId) {
      return json(
        { error: 'paypal_plus_plan_missing', cycle },
        { status: 503 },
      );
    }

    const { subscriptionId, approveUrl } = await createSubscription(cfg, {
      planId,
      customId: userId,
    });
    return json({ subscriptionId, approveUrl, cycle });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'billing_error', detail }, { status: 500 });
  }
};
