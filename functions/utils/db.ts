/**
 * functions/utils/db.ts
 * D1 用户数据访问层
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

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: number;
  last_login_at: number;
}

/**
 * 根据 Google profile 创建或更新用户
 */
export async function upsertUser(
  db: D1Database,
  profile: {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  }
): Promise<string> {
  const now = Date.now();

  const existing = await db
    .prepare('SELECT id FROM users WHERE google_id = ?')
    .bind(profile.sub)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(
        'UPDATE users SET email = ?, name = ?, picture = ?, last_login_at = ? WHERE id = ?'
      )
      .bind(
        profile.email,
        profile.name ?? null,
        profile.picture ?? null,
        now,
        existing.id
      )
      .run();
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO users (id, google_id, email, name, picture, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      id,
      profile.sub,
      profile.email,
      profile.name ?? null,
      profile.picture ?? null,
      now,
      now
    )
    .run();
  return id;
}

/**
 * 通过 ID 查找用户
 */
export async function findUserById(
  db: D1Database,
  id: string
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();
}

/**
 * 通过 google_id 查找用户
 */
export async function findUserByGoogleId(
  db: D1Database,
  googleId: string
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(googleId)
    .first<User>();
}