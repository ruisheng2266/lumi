/**
 * functions/debug/env.ts
 * 临时调试：返回所有环境变量
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
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  PUBLIC_URL?: string;
  DB?: unknown;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return new Response(
    JSON.stringify({
      env: {
        GOOGLE_CLIENT_ID: context.env.GOOGLE_CLIENT_ID || 'MISSING',
        GOOGLE_CLIENT_SECRET: context.env.GOOGLE_CLIENT_SECRET ? 'PRESENT' : 'MISSING',
        PUBLIC_URL: context.env.PUBLIC_URL || 'MISSING',
        DB: context.env.DB ? 'BOUND' : 'MISSING',
      },
      keys: Object.keys(context.env || {}),
    }, null, 2),
    { headers: { 'Content-Type': 'application/json' } }
  );
};