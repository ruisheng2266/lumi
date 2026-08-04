-- 0008: Phase 4 伴侣加密共享所需的数据模型
--
-- 1) 用户级非对称密钥对（RSA-OAEP 2048）：
--      public_key            公钥 SPKI 编码 base64，明文存库（非敏感，仅用于密钥投递）
--      wrapped_private_key   私钥用同步口令派生的密钥包裹后的密文（base64(iv||ct)）
--      private_key_salt      包裹私钥用的 PBKDF2 salt（与 vault 密钥复用同一 salt）
--    复用 0003 的对称包裹逻辑，密钥投递走 RSA-OAEP wrapKey/unwrapKey。
--
-- 2) 共享 vault 三表：shared_vaults / shared_members / shared_meta
--      shared_meta 复用 sync_meta 同款 per-record LWW 语义（客户端读旧值决定写入，服务端不合并）
--      R2 key 加 `shared/{vault_id}/{record_id}` 前缀，与私有同步物理隔离
--
-- 注意：D1 (SQLite) 对 ALTER 有历史坑（不支持 ADD ... UNIQUE），这里只用 ADD COLUMN，最稳。

ALTER TABLE users ADD COLUMN public_key TEXT;
ALTER TABLE users ADD COLUMN wrapped_private_key TEXT;
ALTER TABLE users ADD COLUMN private_key_salt TEXT;

CREATE TABLE IF NOT EXISTS shared_vaults (
  vault_id      TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  key_epoch     INTEGER NOT NULL DEFAULT 1,   -- 轮换密钥时 +1，便于对端检测需重新解包
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shared_vaults_owner ON shared_vaults(owner_user_id);

CREATE TABLE IF NOT EXISTS shared_members (
  vault_id          TEXT NOT NULL REFERENCES shared_vaults(vault_id),
  user_id           TEXT NOT NULL REFERENCES users(id),
  role              TEXT NOT NULL,            -- owner | partner
  wrapped_vault_key TEXT NOT NULL,            -- 用该成员公钥包裹的 shared vault key
  joined_at         INTEGER NOT NULL,
  status            TEXT NOT NULL,            -- pending | active | revoked
  PRIMARY KEY (vault_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_members_user ON shared_members(user_id);

CREATE TABLE IF NOT EXISTS shared_meta (
  vault_id   TEXT NOT NULL,
  record_id  TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  blob_ref   TEXT NOT NULL,
  hmac       TEXT NOT NULL,
  PRIMARY KEY (vault_id, record_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_meta_vault ON shared_meta(vault_id);
