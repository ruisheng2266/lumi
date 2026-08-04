/**
 * functions/api/share/revoke.ts
 * 创建者撤销某成员的共享访问。
 *
 * 零知识正确的撤销 = 轮换共享 vault 密钥 + 重加密全部共享 blob（由创建者客户端完成，
 * 因为服务端永远看不到明文共享密钥 / 记录）。本端点负责：删除被撤销成员行、用新包裹密钥
 * 更新剩余 active 成员、提升 key_epoch。被撤销方即使曾缓存旧密钥，也无法解密新 blob。
 *
 * 客户端应先：① 用新共享 vault 密钥重加密全部共享记录并 PUT /api/share/sync；
 *             ② 用剩余成员公钥包裹新密钥；③ 调用本端点提交新包裹密钥与新 epoch。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import {
  getMember,
  getSharedVault,
  listActiveMembers,
  updateMemberWrappedKey,
  deleteMember,
  bumpKeyEpoch,
} from '../../utils/share-db';
import { json, isB64ish } from '../../utils/http';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

export const onRequestPost: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    let body: {
      vaultId?: string;
      memberUserId?: string;
      newWrappedKeys?: Record<string, string>;
      newEpoch?: number;
    };
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }
    const { vaultId, memberUserId, newWrappedKeys, newEpoch } = body;
    if (
      typeof vaultId !== 'string' ||
      typeof memberUserId !== 'string' ||
      typeof newEpoch !== 'number' ||
      !newWrappedKeys ||
      typeof newWrappedKeys !== 'object'
    ) {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    // 必须是该 vault 的 owner
    const me = await getMember(context.env.DB, vaultId, userId);
    if (!me || me.role !== 'owner') {
      return json({ error: 'forbidden' }, { status: 403 });
    }
    // 被撤销者必须是该 vault 的成员
    const target = await getMember(context.env.DB, vaultId, memberUserId);
    if (!target) {
      return json({ error: 'member_not_found' }, { status: 404 });
    }

    const vault = await getSharedVault(context.env.DB, vaultId);
    if (!vault) return json({ error: 'vault_not_found' }, { status: 404 });

    // 删除被撤销成员行（实质切断其访问）
    await deleteMember(context.env.DB, vaultId, memberUserId);

    // 用创建者客户端提交的新包裹密钥更新剩余 active 成员
    const remaining = await listActiveMembers(context.env.DB, vaultId);
    for (const m of remaining) {
      const wrapped = newWrappedKeys[m.user_id];
      if (typeof wrapped !== 'string' || !isB64ish(wrapped)) {
        return json({ error: 'missing_wrapped_key', userId: m.user_id }, { status: 400 });
      }
      await updateMemberWrappedKey(context.env.DB, vaultId, m.user_id, wrapped);
    }

    // 提升 epoch（若确实递增）
    if (newEpoch > vault.key_epoch) {
      await bumpKeyEpoch(context.env.DB, vaultId, newEpoch);
    }

    return json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};
