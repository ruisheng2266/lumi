/**
 * functions/api/share/invite.ts
 * 创建者发起伴侣共享邀请。
 *
 * 前置：创建者具备同步权益（Plus / founder / 祖父老用户）。
 * 客户端流程：先 GET /api/users/public-key?email= 取得对方公钥 →
 *            本地生成共享 vault 密钥 → 用双方公钥各包裹一份 → POST 本端点。
 * 服务端只存被包裹的密钥与元数据，永远看不到明文共享 vault 密钥。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { getUserId } from '../../utils/auth';
import { getSyncEntitlement } from '../../utils/subscription-db';
import { findUserByEmail, getUserKeyMaterial } from '../../utils/db';
import { createSharedVault } from '../../utils/share-db';
import { json, isB64ish } from '../../utils/http';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

export const onRequestPost: Handler = async (context) => {
  try {
    const userId = await getUserId(context.request, context.env.DB);
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    // 仅创建者（具备同步权益）可发起共享
    const ent = await getSyncEntitlement(context.env.DB, userId);
    if (!ent.syncEntitled) return json({ error: 'upgrade_required' }, { status: 402 });

    let body: {
      partnerEmail?: string;
      ownerWrapped?: string;
      partnerWrapped?: string;
    };
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    const { partnerEmail, ownerWrapped, partnerWrapped } = body;
    if (
      typeof partnerEmail !== 'string' ||
      typeof ownerWrapped !== 'string' ||
      typeof partnerWrapped !== 'string' ||
      !isB64ish(ownerWrapped) ||
      !isB64ish(partnerWrapped)
    ) {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    const partner = await findUserByEmail(context.env.DB, partnerEmail);
    if (!partner) return json({ error: 'user_not_found' }, { status: 404 });
    if (partner.id === userId) {
      return json({ error: 'cannot_share_with_self' }, { status: 400 });
    }
    const partnerKeys = await getUserKeyMaterial(context.env.DB, partner.id);
    if (!partnerKeys?.publicKey) {
      return json({ error: 'partner_not_ready' }, { status: 409 });
    }
    // 创建者自身也必须已生成密钥对，否则无法接收自己那份包裹
    const myKeys = await getUserKeyMaterial(context.env.DB, userId);
    if (!myKeys?.publicKey) {
      return json({ error: 'owner_not_ready' }, { status: 409 });
    }

    const vaultId = crypto.randomUUID();
    const now = Date.now();
    await createSharedVault(context.env.DB, {
      vaultId,
      ownerUserId: userId,
      ownerWrapped,
      partnerUserId: partner.id,
      partnerWrapped,
      now,
    });

    return json({ ok: true, vaultId });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'internal_error', detail }, { status: 500 });
  }
};
