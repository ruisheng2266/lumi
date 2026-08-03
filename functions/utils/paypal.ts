/**
 * functions/utils/paypal.ts
 * Phase 3 PayPal REST 客户端（沙箱/生产通用）。
 *
 * 设计：
 *  - 用 PAYPAL_MODE 切换 sandbox / live（沙箱先测，不真实扣款）。
 *  - Founder（创始终身）走 Orders API：创建订单 → 用户 approve → 捕获。
 *  - Plus（订阅）走 Subscriptions API：需预先在 PayPal 后台建 Plan，ID 存 PAYPAL_PLUS_PLAN_ID。
 *  - Webhook 校验用 PayPal 官方 verify-webhook-signature 端点（避免手写 CRC32/HMAC），
 *    校验失败直接拒绝，杜绝伪造事件。
 *
 * 所有对外请求都带超时（AbortController），避免 worker 挂死。
 */

export type PayPalMode = 'sandbox' | 'live';

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: PayPalMode;
  /** Plus 年付 Plan ID（PayPal 后台创建后填入，环境变量 PAYPAL_PLUS_PLAN_ID） */
  plusPlanIdAnnual?: string;
  /** Plus 月付 Plan ID（环境变量 PAYPAL_PLUS_PLAN_ID_MONTHLY） */
  plusPlanIdMonthly?: string;
  /** Webhook ID（PayPal 后台创建 webhook 时给出），用于签名校验 */
  webhookId?: string;
  /** 站点公开 URL，用于拼接 return/cancel 回调 */
  publicUrl: string;
}

function baseUrl(mode: PayPalMode): string {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

const TOKEN_TTL_MS = 300_000; // 5 分钟
let tokenCache: { token: string; expiresAt: number } | null = null;

async function fetchWithTimeout(url: string, init: RequestInit, ms = 15_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** 获取 / 复用 OAuth access token（client_credentials） */
export async function getAccessToken(cfg: PayPalConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }
  const basic = btoa(`${cfg.clientId}:${cfg.clientSecret}`);
  const res = await fetchWithTimeout(`${baseUrl(cfg.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`paypal_oauth_failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.min(data.expires_in * 1000, TOKEN_TTL_MS),
  };
  return data.access_token;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'PayPal-Request-Id': crypto.randomUUID(),
  };
}

export interface CreateOrderResult {
  orderId: string;
  approveUrl: string;
}

/** 查询订单详情（用于捕获前校验 custom_id 归属，防越权） */
export async function getOrder(cfg: PayPalConfig, orderId: string): Promise<{ customId?: string }> {
  const token = await getAccessToken(cfg);
  const res = await fetchWithTimeout(`${baseUrl(cfg.mode)}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`paypal_get_order_failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    purchase_units?: { custom_id?: string }[];
  };
  return { customId: data.purchase_units?.[0]?.custom_id };
}

/** 创建一次性订单（Founder 终身），返回 approve 链接 */
export async function createOrder(
  cfg: PayPalConfig,
  opts: { amountUsd: string; description: string; customId: string },
): Promise<CreateOrderResult> {
  const token = await getAccessToken(cfg);
  const res = await fetchWithTimeout(`${baseUrl(cfg.mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: opts.amountUsd },
          description: opts.description,
          custom_id: opts.customId,
        },
      ],
      application_context: {
        return_url: `${cfg.publicUrl}/settings?paypal=return`,
        cancel_url: `${cfg.publicUrl}/settings?paypal=cancel`,
        user_action: 'PAY_NOW',
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`paypal_create_order_failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    id: string;
    links: { rel: string; href: string }[];
  };
  const approve = data.links.find((l) => l.rel === 'approve');
  if (!approve) throw new Error('paypal_no_approve_link');
  return { orderId: data.id, approveUrl: approve.href };
}

export interface CaptureOrderResult {
  status: string;
  orderId: string;
  captureId?: string;
}

/** 捕获一次性订单（Founder），返回状态与 capture id */
export async function captureOrder(cfg: PayPalConfig, orderId: string): Promise<CaptureOrderResult> {
  const token = await getAccessToken(cfg);
  const res = await fetchWithTimeout(`${baseUrl(cfg.mode)}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`paypal_capture_failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    id: string;
    status: string;
    purchase_units?: { payments?: { captures?: { id: string }[] } }[];
  };
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return { status: data.status, orderId: data.id, captureId: capture?.id };
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  approveUrl: string;
}

/** 创建订阅（Plus），需预先建好 Plan，返回 approve 链接 */
export async function createSubscription(
  cfg: PayPalConfig,
  opts: { planId: string; customId: string },
): Promise<CreateSubscriptionResult> {
  if (!opts.planId) throw new Error('paypal_plus_plan_id_missing');
  const token = await getAccessToken(cfg);
  const res = await fetchWithTimeout(`${baseUrl(cfg.mode)}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      plan_id: opts.planId,
      custom_id: opts.customId,
      application_context: {
        return_url: `${cfg.publicUrl}/settings?paypal=return`,
        cancel_url: `${cfg.publicUrl}/settings?paypal=cancel`,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`paypal_create_subscription_failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    id: string;
    links: { rel: string; href: string }[];
  };
  const approve = data.links.find((l) => l.rel === 'approve');
  if (!approve) throw new Error('paypal_no_approve_link');
  return { subscriptionId: data.id, approveUrl: approve.href };
}

export interface WebhookHeaders {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  eventType: string;
}

/** 用 PayPal 官方端点校验 webhook 签名（避免手写 CRC32/HMAC） */
export async function verifyWebhookSignature(
  cfg: PayPalConfig,
  headers: WebhookHeaders,
  rawBody: string,
): Promise<boolean> {
  if (!cfg.webhookId) {
    // 未配置 webhook ID 时（如本地未接 PayPal）不做校验，仅用于开发；生产必须配置
    return false;
  }
  const token = await getAccessToken(cfg);
  const res = await fetchWithTimeout(`${baseUrl(cfg.mode)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      transmission_id: headers.transmissionId,
      transmission_time: headers.transmissionTime,
      cert_url: headers.certUrl,
      auth_algo: headers.authAlgo,
      transmission_sig: headers.transmissionSig,
      webhook_id: cfg.webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status: string };
  return data.verification_status === 'SUCCESS';
}

/** 从 env 构造 PayPalConfig（由各 billing 端点调用） */
export function buildPayPalConfig(env: Record<string, unknown>): PayPalConfig | null {
  const clientId = env.PAYPAL_CLIENT_ID as string | undefined;
  const clientSecret = env.PAYPAL_CLIENT_SECRET as string | undefined;
  const mode = ((env.PAYPAL_MODE as string) || 'sandbox') as PayPalMode;
  const publicUrl = (env.PUBLIC_URL as string) || 'https://lumi365.com';
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    mode,
    plusPlanIdAnnual: env.PAYPAL_PLUS_PLAN_ID as string | undefined,
    plusPlanIdMonthly: env.PAYPAL_PLUS_PLAN_ID_MONTHLY as string | undefined,
    webhookId: env.PAYPAL_WEBHOOK_ID as string | undefined,
    publicUrl,
  };
}
