-- Phase 4 匿名使用统计（2026-08-02）
-- 仅 CREATE TABLE IF NOT EXISTS，避开 D1 不支持的 ALTER/RENAME 陷阱。

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  install_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ts INTEGER NOT NULL,
  props TEXT,
  app_version TEXT,
  locale TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_install ON analytics_events(install_id);
CREATE INDEX IF NOT EXISTS idx_analytics_name ON analytics_events(name);
CREATE INDEX IF NOT EXISTS idx_analytics_ts ON analytics_events(ts);
