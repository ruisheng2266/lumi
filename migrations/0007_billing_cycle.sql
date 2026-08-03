-- Plus 月付 / 年付分档（2026-08-03）
-- subscriptions 增加 billing_cycle，用于区分 Plus 是月付还是年付（founder / 激活码为 NULL）。
-- D1 (SQLite) 支持 ALTER TABLE ADD COLUMN；避开 RENAME/ALTER 列定义等不支持的语法。

ALTER TABLE subscriptions ADD COLUMN billing_cycle TEXT;
