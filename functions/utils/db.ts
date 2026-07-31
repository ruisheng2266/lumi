/**
 * functions/utils/db.ts
 * D1 用户数据访问层
 */

import type { D1Database } from './types';

export interface User {
  id: string;
  google_id: string | null;
  apple_id: string | null;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: number;
  last_login_at: number;
}

export type OAuthProvider = 'google' | 'apple';

export interface OAuthProfile {
  provider: OAuthProvider;
  sub: string;
  email: string;
  name?: string | null;
  picture?: string | null;
}

/**
 * 根据 OAuth profile 创建或更新用户（Google / Apple 共用）。
 * 注意：google_id 与 apple_id 至少其一非空（由 CHECK 约束保证）。
 */
export async function upsertUser(
  db: D1Database,
  profile: OAuthProfile,
): Promise<string> {
  const now = Date.now();
  const col = profile.provider === 'google' ? 'google_id' : 'apple_id';

  const existing = await db
    .prepare(`SELECT id FROM users WHERE ${col} = ?`)
    .bind(profile.sub)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE users SET email = ?, name = ?, picture = ?, last_login_at = ? WHERE id = ?`,
      )
      .bind(
        profile.email,
        profile.name ?? null,
        profile.picture ?? null,
        now,
        existing.id,
      )
      .run();
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO users (id, google_id, apple_id, email, name, picture, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      profile.provider === 'google' ? profile.sub : null,
      profile.provider === 'apple' ? profile.sub : null,
      profile.email,
      profile.name ?? null,
      profile.picture ?? null,
      now,
      now,
    )
    .run();
  return id;
}

export async function findUserById(
  db: D1Database,
  id: string,
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();
}

export async function findUserByGoogleId(
  db: D1Database,
  googleId: string,
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(googleId)
    .first<User>();
}

export async function findUserByAppleId(
  db: D1Database,
  appleId: string,
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE apple_id = ?')
    .bind(appleId)
    .first<User>();
}

/**
 * 级联删除用户及其所有关联数据（缺口④ 账号注销）。
 * 注：R2 上的加密同步 blob 在 Phase 2 才产生，此处仅清 D1 索引；
 * 删除后孤立 R2 对象由后续清理任务回收。
 */
export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  await db
    .prepare('DELETE FROM recovery_codes WHERE user_id = ?')
    .bind(userId)
    .run();
  await db.prepare('DELETE FROM key_backup WHERE user_id = ?').bind(userId).run();
  await db.prepare('DELETE FROM sync_meta WHERE user_id = ?').bind(userId).run();
  await db
    .prepare('DELETE FROM subscriptions WHERE user_id = ?')
    .bind(userId)
    .run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}
