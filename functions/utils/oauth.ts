/**
 * functions/utils/oauth.ts
 * Google / Apple 回调共用的"完成登录"逻辑（缺口⑤：抽公共 completeOAuthLogin）
 */

import type { D1Database } from './types';
import { upsertUser, type OAuthProfile } from './db';
import {
  createSession,
  buildSessionCookie,
  buildClearCookie,
} from './session';

/**
 * 完成 OAuth 登录：写用户 → 建会话 → 种 cookie → 跳首页。
 * 两个 provider 的 callback 共用，避免重复。
 */
export async function completeOAuthLogin(
  db: D1Database,
  profile: OAuthProfile,
  secure: boolean,
  redirectTo = '/',
): Promise<Response> {
  const userId = await upsertUser(db, profile);
  const sessionId = await createSession(db, userId);

  const headers = new Headers();
  headers.append('Set-Cookie', buildSessionCookie(sessionId, secure));
  headers.append('Set-Cookie', buildClearCookie('oauth_state', secure));
  headers.append('Set-Cookie', buildClearCookie('pkce_verifier', secure));
  headers.append('Location', redirectTo);

  return new Response(null, { status: 302, headers });
}
