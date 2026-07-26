/**
 * functions/utils/session.ts
 * 会话管理（cookie + D1 验证）
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

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

/**
 * 创建新会话
 */
export async function createSession(
  db: D1Database,
  userId: string
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
    )
    .bind(id, userId, expiresAt, now)
    .run();

  return id;
}

/**
 * 验证会话，返回用户 ID
 */
export async function validateSession(
  db: D1Database,
  sessionId: string
): Promise<string | null> {
  const result = await db
    .prepare(
      'SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?'
    )
    .bind(sessionId, Date.now())
    .first<{ user_id: string }>();

  return result?.user_id ?? null;
}

/**
 * 删除会话
 */
export async function deleteSession(
  db: D1Database,
  sessionId: string
): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

/**
 * 清理过期会话（定期执行，可选）
 */
export async function cleanupExpiredSessions(
  db: D1Database
): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?')
    .bind(Date.now())
    .run();
}

/**
 * 从 Cookie 解析 session ID
 */
export function getSessionIdFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('session='));
  if (!match) return null;
  return match.substring('session='.length);
}

/**
 * 从 Cookie 解析 oauth_state（用于 CSRF 保护）
 */
export function getOAuthStateFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('oauth_state='));
  if (!match) return null;
  return match.substring('oauth_state='.length);
}

/**
 * 构造 session cookie
 */
export function buildSessionCookie(
  sessionId: string,
  secure: boolean
): string {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  const parts = [
    `session=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * 构造清除 cookie 的 header
 */
export function buildClearCookie(name: string, secure: boolean): string {
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}