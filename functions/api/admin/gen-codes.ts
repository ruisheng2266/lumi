/**
 * functions/api/admin/gen-codes.ts
 * Phase 3：管理端点 —— 批量生成激活码（受 ADMIN_CODE 保护，无管理 UI）。
 *
 *  POST /api/admin/gen-codes  { count, plan }  （Header: x-admin-code: <ADMIN_CODE>）
 *  - 校验 admin code（来自 Cloudflare secret ADMIN_CODE）
 *  - 生成 count 个码（默认 1，上限 100），明文 SHA-256 入库，返回明文（仅展示一次）
 *  明文一旦返回即不留存，需自行妥善分发给用户。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';
import { createActivationCodes } from '../../utils/subscription-db';
import { generateActivationCode, hashActivationCode, isValidPlan } from '../../utils/billing-config';

interface Env {
  DB: D1Database;
  ADMIN_CODE?: string;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(init?.headers || {}) },
  });
}

export const onRequestPost: Handler = async (context) => {
  try {
    const provided = context.request.headers.get('x-admin-code');
    const expected = context.env.ADMIN_CODE;
    if (!expected || provided !== expected) {
      return json({ error: 'forbidden' }, { status: 401 });
    }

    let body: { count?: number; plan?: string };
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    const count = Math.min(Math.max(Number(body.count) || 1, 1), 100);
    const plan = body.plan;
    if (!plan || !isValidPlan(plan)) {
      return json({ error: 'invalid_plan' }, { status: 400 });
    }

    const plains: string[] = [];
    const rows: { code_hash: string; plan: typeof plan; expires_at: null }[] = [];
    for (let i = 0; i < count; i++) {
      const plain = generateActivationCode();
      const hash = await hashActivationCode(plain);
      plains.push(plain);
      rows.push({ code_hash: hash, plan, expires_at: null });
    }
    await createActivationCodes(context.env.DB, rows);

    return json({ ok: true, count: plains.length, codes: plains });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'gen_error', detail }, { status: 500 });
  }
};
