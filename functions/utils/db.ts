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

/** Phase 4：按邮箱查找用户（伴侣共享邀请用；仅用于解析对方账号，不返回其他字段） */
export async function findUserByEmail(
  db: D1Database,
  email: string,
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();
}

/** Phase 4：读取用户的共享密钥材料（公钥明文 + 被口令包裹的私钥）。无则返回 null。 */
export interface UserKeyMaterial {
  publicKey: string | null;
  wrappedPrivateKey: string | null;
  privateKeySalt: string | null;
}

export async function getUserKeyMaterial(
  db: D1Database,
  userId: string,
): Promise<UserKeyMaterial | null> {
  const row = await db
    .prepare(
      'SELECT public_key, wrapped_private_key, private_key_salt FROM users WHERE id = ?',
    )
    .bind(userId)
    .first<{
      public_key: string | null;
      wrapped_private_key: string | null;
      private_key_salt: string | null;
    }>();
  if (!row) return null;
  // D1 列名为 snake_case，映射为 camelCase 供上层使用
  return {
    publicKey: row.public_key ?? null,
    wrappedPrivateKey: row.wrapped_private_key ?? null,
    privateKeySalt: row.private_key_salt ?? null,
  };
}

/** Phase 4：写入 / 覆盖用户的共享密钥材料（首次启用同步时一并上报） */
export async function upsertUserKeys(
  db: D1Database,
  userId: string,
  data: { publicKey: string; wrappedPrivateKey: string; privateKeySalt: string },
): Promise<void> {
  await db
    .prepare(
      'UPDATE users SET public_key = ?, wrapped_private_key = ?, private_key_salt = ? WHERE id = ?',
    )
    .bind(data.publicKey, data.wrappedPrivateKey, data.privateKeySalt, userId)
    .run();
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
