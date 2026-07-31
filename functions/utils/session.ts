/**
 * functions/utils/session.ts
 * 会话管理（cookie + D1 验证）
 */

import type { D1Database } from './types';

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
 * 从 Cookie 解析 OAuth 数据（state + verifier 打包在单个 cookie 里）
 * 返回 { state, verifier } 或 null
 */
export function getOAuthDataFromCookie(request: Request): { state: string; verifier: string } | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('oauth_data='));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.substring('oauth_data='.length));
    const data = JSON.parse(raw);
    if (typeof data?.s === 'string' && typeof data?.v === 'string') {
      return { state: data.s, verifier: data.v };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 从 Cookie 解析 oauth_state（用于 CSRF 保护）
 * @deprecated 改用 getOAuthDataFromCookie（单 cookie 方案）
 */
export function getOAuthStateFromCookie(request: Request): string | null {
  return getOAuthDataFromCookie(request)?.state ?? null;
}

/**
 * 从 Cookie 解析 PKCE code_verifier（用于公开客户端校验）
 * @deprecated 改用 getOAuthDataFromCookie（单 cookie 方案）
 */
export function getPkceVerifierFromCookie(request: Request): string | null {
  return getOAuthDataFromCookie(request)?.verifier ?? null;
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