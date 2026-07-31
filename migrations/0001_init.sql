-- Lumi D1 初始化迁移（缺口①）
-- 补齐缺失的建表语句，否则空库登录必 500。

-- 用户（Google / Apple 至少其一非空）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE,
  apple_id TEXT UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL,
  CHECK (google_id IS NOT NULL OR apple_id IS NOT NULL)
);

-- 会话（30 天长效）
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Plus 订阅
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  plan TEXT NOT NULL,            -- free | plus | founder
  provider TEXT,                 -- paypal | code | null
  provider_sub_id TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 端到端加密同步（元数据索引放 D1，密文放 R2，Phase 2）
CREATE TABLE IF NOT EXISTS sync_meta (
  user_id TEXT NOT NULL REFERENCES users(id),
  record_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  blob_ref TEXT NOT NULL,        -- R2 key
  hmac TEXT NOT NULL,
  PRIMARY KEY (user_id, record_id)
);

-- 加密私钥备份（passphrase 加密后存）
CREATE TABLE IF NOT EXISTS key_backup (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  wrapped_private_key TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 紧急恢复码（passphrase 遗忘兜底；hash 后存储，一次性使用，Phase 2）
CREATE TABLE IF NOT EXISTS recovery_codes (
  user_id TEXT NOT NULL REFERENCES users(id),
  code_hash TEXT NOT NULL,        -- Argon2id/SHA-256 hash，非明文
  used_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, code_hash)
);
