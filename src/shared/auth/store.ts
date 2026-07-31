/**
 * src/shared/auth/store.ts
 * 认证状态管理（Zustand）
 */
import { create } from 'zustand';

export type OAuthProvider = 'google' | 'apple';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (provider?: OAuthProvider) => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  login: (provider = 'google') => {
    // 跳转到后端 OAuth 入口
    window.location.href = `/auth/${provider === 'apple' ? 'apple-login' : 'login'}`;
  },

  logout: async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    set({ user: null });
  },

  deleteAccount: async () => {
    try {
      await fetch('/auth/delete-account', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore 网络错误，仍清本地态
    }
    set({ user: null });
  },

  fetchUser: async () => {
    try {
      const res = await fetch('/auth/me', {
        credentials: 'include',
      });
      const data = await res.json();
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
