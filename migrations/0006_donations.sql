-- 打赏匿名聚合统计（2026-08-03）
-- 仅记录 {currency, amount, amount_usd, ts}，不含任何用户身份（无 user_id / 姓名 / 邮箱）。
-- 只覆盖「海外 PayPal 捐赠」路径（国内微信/支付宝扫码直接进个人账户，Lumi 后端无事件、无法统计）。
-- 仅供 ADMIN_CODE 看板读取，绝不向前端普通用户展示。

CREATE TABLE IF NOT EXISTS donations_aggregate (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT NOT NULL,
  amount REAL NOT NULL,
  amount_usd REAL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donations_ts ON donations_aggregate(ts);
