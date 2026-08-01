/**
 * functions/api/billing/webhook.ts
 * Phase 3：PayPal Webhook 接收与处理（沙箱/生产通用）。
 *
 *  POST /api/billing/webhook
 *  1) 用 PayPal 官方 verify-webhook-signature 端点校验签名（防伪造）
 *  2) 按 event_type 处理：
 *     - PAYMENT.CAPTURE.COMPLETED  → Founder 一次性完成，写 plan=founder（永久）
 *     - BILLING.SUBSCRIPTION.ACTIVATED → Plus 激活，写 plan=plus，expires_at=下次续费时间
 *     - BILLING.SUBSCRIPTION.CANCELLED / SUSPENDED / PAYMENT.FAILED → 标记过期（plan 回落 free）
 *  幂等：subscription 用 upsert，重复投递不重复开通。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { upsertSubscription, getSubscription } from '../../utils/subscription-db';
import { buildPayPalConfig, verifyWebhookSignature, type WebhookHeaders } from '../../utils/paypal';

interface Env {
  DB: D1Database;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
  PAYPAL_WEBHOOK_ID?: string;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(init?.headers || {}) },
  });
}

function extractCustomId(resource: Record<string, unknown>): string | undefined {
  if (typeof resource.custom_id === 'string') return resource.custom_id;
  const pu = (resource.purchase_units as Record<string, unknown>[] | undefined)?.[0];
  if (pu && typeof pu.custom_id === 'string') return pu.custom_id;
  return undefined;
}

/** 标记订阅过期（不删行，留 provider_sub_id 便于排查），plan 经 getSyncEntitlement 回落 free */
async function expireSubscription(db: D1Database, userId: string, providerSubId: string): Promise<void> {
  const existing = await getSubscription(db, userId);
  // 仅当该行确实属于该订阅时才过期，避免误伤 founder 永久档
  if (existing && existing.provider_sub_id === providerSubId) {
    await upsertSubscription(db, userId, {
      plan: existing.plan,
      provider: existing.provider,
      provider_sub_id: existing.provider_sub_id,
      expires_at: Date.now(), // 过期 → getSyncEntitlement 视为 free
    });
  }
}

export const onRequestPost: Handler = async (context) => {
  const rawBody = await context.request.text();

  const headers: WebhookHeaders = {
    transmissionId: context.request.headers.get('paypal-transmission-id') || '',
    transmissionTime: context.request.headers.get('paypal-transmission-time') || '',
    certUrl: context.request.headers.get('paypal-cert-url') || '',
    authAlgo: context.request.headers.get('paypal-auth-algo') || '',
    transmissionSig: context.request.headers.get('paypal-transmission-sig') || '',
    eventType: context.request.headers.get('paypal-event-type') || '',
  };

  const cfg = buildPayPalConfig(context.env as unknown as Record<string, unknown>);
  if (!cfg) {
    return json({ error: 'paypal_not_configured' }, { status: 503 });
  }

  const verified = await verifyWebhookSignature(cfg, headers, rawBody);
  if (!verified) {
    return json({ error: 'webhook_signature_invalid' }, { status: 401 });
  }

  let event: { event_type?: string; resource?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid_body' }, { status: 400 });
  }

  const eventType = event.event_type;
  const resource = event.resource || {};
  const userId = extractCustomId(resource);
  if (!userId) {
    // 无法定位用户（如订阅事件缺 custom_id），记录但不报错（PayPal 需要 200）
    console.warn('[webhook] event without custom_id:', eventType);
    return json({ received: true, skipped: 'no_custom_id' });
  }

  try {
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const orderId =
          (resource.supplementary_data as Record<string, unknown> | undefined)?.related_ids != null
            ? ((resource.supplementary_data as Record<string, unknown>).related_ids as Record<string, string>)
                .order_id
            : (resource.id as string);
        await upsertSubscription(context.env.DB, userId, {
          plan: 'founder',
          provider: 'paypal',
          provider_sub_id: orderId,
          expires_at: null,
        });
        break;
      }
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subId = resource.id as string;
        const nextBilling = (resource.billing_info as Record<string, unknown> | undefined)?.next_billing_time as
          | string
          | undefined;
        const expiresAt = nextBilling ? Date.parse(nextBilling) : null;
        await upsertSubscription(context.env.DB, userId, {
          plan: 'plus',
          provider: 'paypal',
          provider_sub_id: subId,
          expires_at: expiresAt,
        });
        break;
      }
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'PAYMENT.SUBSCRIPTION.PAYMENT.FAILED': {
        const subId = resource.id as string;
        await expireSubscription(context.env.DB, userId, subId);
        break;
      }
      default:
        // 其它事件类型（如 PAYMENT.CAPTURE.REFUNDED）暂不处理
        break;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error('[webhook] processing failed:', detail);
    // 仍返回 200，避免 PayPal 重投风暴；错误已记录
    return json({ received: true, error: detail });
  }

  return json({ received: true });
};
