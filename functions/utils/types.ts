/**
 * functions/utils/types.ts
 * Pages Functions 与 D1 的共享类型（抽离，避免每个文件重复声明 —— 缺口④）
 */

export interface D1Database {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>(col?: string) => Promise<T | null>;
      run: () => Promise<{ meta: { changes: number; last_row_id: number } }>;
      all: <T = unknown>() => Promise<T[]>;
    };
  };
}

export interface PagesFunctionContext<E = unknown> {
  request: Request;
  env: E;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string) => Promise<Response>;
  data: Record<string, unknown>;
}

export type PagesFunction<E = unknown> = (
  context: PagesFunctionContext<E>,
) => Promise<Response> | Response;
