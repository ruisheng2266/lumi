/**
 * functions/auth/delete-account.ts
 * 账号注销：级联删除用户全部数据（缺口④）
 */

import type { PagesFunctionContext, D1Database } from '../utils/types';
import {
  getSessionIdFromCookie,
  validateSession,
  buildClearCookie,
} from '../utils/session';
import { deleteUser } from '../utils/db';

interface Env {
  DB: D1Database;
  PUBLIC_URL: string;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response> | Response;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const onRequestPost: Handler = async (context) => {
  const { request, env } = context;
  const sessionId = getSessionIdFromCookie(request);
  if (!sessionId) return json({ error: 'unauthorized' }, 401);

  const userId = await validateSession(env.DB, sessionId);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  await deleteUser(env.DB, userId);

  const isSecure = new URL(request.url).protocol === 'https:';
  const clearHeaders = [
    buildClearCookie('session', isSecure),
    buildClearCookie('oauth_state', isSecure),
    buildClearCookie('pkce_verifier', isSecure),
  ].join(', ');

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearHeaders,
    },
  });
};

export const onRequestDelete: Handler = async (context) => onRequestPost(context);
