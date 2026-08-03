/**
 * functions/api/billing/billing.test.ts
 * Phase 3 后端测试：entitlement / 激活码兑换 / 同步门控 / PayPal（mock fetch）/ webhook。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFakeD1 } from '../../test/fakeD1';
import type { D1Database } from '../../utils/types';
import { onRequestGet as entitlementGet } from '../entitlement';
import { onRequestPost as redeemPost } from './redeem';
import { onRequestPost as createSubscriptionPost } from './create-subscription';
import { onRequestPost as createOrderPost } from './create-order';
import { onRequestPost as captureOrderPost } from './capture-order';
import { onRequestPost as webhookPost } from './webhook';
import { onRequestPut as syncPut, onRequestGet as syncGet } from '../sync';
import { hashActivationCode, generateActivationCode } from '../../utils/billing-config';

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
  PAYPAL_PLUS_PLAN_ID_MONTHLY: 'P-PLAN-MONTHLY',
  PAYPAL_WEBHOOK_ID: 'WH-1',
  PUBLIC_URL: 'https://lumi365.com',
};

describe('Phase 3 entitlement & gating', () => {
  let db: ReturnType<typeof createFakeD1>;
  let bucket: ReturnType<typeof makeBucket>;

  beforeEach(() => {
    db = createFakeD1();
    bucket = makeBucket();
    seedUser(db);
  });

  it('free user without key_backup → syncEntitled false', async () => {
    const res = await entitlementGet(makeCtx(req('GET', 'https://x/api/entitlement'), db));
    const j = await res.json();
    expect(j.plan).toBe('free');
    expect(j.syncEntitled).toBe(false);
  });

  it('grandfathered user (has key_backup) → syncEntitled true even when free', async () => {
    db.tables.key_backup.push({
      user_id: USER_ID, wrapped_vault_key: 'x', salt: 'y', created_at: 1,
    });
    const res = await entitlementGet(makeCtx(req('GET', 'https://x/api/entitlement'), db));
    const j = await res.json();
    expect(j.plan).toBe('free');
    expect(j.syncEntitled).toBe(true);
  });

  it('sync PUT blocked (402) for non-entitled free user', async () => {
    const res = await syncPut(
      makeCtx(req('PUT', 'https://x/api/sync', { records: [{ recordId: 'r1', updatedAt: 1, blob: 'AAAA', hmac: 'h' }] }), db, { BUCKET: bucket }),
    );
    expect(res.status).toBe(402);
  });

  it('sync PUT allowed for grandfathered user', async () => {
    db.tables.key_backup.push({ user_id: USER_ID, wrapped_vault_key: 'x', salt: 'y', created_at: 1 });
    const res = await syncPut(
      makeCtx(req('PUT', 'https://x/api/sync', { records: [{ recordId: 'r1', updatedAt: 1, blob: 'AAAA', hmac: 'h' }] }), db, { BUCKET: bucket }),
    );
    const j = await res.json();
    expect(j.applied).toBe(1);
  });

  it('sync GET blocked (402) for non-entitled free user', async () => {
    const res = await syncGet(makeCtx(req('GET', 'https://x/api/sync'), db, { BUCKET: bucket }));
    expect(res.status).toBe(402);
  });
});

describe('Phase 3 activation code redeem', () => {
  let db: ReturnType<typeof createFakeD1>;

  beforeEach(() => {
    db = createFakeD1();
    seedUser(db);
  });

  it('valid code → subscription written (plan plus)', async () => {
    const plain = generateActivationCode();
    const hash = await hashActivationCode(plain);
    db.tables.activation_codes.push({
      code_hash: hash, plan: 'plus', expires_at: null, used_by: null, created_at: 1,
    });
    const res = await redeemPost(makeCtx(req('POST', 'https://x/api/billing/redeem', { code: plain }), db));
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.plan).toBe('plus');
    expect(db.tables.subscriptions[0].plan).toBe('plus');
    expect(db.tables.activation_codes[0].used_by).toBe(USER_ID);
  });

  it('invalid code → 404', async () => {
    const res = await redeemPost(makeCtx(req('POST', 'https://x/api/billing/redeem', { code: 'ZZZZZZ-ZZZZZZ' }), db));
    expect(res.status).toBe(404);
  });

  it('already used code → 409', async () => {
    const plain = generateActivationCode();
    const hash = await hashActivationCode(plain);
    db.tables.activation_codes.push({
      code_hash: hash, plan: 'founder', expires_at: null, used_by: 'other-user', created_at: 1,
    });
    const res = await redeemPost(makeCtx(req('POST', 'https://x/api/billing/redeem', { code: plain }), db));
    expect(res.status).toBe(409);
  });

  it('redeemed user becomes entitled to sync', async () => {
    const plain = generateActivationCode();
    const hash = await hashActivationCode(plain);
    db.tables.activation_codes.push({
      code_hash: hash, plan: 'plus', expires_at: null, used_by: null, created_at: 1,
    });
    await redeemPost(makeCtx(req('POST', 'https://x/api/billing/redeem', { code: plain }), db));
    const ent = await entitlementGet(makeCtx(req('GET', 'https://x/api/entitlement'), db));
    const j = await ent.json();
    expect(j.syncEntitled).toBe(true);
    expect(j.plan).toBe('plus');
  });
});

describe('Phase 3 PayPal (mocked fetch)', () => {
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

  it('create-order returns approveUrl', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/v2/checkout/orders')) return { status: 201, body: { id: 'O1', links: [{ rel: 'approve', href: 'https://approve' }] } };
      return { status: 404, body: {} };
    });
    const res = await createOrderPost(makeCtx(req('POST', 'https://x/api/billing/create-order', {}), db, PAYPAL_ENV));
    const j = await res.json();
    expect(j.approveUrl).toBe('https://approve');
    expect(j.orderId).toBe('O1');
  });

  it('capture-order verifies ownership then writes founder', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/v2/checkout/orders/O1') && url.endsWith('/O1')) {
        return { status: 200, body: { purchase_units: [{ custom_id: USER_ID }] } };
      }
      if (url.includes('/capture')) {
        return { status: 201, body: { id: 'O1', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'C1' }] } }] } };
      }
      return { status: 404, body: {} };
    });
    const res = await captureOrderPost(makeCtx(req('POST', 'https://x/api/billing/capture-order', { orderId: 'O1' }), db, PAYPAL_ENV));
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.plan).toBe('founder');
    expect(db.tables.subscriptions[0].plan).toBe('founder');
  });

  it('capture-order rejects mismatched ownership', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/v2/checkout/orders/O1')) {
        return { status: 200, body: { purchase_units: [{ custom_id: 'someone-else' }] } };
      }
      return { status: 404, body: {} };
    });
    const res = await captureOrderPost(makeCtx(req('POST', 'https://x/api/billing/capture-order', { orderId: 'O1' }), db, PAYPAL_ENV));
    expect(res.status).toBe(403);
  });

  it('webhook verifies signature and writes founder on CAPTURE.COMPLETED', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/verify-webhook-signature')) return { status: 200, body: { verification_status: 'SUCCESS' } };
      return { status: 404, body: {} };
    });
    const event = {
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'CAP1', custom_id: USER_ID, supplementary_data: { related_ids: { order_id: 'O1' } } },
    };
    const r = new Request('https://x/api/billing/webhook', {
      method: 'POST',
      headers: {
        cookie: `session=${SESSION_ID}`,
        'paypal-transmission-id': 'T1',
        'paypal-transmission-time': '1',
        'paypal-cert-url': 'c',
        'paypal-auth-algo': 'a',
        'paypal-transmission-sig': 's',
        'paypal-event-type': 'PAYMENT.CAPTURE.COMPLETED',
      },
      body: JSON.stringify(event),
    });
    const res = await webhookPost(makeCtx(r, db, PAYPAL_ENV));
    const j = await res.json();
    expect(j.received).toBe(true);
    expect(db.tables.subscriptions[0].plan).toBe('founder');
  });

  it('webhook rejects invalid signature', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/verify-webhook-signature')) return { status: 200, body: { verification_status: 'FAILURE' } };
      return { status: 404, body: {} };
    });
    const r = new Request('https://x/api/billing/webhook', {
      method: 'POST',
      headers: {
        cookie: `session=${SESSION_ID}`,
        'paypal-transmission-id': 'T1', 'paypal-transmission-time': '1', 'paypal-cert-url': 'c',
        'paypal-auth-algo': 'a', 'paypal-transmission-sig': 's', 'paypal-event-type': 'X',
      },
      body: JSON.stringify({ event_type: 'X', resource: {} }),
    });
    const res = await webhookPost(makeCtx(r, db, PAYPAL_ENV));
    expect(res.status).toBe(401);
  });

  it('webhook ACTIVATED writes plan=plus with next_billing_time expiry', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/verify-webhook-signature')) return { status: 200, body: { verification_status: 'SUCCESS' } };
      return { status: 404, body: {} };
    });
    const next = '2027-08-03T10:00:00Z';
    const event = {
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource: { id: 'I-TESTSUB', custom_id: USER_ID, billing_info: { next_billing_time: next } },
    };
    const r = new Request('https://x/api/billing/webhook', {
      method: 'POST',
      headers: {
        'paypal-transmission-id': 'T1', 'paypal-transmission-time': '1', 'paypal-cert-url': 'c',
        'paypal-auth-algo': 'a', 'paypal-transmission-sig': 's', 'paypal-event-type': 'BILLING.SUBSCRIPTION.ACTIVATED',
      },
      body: JSON.stringify(event),
    });
    const res = await webhookPost(makeCtx(r, db, PAYPAL_ENV));
    const j = await res.json();
    expect(j.received).toBe(true);
    expect(db.tables.subscriptions.length).toBe(1);
    expect(db.tables.subscriptions[0].plan).toBe('plus');
    expect(db.tables.subscriptions[0].provider_sub_id).toBe('I-TESTSUB');
    expect(db.tables.subscriptions[0].expires_at).toBe(Date.parse(next));
  });

  it('create-subscription monthly selects the monthly plan id', async () => {
    let sentBody: any = null;
    mockFetch((url, init) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/v1/billing/subscriptions')) {
        sentBody = JSON.parse(init.body);
        return { status: 201, body: { id: 'I-NEWSUB', links: [{ rel: 'approve', href: 'https://approve' }] } };
      }
      return { status: 404, body: {} };
    });
    const res = await createSubscriptionPost(
      makeCtx(
        req('POST', 'https://x/api/billing/create-subscription', { cycle: 'monthly' }),
        db,
        PAYPAL_ENV,
      ),
    );
    const j = await res.json();
    expect(j.subscriptionId).toBe('I-NEWSUB');
    expect(j.cycle).toBe('monthly');
    expect(sentBody.plan_id).toBe('P-PLAN-MONTHLY');
  });

  it('webhook ACTIVATED (monthly plan) writes billing_cycle=monthly', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/verify-webhook-signature')) return { status: 200, body: { verification_status: 'SUCCESS' } };
      return { status: 404, body: {} };
    });
    const next = '2026-09-03T10:00:00Z';
    const event = {
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource: {
        id: 'I-MONTHLYSUB',
        plan_id: 'P-PLAN-MONTHLY',
        custom_id: USER_ID,
        billing_info: { next_billing_time: next },
      },
    };
    const r = new Request('https://x/api/billing/webhook', {
      method: 'POST',
      headers: {
        'paypal-transmission-id': 'T1', 'paypal-transmission-time': '1', 'paypal-cert-url': 'c',
        'paypal-auth-algo': 'a', 'paypal-transmission-sig': 's', 'paypal-event-type': 'BILLING.SUBSCRIPTION.ACTIVATED',
      },
      body: JSON.stringify(event),
    });
    const res = await webhookPost(makeCtx(r, db, PAYPAL_ENV));
    const j = await res.json();
    expect(j.received).toBe(true);
    expect(db.tables.subscriptions.length).toBe(1);
    expect(db.tables.subscriptions[0].plan).toBe('plus');
    expect(db.tables.subscriptions[0].billing_cycle).toBe('monthly');
    expect(db.tables.subscriptions[0].expires_at).toBe(Date.parse(next));
  });

  it('webhook CANCELLED expires subscription (plan retained, expires_at=now)', async () => {
    mockFetch((url) => {
      if (url.includes('/v1/oauth2/token')) return { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
      if (url.includes('/verify-webhook-signature')) return { status: 200, body: { verification_status: 'SUCCESS' } };
      return { status: 404, body: {} };
    });
    const next = '2027-08-03T10:00:00Z';
    const subId = 'I-TESTSUB';
    const act = new Request('https://x/api/billing/webhook', {
      method: 'POST',
      headers: { 'paypal-transmission-id': 'T1', 'paypal-transmission-time': '1', 'paypal-cert-url': 'c',
        'paypal-auth-algo': 'a', 'paypal-transmission-sig': 's', 'paypal-event-type': 'BILLING.SUBSCRIPTION.ACTIVATED' },
      body: JSON.stringify({ event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: { id: subId, custom_id: USER_ID, billing_info: { next_billing_time: next } } }),
    });
    await webhookPost(makeCtx(act, db, PAYPAL_ENV));
    const can = new Request('https://x/api/billing/webhook', {
      method: 'POST',
      headers: { 'paypal-transmission-id': 'T2', 'paypal-transmission-time': '2', 'paypal-cert-url': 'c',
        'paypal-auth-algo': 'a', 'paypal-transmission-sig': 's', 'paypal-event-type': 'BILLING.SUBSCRIPTION.CANCELLED' },
      body: JSON.stringify({ event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: subId, custom_id: USER_ID } }),
    });
    const res = await webhookPost(makeCtx(can, db, PAYPAL_ENV));
    const j = await res.json();
    expect(j.received).toBe(true);
    expect(db.tables.subscriptions.length).toBe(1);
    expect(db.tables.subscriptions[0].plan).toBe('plus');
    expect(db.tables.subscriptions[0].provider_sub_id).toBe(subId);
    expect(db.tables.subscriptions[0].expires_at).toBeTruthy();
    expect(db.tables.subscriptions[0].expires_at!).toBeLessThanOrEqual(Date.now() + 2000);
  });
});
