/**
 * src/shared/plus/store.test.ts
 * Phase 3 前端权益 store 测试（mock fetch，覆盖 /api/entitlement 解析与边界）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEntitlementStore } from './store';

function mockFetchOnce(body: unknown, status = 200) {
  (globalThis as { fetch?: unknown }).fetch = vi.fn(async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }));
}

describe('entitlement store', () => {
  beforeEach(() => {
    useEntitlementStore.setState({
      plan: 'free',
      expiresAt: null,
      syncEntitled: false,
      loading: false,
      error: null,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refresh parses plan + syncEntitled + expiresAt', async () => {
    mockFetchOnce({ plan: 'plus', expiresAt: 123, syncEntitled: true });
    await useEntitlementStore.getState().refresh();
    const s = useEntitlementStore.getState();
    expect(s.plan).toBe('plus');
    expect(s.syncEntitled).toBe(true);
    expect(s.expiresAt).toBe(123);
    expect(s.loading).toBe(false);
  });

  it('refresh treats 401 (not logged in) as free', async () => {
    mockFetchOnce({}, 401);
    await useEntitlementStore.getState().refresh();
    const s = useEntitlementStore.getState();
    expect(s.plan).toBe('free');
    expect(s.syncEntitled).toBe(false);
  });

  it('free plan with grandfather key_backup → server-provided syncEntitled is honored', async () => {
    // 祖父条款的 syncEntitled 由后端在 entitlement 响应里直接给出；store 透传即可
    mockFetchOnce({ plan: 'free', expiresAt: null, syncEntitled: true });
    await useEntitlementStore.getState().refresh();
    expect(useEntitlementStore.getState().syncEntitled).toBe(true);
  });

  it('malformed / failed response keeps error state', async () => {
    mockFetchOnce({ error: 'boom' }, 500);
    await useEntitlementStore.getState().refresh();
    expect(useEntitlementStore.getState().error).toContain('entitlement_failed');
    expect(useEntitlementStore.getState().plan).toBe('free');
  });
});
