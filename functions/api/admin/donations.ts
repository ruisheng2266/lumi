/**
 * functions/api/admin/donations.ts
 * 打赏匿名聚合统计看板（2026-08-03）。
 *
 *  GET /api/admin/donations  （Header: x-admin-code: <ADMIN_CODE>  或  ?code=<ADMIN_CODE>）
 *  - 复用与 retention / gen-codes 相同的 ADMIN_CODE 保护
 *  - 仅读取 donations_aggregate（不含任何身份信息）
 *
 * 返回：
 *  - total        { count, total_usd, total_amount }
 *  - last30       { count, sum_usd }（近 30 日）
 *  - byCurrency   [{ currency, count, sum_amount }]
 *  - byMonth      [{ month: 'YYYY-MM', count, sum_usd }]（近 12 月，倒序）
 *  - recent       [{ ts, currency, amount }]（最近 20 笔）
 *
 * 注意：只覆盖海外 PayPal 捐赠（国内微信/支付宝扫码 Lumi 后端无事件，无法统计）。
 */

import type { PagesFunctionContext, D1Database } from '../../utils/types';

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

interface TotalRow {
  count: number;
  total_usd: number;
  total_amount: number;
}
interface CurrencyRow {
  currency: string;
  count: number;
  sum_amount: number;
}
interface MonthRow {
  month: string;
  count: number;
  sum_usd: number;
}
interface RecentRow {
  ts: number;
  currency: string;
  amount: number;
}

export const onRequestGet: Handler = async (context) => {
  try {
    const provided =
      context.request.headers.get('x-admin-code') ??
      new URL(context.request.url).searchParams.get('code');
    const expected = context.env.ADMIN_CODE;
    if (!expected || provided !== expected) {
      return json({ error: 'forbidden' }, { status: 401 });
    }

    const db = context.env.DB;
    const now = Date.now();
    const d30 = now - 30 * 86_400_000;

    const total =
      (await db
        .prepare(
          `SELECT
             COUNT(*) AS count,
             COALESCE(SUM(amount_usd), 0) AS total_usd,
             COALESCE(SUM(amount), 0) AS total_amount
           FROM donations_aggregate`,
        )
        .first<TotalRow>()) ?? { count: 0, total_usd: 0, total_amount: 0 };

    const last30 =
      (await db
        .prepare(
          `SELECT COUNT(*) AS count, COALESCE(SUM(amount_usd), 0) AS sum_usd
           FROM donations_aggregate WHERE ts >= ?`,
        )
        .bind(d30)
        .first<{ count: number; sum_usd: number }>()) ?? { count: 0, sum_usd: 0 };

    const curRows = await db
      .prepare(
        `SELECT currency, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS sum_amount
         FROM donations_aggregate GROUP BY currency ORDER BY count DESC`,
      )
      .bind()
      .all<CurrencyRow>();
    const byCurrency = curRows.results;

    const monthRows = await db
      .prepare(
        `SELECT strftime('%Y-%m', ts/1000, 'unixepoch') AS month,
                COUNT(*) AS count,
                COALESCE(SUM(amount_usd), 0) AS sum_usd
         FROM donations_aggregate
         GROUP BY month ORDER BY month DESC LIMIT 12`,
      )
      .bind()
      .all<MonthRow>();
    const byMonth = monthRows.results;

    const recentRows = await db
      .prepare(
        `SELECT ts, currency, amount FROM donations_aggregate ORDER BY ts DESC LIMIT 20`,
      )
      .bind()
      .all<RecentRow>();
    const recent = recentRows.results;

    return json({
      ok: true,
      generated_at: now,
      note: '仅覆盖海外 PayPal 捐赠；国内微信/支付宝扫码 Lumi 后端无事件，不在统计内。',
      total: {
        count: total.count,
        total_usd: Math.round(total.total_usd * 100) / 100,
        total_amount: Math.round(total.total_amount * 100) / 100,
      },
      last30: {
        count: last30.count,
        sum_usd: Math.round(last30.sum_usd * 100) / 100,
      },
      byCurrency: byCurrency.map((c) => ({
        currency: c.currency,
        count: c.count,
        sum_amount: Math.round(c.sum_amount * 100) / 100,
      })),
      byMonth: byMonth.map((m) => ({
        month: m.month,
        count: m.count,
        sum_usd: Math.round(m.sum_usd * 100) / 100,
      })),
      recent: recent.map((r) => ({
        ts: r.ts,
        currency: r.currency,
        amount: r.amount,
      })),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'query_error', detail }, { status: 500 });
  }
};
