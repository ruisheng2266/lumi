/**
 * functions/auth/login.ts
 * 发起 Google OAuth 登录
 */

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
  PUBLIC_URL: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: context.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${context.env.PUBLIC_URL}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Set-Cookie': `oauth_state=${state}; Path=/auth/callback; HttpOnly; SameSite=Lax; Max-Age=600${
        context.env.PUBLIC_URL.startsWith('https') ? '; Secure' : ''
      }`,
    },
  });
};