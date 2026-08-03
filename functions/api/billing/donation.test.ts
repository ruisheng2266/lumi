/**
 * functions/api/billing/donation.test.ts
 * 打赏（Donation）后端测试：create-donation / capture-donation / webhook donation 跳过 entitlement。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFakeD1 } from '../../test/fakeD1';
import type { D1Database } from '../../utils/types';
import { onRequestPost as createDonationPost } from './create-donation';
import { onRequestPost as captureDonationPost } from './capture-donation';
import { onRequestPost as webhookPost } from './webhook';

const USER_ID = 'user-1';
const SESSION_ID = 'sess-1';

function makeBucket(): { _store: Map<string, Uint8Array>; put: any; get: any; delete: any } {
  const store = new Map<string, Uint8Array>();
  return {
    _store: store,
    async put(key: string, value: any) {
      store.set(key, value instanceof Uint8Array ? value : new TextEncoder().encode(String(value)));
      return { etag: 'x' };
    },
    async get(key: string) {
      const v = store.get(key);
      return v ? { key, arrayBuffer: async () => v.slice().buffer as ArrayBuffer } : null;
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function makeCtx(req: Request, db: D1Database, env: Record<string, unknown> = {}) {
  return {
    request: req,
    env: { DB: db, ...env },
    params: {},
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: () => Promise.resolve(new Response()),
    data: {},
  } as any;
}

function req(method: string, url: string, body?: unknown, cookie = `session=${SESSION_ID}`) {
  const headers: Record<string, string> = cookie ? { cookie } : {};
  return new Request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function seedUser(db: ReturnType<typeof createFakeD1>) {
  db.tables.users.push({
    id: USER_ID, google_id: 'g1', apple_id: null, email: 'a@b.c', name: 'x', picture: null,
    created_at: 1, last_login_at: 1,
  });
  db.tables.sessions.push({ id: SESSION_ID, user_id: USER_ID, expires_at: Date.now() + 1e9, created_at: 1 });
}

const PAYPAL_ENV = {
  PAYPAL_CLIENT_ID: 'cid',
  PAYPAL_CLIENT_SECRET: 'csecret',
  PAYPAL_MODE: 'sandbox',
  PAYPAL_PLUS_PLAN_ID: 'P-PLAN',
  PAYPAL_WEBHOOK_ID: 'WH-1',
  PUBLIC_URL: 'https://lumi365.com',
};

describe('Donation create-donation', () => {
  let db: ReturnType<typeof createFakeD1>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    db = createFakeD1();
    seedUser(db);
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(handler: (url: string, init: any) => any) {
    (globalThis as any).fetch = vi.fn(async (url: string, init?: any) => {
      const res = handler(url, init || {});
      return {
        ok: res.status < 400,
        status: res.status,
        json: async () => res.body,
        text: async () => JSON.stringify(res.body),
      } as any;
    });
  }

  it('custom amount (no auth) → returns approveUrl', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/v2/checkout/orders')) return { status: 201, body: { id: 'D1', links: [{ rel: 'approve', href: 'https://approve' }] } };
      return { status: 404, body: {} };
    });
    // cookie='' 模拟未登录（create-donation 本就不要求登录）
    const res = await createDonationPost(makeCtx(req('POST', 'https://x/api/billing/create-donation', { amountUsd: '3' }, ''), db, PAYPAL_ENV));
    const j = await res.json();
    expect(j.approveUrl).toBe('https://approve');
    expect(j.orderId).toBe('D1');
  });

  it('marks custom_id with donation: prefix', async () => {
    let captured: any = null;
    mockFetch((url, init) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/v2/checkout/orders')) {
        captured = JSON.parse(init.body);
        return { status: 201, body: { id: 'D1', links: [{ rel: 'approve', href: 'https://approve' }] } };
      }
      return { status: 404, body: {} };
    });
    await createDonationPost(makeCtx(req('POST', 'https://x/api/billing/create-donation', { amountUsd: '0.5' }, ''), db, PAYPAL_ENV));
    expect(captured.purchase_units[0].custom_id.startsWith('donation:')).toBe(true);
  });

  it('rejects invalid amount (400)', async () => {
    const res = await createDonationPost(makeCtx(req('POST', 'https://x/api/billing/create-donation', { amountUsd: '-5' }, ''), db, PAYPAL_ENV));
    expect(res.status).toBe(400);
    const res2 = await createDonationPost(makeCtx(req('POST', 'https://x/api/billing/create-donation', { amountUsd: 'abc' }, ''), db, PAYPAL_ENV));
    expect(res2.status).toBe(400);
  });
});

describe('Donation capture-donation', () => {
  let db: ReturnType<typeof createFakeD1>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    db = createFakeD1();
    seedUser(db);
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(handler: (url: string, init: any) => any) {
    (globalThis as any).fetch = vi.fn(async (url: string, init?: any) => {
      const res = handler(url, init || {});
      return {
        ok: res.status < 400,
        status: res.status,
        json: async () => res.body,
        text: async () => JSON.stringify(res.body),
      } as any;
    });
  }

  it('donation order → ok, no subscription written', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.endsWith('/D1')) return { status: 200, body: { purchase_units: [{ custom_id: 'donation:abc' }] } };
      if (url.includes('/capture')) return { status: 201, body: { id: 'D1', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'C1' }] } }] } };
      return { status: 404, body: {} };
    });
    const res = await captureDonationPost(makeCtx(req('POST', 'https://x/api/billing/capture-donation', { orderId: 'D1' }, ''), db, PAYPAL_ENV));
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(db.tables.subscriptions.length).toBe(0);
  });

  it('rejects non-donation order (403, prevents capturing others’ orders)', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.endsWith('/D1')) return { status: 200, body: { purchase_units: [{ custom_id: 'user-1' }] } };
      return { status: 404, body: {} };
    });
    const res = await captureDonationPost(makeCtx(req('POST', 'https://x/api/billing/capture-donation', { orderId: 'D1' }, ''), db, PAYPAL_ENV));
    expect(res.status).toBe(403);
  });
});

describe('Donation webhook safety', () => {
  let db: ReturnType<typeof createFakeD1>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    db = createFakeD1();
    seedUser(db);
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(handler: (url: string, init: any) => any) {
    (globalThis as any).fetch = vi.fn(async (url: string, init?: any) => {
      const res = handler(url, init || {});
      return {
        ok: res.status < 400,
        status: res.status,
        json: async () => res.body,
        text: async () => JSON.stringify(res.body),
      } as any;
    });
  }

  it('PAYMENT.CAPTURE.COMPLETED with donation: custom_id → writes NO subscription (no founder mislabel)', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/verify-webhook-signature')) return { status: 200, body: { verification_status: 'SUCCESS' } };
      return { status: 404, body: {} };
    });
    const event = {
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'CAPX', custom_id: 'donation:abc', supplementary_data: { related_ids: { order_id: 'DX' } } },
    };
    const r = new Request('https://x/api/billing/webhook', {
      method: 'POST',
      headers: {
        'paypal-transmission-id': 'T1', 'paypal-transmission-time': '1', 'paypal-cert-url': 'c',
        'paypal-auth-algo': 'a', 'paypal-transmission-sig': 's', 'paypal-event-type': 'PAYMENT.CAPTURE.COMPLETED',
      },
      body: JSON.stringify(event),
    });
    const res = await webhookPost(makeCtx(r, db, PAYPAL_ENV));
    const j = await res.json();
    expect(j.received).toBe(true);
    expect(j.skipped).toBe('donation');
    expect(db.tables.subscriptions.length).toBe(0);
  });
});
