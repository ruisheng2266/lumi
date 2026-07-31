/**
 * src/shared/auth/store.ts
 * 认证状态管理（Zustand）
 *
 * OAuth 流程：SPA 端发起（前端生成 state/PKCE → 存 sessionStorage → 直接跳 Google），
 * 回调由前端路由接收，再 POST code+verifier 给后端换 token。
 */
import { create } from 'zustand';
import { generateCodeVerifier, pkceChallenge } from '../../shared/lib/pkce-client';

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

const OAUTH_STATE_KEY = 'lumi_oauth_state';

export interface PendingOAuthState {
  state: string;
  verifier: string;
  provider: OAuthProvider;
  createdAt: number;
}

function doLogin(provider: OAuthProvider) {
  const state = crypto.randomUUID();
  const verifier = generateCodeVerifier();
  verifier.then((v) => {
    pkceChallenge(v).then((challenge) => {
      const pending: PendingOAuthState = { state, verifier: v, provider, createdAt: Date.now() };
      sessionStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(pending));

      const params = new URLSearchParams({
        client_id: '54402477675-6a5coh6frtdtq51btf1018bl3kf6df48.apps.googleusercontent.com',
        redirect_uri: `${window.location.origin}/auth/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      window.location.href = authUrl;
    });
  });
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  login: (provider = 'google') => { doLogin(provider); },
  logout: async () => {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
    set({ user: null });
  },
  deleteAccount: async () => {
    try { await fetch('/auth/delete-account', { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
    set({ user: null });
  },
  fetchUser: async () => {
    try {
      const res = await fetch('/auth/me', { credentials: 'include' });
      const data = await res.json();
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));

/** 读取并清除挂起的 OAuth state（回调页面调用） */
export function consumePendingOAuthState(url: string): PendingOAuthState | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    const pending = JSON.parse(raw) as PendingOAuthState;
    if (Date.now() - pending.createdAt > 10 * 60 * 1000) return null;
    const urlState = new URL(url).searchParams.get('state');
    if (urlState !== pending.state) return null;
    return pending;
  } catch {
    return null;
  }
}
