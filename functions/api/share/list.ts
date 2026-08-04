/**
 * functions/api/share/list.ts
 * 返回当前用户参与的全部共享 vault（含自身角色 / 状态 / 被包裹密钥 / 对端状态）。
 * 伴侣免费即可查看（不查 plan）。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { listMemberships } from '../../utils/share-db';
import { json } from '../../utils/http';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

export const onRequestGet: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    const memberships = await listMemberships(context.env.DB, userId);
    return json({
      ok: true,
      vaults: memberships.map((m) => ({
        vaultId: m.vaultId,
        ownerUserId: m.ownerUserId,
        keyEpoch: m.keyEpoch,
        role: m.myRole,
        status: m.myStatus,
        wrappedVaultKey: m.myWrappedVaultKey,
        partner: m.partner,
      })),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};
