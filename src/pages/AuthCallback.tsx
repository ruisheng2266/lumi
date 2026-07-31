/**
 * src/pages/AuthCallback.tsx
 * OAuth 回调页（SPA 流程）
 *
 * Google 授权后重定向到此页面（/auth/callback?code=...&state=...）。
 * 前端从 sessionStorage 取出之前存的 state+verifier，
 * 校验 CSRF（state 一致），然后 POST code+verifier 给后端 /auth/token 换 session。
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, consumePendingOAuthState } from '../shared/auth/store';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const urlState = searchParams.get('state');

      if (!code || !urlState) {
        setError('缺少授权码或状态参数');
        setLoading(false);
        return;
      }

      // 从 sessionStorage 取挂起的 OAuth 状态（含 verifier）
      const pending = consumePendingOAuthState(window.location.href);
      if (!pending) {
        setError('登录会话已过期或无效，请重新登录');
        setLoading(false);
        return;
      }

      // CSRF 校验：URL 中的 state 必须与 sessionStorage 中一致
      if (urlState !== pending.state) {
        setError('安全校验失败，请重新登录');
        setLoading(false);
        return;
      }

      try {
        // POST 给后端换 token + 建会话
        const res = await fetch('/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, verifier: pending.verifier }),
          credentials: 'include',
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error || '登录失败，请重试');
          setLoading(false);
          return;
        }

        // 登录成功：更新 store，跳首页
        setUser(data.user);
        setLoading(false);
        navigate('/', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('网络错误，请重试');
        setLoading(false);
      }
    }

    handleCallback();
  }, [searchParams, navigate, setUser, setLoading]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-fog mb-4">{error}</p>
          <button
            onClick={() => navigate('/settings', { replace: true })}
            className="text-lavender-600 hover:text-lavender-500 text-sm font-medium"
          >
            返回设置
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-pulse text-fog text-sm">正在完成登录…</div>
      </div>
    </div>
  );
}
