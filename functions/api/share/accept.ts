/**
 * functions/api/share/accept.ts
 * 伴侣接受共享邀请：pending → active。
 * 伴侣免费即可 accept（不查 plan）；之后即可用自身私钥解开共享 vault 密钥并同步。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { getMember, acceptMembership } from '../../utils/share-db';
import { json } from '../../utils/http';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

export const onRequestPost: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    let body: { vaultId?: string };
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }
    const { vaultId } = body;
    if (typeof vaultId !== 'string') {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    const member = await getMember(context.env.DB, vaultId, userId);
    if (!member) return json({ error: 'not_member' }, { status: 403 });
    if (member.status === 'active') {
      return json({ ok: true, alreadyActive: true });
    }
    if (member.status !== 'pending') {
      return json({ error: 'invalid_state' }, { status: 409 });
    }

    await acceptMembership(context.env.DB, vaultId, userId);
    return json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};
