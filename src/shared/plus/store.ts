/**
 * src/shared/plus/store.ts
 * Phase 3 前端权益 store（Zustand）：从 /api/entitlement 读取 plan / expiresAt / syncEntitled。
 *
 * 与后端 getSyncEntitlement 对齐：
 *  - syncEntitled 决定"同步"是否可用（Plus / founder，或 Phase 2 已启用同步的祖父老用户）
 *  - 未登录视为 free（无账号则无订阅）
 */
import { create } from 'zustand';
import { useEffect } from 'react';
import { useAuth } from '../auth/store';

export type Plan = 'free' | 'plus' | 'founder';

export interface EntitlementState {
  plan: Plan;
  expiresAt: number | null;
  syncEntitled: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useEntitlementStore = create<EntitlementState>((set) => ({
  plan: 'free',
  expiresAt: null,
  syncEntitled: false,
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/entitlement', { credentials: 'include' });
      if (res.status === 401) {
        // 未登录：视为 free（无账号则无订阅）
        set({ plan: 'free', expiresAt: null, syncEntitled: false, loading: false });
        return;
      }
      if (!res.ok) throw new Error(`entitlement_failed (${res.status})`);
      const data = (await res.json()) as {
        plan?: Plan;
        expiresAt?: number | null;
        syncEntitled?: boolean;
      };
      set({
        plan: data.plan ?? 'free',
        expiresAt: data.expiresAt ?? null,
        syncEntitled: !!data.syncEntitled,
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message || 'entitlement_failed', loading: false });
    }
  },
}));

/**
 * 权益 Hook：登录态变化时自动刷新；未登录重置为 free。
 * 多个组件调用时各自在挂载时拉一次（幂等，同一用户不会重复触发）。
 */
export function useEntitlement(): EntitlementState {
  const state = useEntitlementStore();
  const user = useAuth((s) => s.user);
  useEffect(() => {
    if (user) {
      void state.refresh();
    } else {
      useEntitlementStore.setState({
        plan: 'free',
        expiresAt: null,
        syncEntitled: false,
        error: null,
      });
    }
    // refresh 是稳定引用；仅依赖 user?.id 避免重复拉取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  return state;
}
