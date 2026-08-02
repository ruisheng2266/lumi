# Lumi 留存查询 & 看板

基于 `analytics_events` 表（迁移 `0005_analytics.sql`）按 `install_id` 计算留存与活跃度。
所有查询均为匿名聚合，不读取任何个人信息或周期内容。

## 1. 实时看板（推荐）

部署后访问：

```
https://lumi365.com/retention.html?code=<ADMIN_CODE>
```

数据接口：`GET /api/admin/retention`（受 `ADMIN_CODE` 保护，与激活码管理端点共用同一口令）。
返回 KPI（总安装/总事件/近7日活跃/近30日活跃）、留存曲线、同期群规模、事件 TOP 20。

## 2. 命令行直接查询（wrangler d1）

> 提示：`wrangler d1 execute` 一次只返回**最后一条**语句的结果。
> 因此把下面每条查询**单独**执行（用 `--command="..."` 或每条存成单独文件）。

### 2.1 KPI 总览

```bash
wrangler d1 execute lumi-db --remote --command="
SELECT
  (SELECT COUNT(DISTINCT install_id) FROM analytics_events) AS total_installs,
  (SELECT COUNT(*) FROM analytics_events) AS total_events,
  (SELECT COUNT(DISTINCT install_id) FROM analytics_events WHERE ts >= strftime('%s','now','-7 days')*1000) AS active_7d,
  (SELECT COUNT(DISTINCT install_id) FROM analytics_events WHERE ts >= strftime('%s','now','-30 days')*1000) AS active_30d;
"
```

### 2.2 留存曲线（距首次使用天数 → 留存安装数）

```bash
wrangler d1 execute lumi-db --remote --command="
WITH first_day AS (
  SELECT install_id, date(min(ts)/1000, 'unixepoch') AS d0
  FROM analytics_events GROUP BY install_id
),
active_days AS (
  SELECT f.install_id,
         CAST(julianday(date(a.ts/1000,'unixepoch')) - julianday(f.d0) AS INTEGER) AS day_offset
  FROM first_day f
  JOIN analytics_events a ON a.install_id = f.install_id
  GROUP BY f.install_id, day_offset
)
SELECT day_offset, COUNT(DISTINCT install_id) AS retained
FROM active_days GROUP BY day_offset ORDER BY day_offset ASC;
"
```

计算留存率：`retentionPct(day) = retained(day) / retained(0) * 100`。`retained(0)` 即同期群总规模。

### 2.3 同期群规模（按首次使用日）

```bash
wrangler d1 execute lumi-db --remote --command="
WITH first_day AS (
  SELECT install_id, date(min(ts)/1000, 'unixepoch') AS d0
  FROM analytics_events GROUP BY install_id
)
SELECT d0 AS cohort_day, COUNT(*) AS installs
FROM first_day GROUP BY d0 ORDER BY d0 DESC LIMIT 60;
"
```

### 2.4 事件 TOP 20

```bash
wrangler d1 execute lumi-db --remote --command="
SELECT name, COUNT(*) AS count, COUNT(DISTINCT install_id) AS installs
FROM analytics_events GROUP BY name ORDER BY count DESC LIMIT 20;
"
```

## 3. 字段说明

| 列 | 含义 |
| --- | --- |
| `install_id` | 设备级匿名 ID（localStorage，非 PII） |
| `name` | 事件名，如 `app_open` / `period_added` / `log_added` |
| `ts` | 事件时间（epoch 毫秒） |
| `props` | 事件附带属性（可选，JSON 字符串，≤512B） |
| `app_version` | 上报时客户端版本 |
| `locale` | 客户端语言 |

## 4. 前置条件

- 已部署 `0005_analytics.sql` 迁移（v0.7.0 起自动 apply）。
- 已配置 `ADMIN_CODE` secret（`wrangler secret put ADMIN_CODE`），看板与激活码管理端点共用。

## 5. 已知限制

- **Web 无法后台精确排程通知**：周期提醒仅在应用打开时 best-effort 触发（`src/shared/notifications.ts`），因此 `app_open` 与 `period_added` 的真实活跃度会略低于原生 App。可靠定时需后续引入 Push API + 后端（路线图待定）。
- 留存以「自然日」为桶（D1 `date()` 按 UTC），跨时区安装日的边界以 UTC 计。
