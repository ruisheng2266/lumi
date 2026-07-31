/**
 * functions/auth/callback.ts
 * Google OAuth 回调：PKCE 校验 + 换 token + 获取用户 + 完成登录
 */

import type { PagesFunctionContext } from '../utils/types';
import { completeOAuthLogin } from '../utils/oauth';
import {
  getOAuthDataFromCookie,
} from '../utils/session';
import { pkceChallenge } from '../utils/pkce';

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  PUBLIC_URL: string;
  DB: import('../utils/types').D1Database;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response> | Response;

export const onRequestGet: Handler = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const codeChallenge = url.searchParams.get('code_challenge');
  const error = url.searchParams.get('error');

  const secure = env.PUBLIC_URL.startsWith('https');
  const fail = (reason: string) =>
    Response.redirect(`${env.PUBLIC_URL}/?auth_error=${encodeURIComponent(reason)}`, 302);

  if (error) return fail(error);

  // 1. 从单 cookie 解析 state + verifier（CSRF + PKCE）
  const oauthData = getOAuthDataFromCookie(request);
  if (!oauthData || oauthData.state !== state) {
    return new Response('State mismatch (CSRF protection)', { status: 400 });
  }

  // 2. PKCE 校验
  if (!codeChallenge || (await pkceChallenge(oauthData.verifier)) !== codeChallenge) {
    return new Response('PKCE verification failed', { status: 400 });
  }

  if (!code) return new Response('Missing code', { status: 400 });

  try {
    // 3. 用 code + code_verifier 换 token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: oauthData.verifier,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.PUBLIC_URL}/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      return fail('token_exchange_failed');
    }
    const tokens = (await tokenRes.json()) as GoogleTokenResponse;

    // 4. 用 access_token 获取用户信息
    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) return fail('userinfo_failed');
    const profile = (await userRes.json()) as GoogleUserInfo;

    // 5. 完成登录（写用户 + 建会话 + 种 cookie）
    return await completeOAuthLogin(
      env.DB,
      {
        provider: 'google',
        sub: profile.sub,
        email: profile.email,
        name: profile.name ?? null,
        picture: profile.picture ?? null,
      },
      secure,
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return fail('internal_error');
  }
};
