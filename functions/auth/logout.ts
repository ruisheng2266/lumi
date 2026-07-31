/**
 * functions/auth/logout.ts
 * 登出：清除 cookie 和 session
 */

import type { PagesFunctionContext, D1Database } from '../utils/types';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response> | Response;

export const onRequestPost: Handler = async (context) => {
  const { getSessionIdFromCookie, deleteSession, buildClearCookie } = await import(
    '../utils/session'
  );
  const sessionId = getSessionIdFromCookie(context.request);

  if (sessionId) {
    await deleteSession(context.env.DB, sessionId);
  }

  const isSecure = new URL(context.request.url).protocol === 'https:';
  const headers = new Headers();
  headers.append('Set-Cookie', buildClearCookie('session', isSecure));
  headers.append('Location', '/');

  return new Response(null, { status: 302, headers });
};

export const onRequestGet: Handler = async (context) => {
  // GET 也允许登出（方便直接访问 URL 登出）
  return onRequestPost(context);
};