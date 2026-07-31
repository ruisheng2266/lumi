/**
 * functions/auth/login.ts
 * 发起 Google OAuth 登录（含 PKCE）
 *
 * 安全说明：state + verifier 打包进**单个 cookie**（JSON 编码），
 * 避免 Cloudflare Pages Functions 运行时对多 Set-Cookie header 的
 * 不可靠处理（已验证：.join(';') 和 Headers.append() 均会导致
 * cookie 丢失 → 回调 CSRF 校验失败）。
 */

import type { PagesFunctionContext } from '../utils/types';
import { generateCodeVerifier, pkceChallenge } from '../utils/pkce';

interface Env {
  GOOGLE_CLIENT_ID: string;
  PUBLIC_URL: string;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response> | Response;

export const onRequestGet: Handler = async ({ env }) => {
  const state = crypto.randomUUID();
  const verifier = await generateCodeVerifier();
  const challenge = await pkceChallenge(verifier);

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.PUBLIC_URL}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const secure = env.PUBLIC_URL.startsWith('https');
  // 单个 cookie：JSON 打包 state + verifier，避免多 Set-Cookie 兼容问题
  const payload = JSON.stringify({ s: state, v: verifier });
  const cookieValue = `oauth_data=${encodeURIComponent(payload)}; Path=/auth/callback; HttpOnly; SameSite=Lax; Max-Age=600${secure ? '; Secure' : ''}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'Set-Cookie': cookieValue,
    },
  });
};
