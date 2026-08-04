/**
 * functions/utils/share-db.ts
 * Phase 4 伴侣加密共享的 D1 数据访问层。
 *
 * 零知识保证：服务端只存「被公钥包裹的共享 vault 密钥」与密文 blob（R2），
 * 永远看不到明文共享 vault 密钥 / 记录内容。
 *  - shared_vaults：共享 vault 元信息（owner / key_epoch 轮换计数）
 *  - shared_members：成员（owner | partner）+ 各自被公钥包裹的 shared vault key + 状态
 *  - shared_meta：per-record LWW 索引（与 sync_meta 同语义，作用域为 vault_id）
 */

import type { D1Database } from './types';

export type ShareRole = 'owner' | 'partner';
export type ShareStatus = 'pending' | 'active' | 'revoked';

export interface SharedVaultRow {
  vault_id: string;
  owner_user_id: string;
  key_epoch: number;
  created_at: number;
}

export interface SharedMemberRow {
  vault_id: string;
  user_id: string;
  role: ShareRole;
  wrapped_vault_key: string;
  joined_at: number;
  status: ShareStatus;
}

export interface SharedMetaRow {
  vault_id: string;
  record_id: string;
  updated_at: number;
  blob_ref: string;
  hmac: string;
}

/** 创建共享 vault + 两名成员（owner=active，partner=pending）。包裹密钥由客户端用双方公钥生成后传入。 */
export async function createSharedVault(
  db: D1Database,
  args: {
    vaultId: string;
    ownerUserId: string;
    ownerWrapped: string;
    partnerUserId: string;
    partnerWrapped: string;
    now: number;
  },
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO shared_vaults (vault_id, owner_user_id, key_epoch, created_at) VALUES (?, ?, 1, ?)',
    )
    .bind(args.vaultId, args.ownerUserId, args.now)
    .run();
  await db
    .prepare(
      'INSERT INTO shared_members (vault_id, user_id, role, wrapped_vault_key, joined_at, status) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(args.vaultId, args.ownerUserId, 'owner', args.ownerWrapped, args.now, 'active')
    .run();
  await db
    .prepare(
      'INSERT INTO shared_members (vault_id, user_id, role, wrapped_vault_key, joined_at, status) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(args.vaultId, args.partnerUserId, 'partner', args.partnerWrapped, args.now, 'pending')
    .run();
}

export async function getSharedVault(
  db: D1Database,
  vaultId: string,
): Promise<SharedVaultRow | null> {
  return await db
    .prepare('SELECT * FROM shared_vaults WHERE vault_id = ?')
    .bind(vaultId)
    .first<SharedVaultRow>();
}

export async function getMember(
  db: D1Database,
  vaultId: string,
  userId: string,
): Promise<SharedMemberRow | null> {
  return await db
    .prepare('SELECT * FROM shared_members WHERE vault_id = ? AND user_id = ?')
    .bind(vaultId, userId)
    .first<SharedMemberRow>();
}

export interface MembershipView {
  vaultId: string;
  ownerUserId: string;
  keyEpoch: number;
  myRole: ShareRole;
  myStatus: ShareStatus;
  myWrappedVaultKey: string;
  /** 对端成员（owner 视角下为 partner，partner 视角下为 owner）的状态，用于 UI 展示 */
  partner: { userId: string; status: ShareStatus } | null;
}

/** 列出当前用户参与的全部共享 vault（含自身角色 / 状态 / 被包裹密钥 / 对端状态） */
export async function listMemberships(
  db: D1Database,
  userId: string,
): Promise<MembershipView[]> {
  const mine = await db
    .prepare('SELECT * FROM shared_members WHERE user_id = ?')
    .bind(userId)
    .all<SharedMemberRow>();
  const out: MembershipView[] = [];
  for (const m of mine.results ?? []) {
    const vault = await getSharedVault(db, m.vault_id);
    if (!vault) continue;
    const members = await db
      .prepare('SELECT * FROM shared_members WHERE vault_id = ?')
      .bind(m.vault_id)
      .all<SharedMemberRow>();
    const others = (members.results ?? []).filter((x) => x.user_id !== userId);
    out.push({
      vaultId: m.vault_id,
      ownerUserId: vault.owner_user_id,
      keyEpoch: vault.key_epoch,
      myRole: m.role,
      myStatus: m.status,
      myWrappedVaultKey: m.wrapped_vault_key,
      partner: others[0]
        ? { userId: others[0].user_id, status: others[0].status }
        : null,
    });
  }
  return out;
}

/** 接受邀请：pending → active（伴侣免费即可 accept） */
export async function acceptMembership(
  db: D1Database,
  vaultId: string,
  userId: string,
): Promise<void> {
  await db
    .prepare('UPDATE shared_members SET status = ? WHERE vault_id = ? AND user_id = ?')
    .bind('active', vaultId, userId)
    .run();
}

/** 列出某 vault 的全部 active 成员（轮换密钥时用） */
export async function listActiveMembers(
  db: D1Database,
  vaultId: string,
): Promise<SharedMemberRow[]> {
  const all = await db
    .prepare('SELECT * FROM shared_members WHERE vault_id = ?')
    .bind(vaultId)
    .all<SharedMemberRow>();
  return (all.results ?? []).filter((m) => m.status === 'active');
}

export async function updateMemberWrappedKey(
  db: D1Database,
  vaultId: string,
  userId: string,
  wrappedVaultKey: string,
): Promise<void> {
  await db
    .prepare(
      'UPDATE shared_members SET wrapped_vault_key = ? WHERE vault_id = ? AND user_id = ?',
    )
    .bind(wrappedVaultKey, vaultId, userId)
    .run();
}

export async function deleteMember(
  db: D1Database,
  vaultId: string,
  userId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM shared_members WHERE vault_id = ? AND user_id = ?')
    .bind(vaultId, userId)
    .run();
}

/** 轮换密钥后提升 epoch，便于对端检测需重新解包 */
export async function bumpKeyEpoch(
  db: D1Database,
  vaultId: string,
  epoch: number,
): Promise<void> {
  await db
    .prepare('UPDATE shared_vaults SET key_epoch = ? WHERE vault_id = ?')
    .bind(epoch, vaultId)
    .run();
}

// ---- shared_meta（per-record LWW，作用域为 vault_id） ----

export async function getSharedMeta(
  db: D1Database,
  vaultId: string,
  recordId: string,
): Promise<SharedMetaRow | null> {
  return await db
    .prepare(
      'SELECT record_id, updated_at, blob_ref, hmac FROM shared_meta WHERE vault_id = ? AND record_id = ?',
    )
    .bind(vaultId, recordId)
    .first<SharedMetaRow>();
}

export async function upsertSharedMeta(
  db: D1Database,
  vaultId: string,
  meta: SharedMetaRow,
): Promise<void> {
  await db
    .prepare('DELETE FROM shared_meta WHERE vault_id = ? AND record_id = ?')
    .bind(vaultId, meta.record_id)
    .run();
  await db
    .prepare(
      'INSERT INTO shared_meta (vault_id, record_id, updated_at, blob_ref, hmac) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(vaultId, meta.record_id, meta.updated_at, meta.blob_ref, meta.hmac)
    .run();
}

export async function listSharedMeta(
  db: D1Database,
  vaultId: string,
  since?: number,
): Promise<SharedMetaRow[]> {
  if (since != null) {
    const r = await db
      .prepare(
        'SELECT record_id, updated_at, blob_ref, hmac FROM shared_meta WHERE vault_id = ? AND updated_at > ?',
      )
      .bind(vaultId, since)
      .all<SharedMetaRow>();
    return r.results ?? [];
  }
  const r = await db
    .prepare(
      'SELECT record_id, updated_at, blob_ref, hmac FROM shared_meta WHERE vault_id = ?',
    )
    .bind(vaultId)
    .all<SharedMetaRow>();
  return r.results ?? [];
}

export async function deleteSharedMeta(
  db: D1Database,
  vaultId: string,
  recordId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM shared_meta WHERE vault_id = ? AND record_id = ?')
    .bind(vaultId, recordId)
    .run();
}
