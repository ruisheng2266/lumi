/**
 * functions/utils/sync-db.ts
 * Phase 2 E2EE 同步的 D1 数据访问层
 *
 * 服务端只存储：
 *  - key_backup：passphrase 派生的密钥包裹后的 vault 密钥（服务端永远看不到明文 vault 密钥 / passphrase）
 *  - recovery_codes：每个恢复码各自包裹一份 vault 密钥（遗失口令时凭其一重置，数据不丢）
 *  - sync_meta：每条记录的索引（updated_at / R2 blob_ref / hmac），密文本身在 R2
 */

import type { D1Database } from './types';

export interface KeyBackupRow {
  wrapped_vault_key: string; // base64(iv || ct)
  salt: string; // base64(PBKDF2 salt)
}

export interface RecoveryCodeRow {
  code_hash: string;
  wrapped_vault_key: string; // base64(iv || ct) —— 该恢复码单独包裹的 vault 密钥
  used_at: number | null;
}

export interface SyncMetaRow {
  record_id: string;
  updated_at: number;
  blob_ref: string;
  hmac: string;
}

/** 读取 key_backup（含 salt） */
export async function getKeyBackup(
  db: D1Database,
  userId: string,
): Promise<(KeyBackupRow & { created_at: number }) | null> {
  const row = await db
    .prepare(
      'SELECT wrapped_vault_key, salt, created_at FROM key_backup WHERE user_id = ?',
    )
    .bind(userId)
    .first<KeyBackupRow & { created_at: number }>();
  return row ?? null;
}

/** 写入 / 覆盖 key_backup（upsert）
 *  注意：key_backup.wrapped_private_key 是 NOT NULL（原 Apple 方案遗留），
 *  对称 vault 方案不使用它，但 INSERT 必须传值以避免约束违反。 */
export async function upsertKeyBackup(
  db: D1Database,
  userId: string,
  data: KeyBackupRow,
): Promise<void> {
  await db.prepare('DELETE FROM key_backup WHERE user_id = ?').bind(userId).run();
  await db
    .prepare(
      'INSERT INTO key_backup (user_id, wrapped_private_key, wrapped_vault_key, salt, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(userId, '', data.wrapped_vault_key, data.salt, Date.now())
    .run();
}

/** 列出某用户全部恢复码（含包裹的 vault 密钥与是否已用） */
export async function getRecoveryCodes(
  db: D1Database,
  userId: string,
): Promise<RecoveryCodeRow[]> {
  return await db
    .prepare(
      'SELECT code_hash, wrapped_vault_key, used_at FROM recovery_codes WHERE user_id = ?',
    )
    .bind(userId)
    .all<RecoveryCodeRow>();
}

/** 用新的一组恢复码整体替换（重新生成时调用） */
export async function replaceRecoveryCodes(
  db: D1Database,
  userId: string,
  codes: { code_hash: string; wrapped_vault_key: string }[],
): Promise<void> {
  await db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').bind(userId).run();
  for (const c of codes) {
    await db
      .prepare(
        'INSERT INTO recovery_codes (user_id, code_hash, wrapped_vault_key, created_at) VALUES (?, ?, ?, ?)',
      )
      .bind(userId, c.code_hash, c.wrapped_vault_key, Date.now())
      .run();
  }
}

/** 标记某个恢复码已使用（重置口令后） */
export async function markRecoveryCodeUsed(
  db: D1Database,
  userId: string,
  codeHash: string,
): Promise<void> {
  await db
    .prepare('UPDATE recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ?')
    .bind(Date.now(), userId, codeHash)
    .run();
}

/** 按 code_hash 查找未使用的恢复码（重置口令时校验） */
export async function findUnusedRecoveryCode(
  db: D1Database,
  userId: string,
  codeHash: string,
): Promise<RecoveryCodeRow | null> {
  return await db
    .prepare(
      'SELECT code_hash, wrapped_vault_key, used_at FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL',
    )
    .bind(userId, codeHash)
    .first<RecoveryCodeRow>();
}

/** 读取单条 sync_meta */
export async function getSyncMeta(
  db: D1Database,
  userId: string,
  recordId: string,
): Promise<SyncMetaRow | null> {
  return await db
    .prepare(
      'SELECT record_id, updated_at, blob_ref, hmac FROM sync_meta WHERE user_id = ? AND record_id = ?',
    )
    .bind(userId, recordId)
    .first<SyncMetaRow>();
}

/** upsert 单条 sync_meta（LWW 由调用方在读取旧值后决定是否写入） */
export async function upsertSyncMeta(
  db: D1Database,
  userId: string,
  meta: SyncMetaRow,
): Promise<void> {
  await db
    .prepare('DELETE FROM sync_meta WHERE user_id = ? AND record_id = ?')
    .bind(userId, meta.record_id)
    .run();
  await db
    .prepare(
      'INSERT INTO sync_meta (user_id, record_id, updated_at, blob_ref, hmac) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(userId, meta.record_id, meta.updated_at, meta.blob_ref, meta.hmac)
    .run();
}

/** 列出自 since（ms，不含）以来的 sync_meta（增量拉取）；since 省略则全量 */
export async function listSyncMeta(
  db: D1Database,
  userId: string,
  since?: number,
): Promise<SyncMetaRow[]> {
  if (since != null) {
    return await db
      .prepare(
        'SELECT record_id, updated_at, blob_ref, hmac FROM sync_meta WHERE user_id = ? AND updated_at > ?',
      )
      .bind(userId, since)
      .all<SyncMetaRow>();
  }
  return await db
    .prepare(
      'SELECT record_id, updated_at, blob_ref, hmac FROM sync_meta WHERE user_id = ?',
    )
    .bind(userId)
    .all<SyncMetaRow>();
}

/** 删除 sync_meta 行（仅当记录确实从 R2 移除且不再需要 tombstone 时使用） */
export async function deleteSyncMeta(
  db: D1Database,
  userId: string,
  recordId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM sync_meta WHERE user_id = ? AND record_id = ?')
    .bind(userId, recordId)
    .run();
}
