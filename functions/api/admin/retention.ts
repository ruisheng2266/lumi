/**
 * functions/api/admin/retention.ts
 * 增长看板：按 install_id 计算留存与活跃度（Phase 4 匿名统计，2026-08-02）。
 *
 *  GET /api/admin/retention  （Header: x-admin-code: <ADMIN_CODE>  或  ?code=<ADMIN_CODE>）
 *  - 复用与 gen-codes 相同的 ADMIN_CODE 保护
 *  - 仅读取 analytics_events，不触碰任何个人信息 / 周期内容
 *
 * 返回：
 *  - summary        KPI：总安装数 / 总事件数 / 近7日活跃 / 近30日活跃
 *  - cohortSize     同期群总规模（= 首日活跃安装数）
 *  - retentionCurve 按「距首次使用天数」(day_offset) 的留存曲线
 *  - cohorts        按首次使用日分组的同期群规模（近 60 天）
 *  - topEvents      事件名计数 TOP 20
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

interface Summary {
  total_installs: number;
  total_events: number;
  active_7d: number;
  active_30d: number;
}
interface CurveRow {
  day_offset: number;
  retained: number;
}
interface CohortRow {
  cohort_day: string;
  installs: number;
}
interface EventRow {
  name: string;
  count: number;
  installs: number;
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
    const d7 = now - 7 * 86_400_000;
    const d30 = now - 30 * 86_400_000;

    const summary = (await db
      .prepare(
        `SELECT
           (SELECT COUNT(DISTINCT install_id) FROM analytics_events) AS total_installs,
           (SELECT COUNT(*) FROM analytics_events) AS total_events,
           (SELECT COUNT(DISTINCT install_id) FROM analytics_events WHERE ts >= ?) AS active_7d,
           (SELECT COUNT(DISTINCT install_id) FROM analytics_events WHERE ts >= ?) AS active_30d`,
      )
      .bind(d7, d30)
      .first<Summary>()) ?? { total_installs: 0, total_events: 0, active_7d: 0, active_30d: 0 };

    // 留存曲线：以「首次使用日」为 cohort 第 0 天，统计每个 day_offset 仍活跃的安装数
    const curveRows = await db
      .prepare(
        `WITH first_day AS (
           SELECT install_id, date(min(ts)/1000, 'unixepoch') AS d0
           FROM analytics_events
           GROUP BY install_id
         ),
         active_days AS (
           SELECT f.install_id,
                  CAST(julianday(date(a.ts/1000, 'unixepoch')) - julianday(f.d0) AS INTEGER) AS day_offset
           FROM first_day f
           JOIN analytics_events a ON a.install_id = f.install_id
           GROUP BY f.install_id, day_offset
         )
         SELECT day_offset, COUNT(DISTINCT install_id) AS retained
         FROM active_days
         GROUP BY day_offset
         ORDER BY day_offset ASC`,
      )
      .bind()
      .all<CurveRow>();
    const curve = curveRows.results;
    const cohortSize = curve.find((r) => r.day_offset === 0)?.retained ?? 0;
    const retentionCurve = curve.map((r) => ({
      day: r.day_offset,
      retained: r.retained,
      retentionPct: cohortSize > 0 ? Math.round((r.retained / cohortSize) * 1000) / 10 : 0,
    }));

    const cohortRows = await db
      .prepare(
        `WITH first_day AS (
           SELECT install_id, date(min(ts)/1000, 'unixepoch') AS d0
           FROM analytics_events GROUP BY install_id
         )
         SELECT d0 AS cohort_day, COUNT(*) AS installs
         FROM first_day GROUP BY d0 ORDER BY d0 DESC LIMIT 60`,
      )
      .bind()
      .all<CohortRow>();
    const cohorts = cohortRows.results;

    const eventRows = await db
      .prepare(
        `SELECT name, COUNT(*) AS count, COUNT(DISTINCT install_id) AS installs
         FROM analytics_events GROUP BY name ORDER BY count DESC LIMIT 20`,
      )
      .bind()
      .all<EventRow>();
    const topEvents = eventRows.results;

    return json({
      ok: true,
      generated_at: now,
      summary,
      cohortSize,
      retentionCurve,
      cohorts,
      topEvents,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'query_error', detail }, { status: 500 });
  }
};
