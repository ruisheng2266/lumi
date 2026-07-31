/**
 * functions/utils/auth.ts
 * 从请求解析已登录用户 ID（供需要鉴权的端点复用）。
 */
import type { D1Database } from './types';
import { getSessionIdFromCookie, validateSession } from './session';

/**
 * 返回会话对应的 userId；未登录或会话失效返回 null。
 */
export async function getUserId(
  request: Request,
  db: D1Database,
): Promise<string | null> {
  const sessionId = getSessionIdFromCookie(request);
  if (!sessionId) return null;
  return await validateSession(db, sessionId);
}
