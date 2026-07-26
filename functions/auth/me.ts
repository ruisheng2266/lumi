/**
 * functions/auth/me.ts
 * 返回当前登录用户信息
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
  DB: D1Database;
}

interface User {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: number;
  last_login_at: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
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