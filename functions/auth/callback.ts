/**
 * functions/auth/callback.ts
 * Google OAuth 回调：换 token、获取用户、创建会话
 */

interface D1Database {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>(col?: string) => Promise<T | null>;
      run: () => Promise<{ meta: { changes: number; last_row_id: number } }>;
      all: <T = unknown>() => Promise<T[]>;
    };
  };
}

interface PagesFunctionContext<E = unknown> {
  request: Request;
  env: E;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string) => Promise<Response>;
  data: Record<string, unknown>;
}

type PagesFunction<E = unknown> = (
  context: PagesFunctionContext<E>,
) => Promise<Response> | Response;

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  PUBLIC_URL: string;
  DB: D1Database;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // 处理 Google 返回的错误
  if (error) {
    return Response.redirect(
      `${context.env.PUBLIC_URL}/?auth_error=${encodeURIComponent(error)}`,
      302
    );
  }

  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  // 验证 state（CSRF 保护）
  const { getOAuthStateFromCookie, createSession, buildSessionCookie, buildClearCookie } =
    await import('../utils/session');
  const cookieState = getOAuthStateFromCookie(context.request);

  if (!cookieState || cookieState !== state) {
    return new Response('State mismatch (CSRF protection)', { status: 400 });
  }

  try {
    // 1. 用 code 换 token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: context.env.GOOGLE_CLIENT_ID,
        client_secret: context.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${context.env.PUBLIC_URL}/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Token exchange failed:', errText);
      return Response.redirect(
        `${context.env.PUBLIC_URL}/?auth_error=token_exchange_failed`,
        302
      );
    }

    const tokens = (await tokenRes.json()) as GoogleTokenResponse;

    // 2. 用 access_token 获取用户信息
    const userRes = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userRes.ok) {
      return Response.redirect(
        `${context.env.PUBLIC_URL}/?auth_error=userinfo_failed`,
        302
      );
    }

    const profile = (await userRes.json()) as GoogleUserInfo;

    // 3. 保存到 D1
    const { upsertUser } = await import('../utils/db');
    const userId = await upsertUser(context.env.DB, profile);

    // 4. 创建会话
    const sessionId = await createSession(context.env.DB, userId);

    // 5. 设置 cookie 并跳转回首页
    const isSecure = context.env.PUBLIC_URL.startsWith('https');
    const headers = new Headers();
    headers.append('Set-Cookie', buildSessionCookie(sessionId, isSecure));
    headers.append('Set-Cookie', buildClearCookie('oauth_state', isSecure));
    headers.append('Location', '/');

    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error('OAuth callback error:', err);
    return Response.redirect(
      `${context.env.PUBLIC_URL}/?auth_error=internal_error`,
      302
    );
  }
};