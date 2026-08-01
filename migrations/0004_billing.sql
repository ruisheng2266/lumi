-- Phase 3 Plus 订阅与激活码（2026-08-01）
-- 仅 CREATE TABLE IF NOT EXISTS，避开 D1 不支持的 ALTER/RENAME 陷阱。

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  plan TEXT NOT NULL,                 -- free | plus | founder
  provider TEXT,                     -- paypal | code | null
  provider_sub_id TEXT,              -- PayPal order/subscription id 或激活码 hash（幂等去重）
  expires_at INTEGER,                -- NULL = 永久（founder / 永久码）；Plus 订阅填续费时间
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activation_codes (
  code_hash TEXT PRIMARY KEY,        -- SHA-256(明文码)，不存明文
  plan TEXT NOT NULL,                -- plus | founder
  expires_at INTEGER,                -- 码自身的可兑换有效期（NULL = 永久可兑换）；区别于订阅的 expires_at
  used_by TEXT,                      -- 兑换用户 id；非空即已用
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activation_codes_plan ON activation_codes(plan);
CREATE INDEX IF NOT EXISTS idx_activation_codes_used ON activation_codes(used_by);
