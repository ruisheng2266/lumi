/**
 * functions/utils/types.ts
 * Pages Functions 与 D1 的共享类型（抽离，避免每个文件重复声明 —— 缺口④）
 */

export interface D1Database {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>(col?: string) => Promise<T | null>;
      run: () => Promise<{ meta: { changes: number; last_row_id: number } }>;
      // 真实 Cloudflare D1 .all() 返回 { results: T[], success, meta }，不是直接 T[]
      all: <T = unknown>() => Promise<{ results: T[]; success: boolean; meta?: Record<string, unknown> }>;
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

/**
 * R2 bucket 的最小接口（运行时由 Cloudflare 提供真实实现，测试用 FakeR2 替代）。
 */
export interface R2Object {
  key: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}
export interface R2Bucket {
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    opts?: unknown,
  ) => Promise<{ etag?: string }>;
  get: (key: string) => Promise<R2Object | null>;
  delete: (key: string) => Promise<void>;
}

/** Phase 2 同步：单条记录的加密封装（客户端加密，服务端只存 opaque blob） */
export interface SyncRecordInput {
  recordId: string;
  updatedAt: number;
  /** base64(iv || ciphertext) */
  blob: string;
  /** SHA-256(blob) hex，用于变更检测与完整性 */
  hmac: string;
  /** 标记删除（tombstone），拉取端据此删除本地记录 */
  deleted?: boolean;
}
