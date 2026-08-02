/**
 * functions/api/analytics.ts
 * 匿名使用统计接收端（增长度量，2026-08-02）。
 *
 * POST /api/analytics
 *   body: { install_id, events: [{ name, ts, props }], v, locale }
 *
 * 设计约束（与隐私定位一致）：
 * - 不要求登录、不读取/存储任何个人信息与周期内容
 * - 不主动采集 IP（Cloudflare 默认不会把 IP 写进 D1，这里也不记录）
 * - 入参做长度/格式校验，防止滥用
 */

import type { PagesFunctionContext, D1Database } from '../utils/types';

interface Env {
  DB: D1Database;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response>;

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init?.headers || {}),
    },
  });
}

const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
const INSTALL_RE = /^[A-Za-z0-9._-]{8,64}$/;

type Row = [string, string, number, string | null, string, string, number];

export const onRequestPost: Handler = async (context) => {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad_json' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const installId = typeof b?.install_id === 'string' ? b.install_id.slice(0, 64) : '';
  if (!INSTALL_RE.test(installId)) {
    return json({ error: 'bad_install_id' }, { status: 400 });
  }

  const events = Array.isArray(b?.events) ? (b.events as unknown[]).slice(0, 50) : [];
  const appVersion = String(b?.v ?? '').slice(0, 32);
  const locale = String(b?.locale ?? '').slice(0, 16);
  const now = Date.now();

  const rows: Row[] = [];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const e = ev as Record<string, unknown>;
    if (typeof e.name !== 'string') continue;
    const name = e.name.slice(0, 40);
    if (!NAME_RE.test(name)) continue;
    const ts = Number.isFinite(e.ts as number) ? Math.floor(e.ts as number) : now;
    let props: string | null = null;
    if (e.props && typeof e.props === 'object') {
      const s = JSON.stringify(e.props);
      if (s.length <= 512) props = s;
    }
    rows.push([installId, name, ts, props, appVersion, locale, now]);
  }

  if (rows.length === 0) {
    return json({ ok: true, ignored: true });
  }

  try {
    const stmt = context.env.DB.prepare(
      'INSERT INTO analytics_events (install_id, name, ts, props, app_version, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    await context.env.DB.batch(rows.map((r) => stmt.bind(...r)));
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'db_error', detail }, { status: 500 });
  }

  return json({ ok: true, count: rows.length }, { status: 202 });
};
