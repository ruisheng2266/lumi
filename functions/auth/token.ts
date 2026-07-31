/**
 * functions/auth/token.ts
 * Google OAuth token 交换端点（SPA 流程专用）
 *
 * 接收前端 POST 的 { code, verifier }，
 * 在后端完成 code → token → userinfo → 建会话，
 * 返回用户信息 + session cookie。
 *
 * 替代原 callback.ts 的 302 cookie 方案（CF Pages Functions 302 Set-Cookie 不可靠）。
 */

import type { PagesFunctionContext } from '../utils/types';
import { upsertUser } from '../utils/db';
import { createSession, buildSessionCookie } from '../utils/session';

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

export const onRequestPost: Handler = async ({ request, env }) => {
  const secure = env.PUBLIC_URL.startsWith('https');

  try {
    const body = await request.json() as { code?: string; verifier?: string };
    const { code, verifier } = body;

    if (!code || !verifier) {
      return Response.json({ error: 'missing_code_or_verifier' }, { status: 400 });
    }

    // 从请求头推导实际 redirect_uri（兼容 www / 非 www / 自定义域名）
    const requestOrigin = new URL(request.url).origin;
    const redirectUri = `${requestOrigin}/auth/callback`;

    // 用 code + verifier 换 Google token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: verifier,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Google token error:', tokenRes.status, errText);
      return Response.json({ error: 'token_exchange_failed' }, { status: 400 });
    }

    const tokens = (await tokenRes.json()) as GoogleTokenResponse;

    // 用 access_token 获取用户信息
    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) {
      return Response.json({ error: 'userinfo_failed' }, { status: 400 });
    }
    const profile = (await userRes.json()) as GoogleUserInfo;

    // 写/更新用户 + 建会话
    const userId = await upsertUser(env.DB, {
      provider: 'google',
      sub: profile.sub,
      email: profile.email,
      name: profile.name ?? null,
      picture: profile.picture ?? null,
    });
    const sessionId = await createSession(env.DB, userId);

    // 返回用户信息 + session cookie
    const sessionCookie = buildSessionCookie(sessionId, secure);
    return new Response(
      JSON.stringify({
        ok: true,
        user: { id: userId, email: profile.email, name: profile.name ?? null, picture: profile.picture ?? null },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': sessionCookie,
        },
      },
    );
  } catch (err) {
    console.error('Token exchange error:', err);
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
};
