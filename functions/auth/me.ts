/**
 * functions/auth/me.ts
 * 返回当前登录用户信息
 */

import type { PagesFunctionContext, D1Database } from '../utils/types';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response> | Response;

export const onRequestGet: Handler = async (context) => {
  const { getSessionIdFromCookie, validateSession } = await import(
    '../utils/session'
  );
  const { findUserById } = await import('../utils/db');

  const sessionId = getSessionIdFromCookie(context.request);

  if (!sessionId) {
    return jsonResponse({ user: null });
  }

  const userId = await validateSession(context.env.DB, sessionId);
  if (!userId) {
    return jsonResponse({ user: null });
  }

  const user = await findUserById(context.env.DB, userId);
  if (!user) {
    return jsonResponse({ user: null });
  }

  return jsonResponse({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
  });
};

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init?.headers || {}),
    },
  });
}