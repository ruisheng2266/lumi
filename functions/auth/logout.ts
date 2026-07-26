/**
 * functions/auth/logout.ts
 * 登出：清除 cookie 和 session
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // GET 也允许登出（方便直接访问 URL 登出）
  return onRequestPost(context);
};