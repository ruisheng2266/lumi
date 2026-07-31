-- 0003: Phase 2 E2EE 同步所需的列
-- 采用对称 vault 方案（见 docs/V1.0-ACCOUNT-SYSTEM-DESIGN.md §2 缺口②）：
--   key_backup.wrapped_vault_key  存储「passphrase 派生的密钥包裹后的 vault 密钥」（base64(iv||ct)）
--   recovery_codes.wrapped_vault_key 每个恢复码单独包裹一份 vault 密钥（base64(iv||ct)）
--
-- 注意：D1 (SQLite) 对 ALTER 有历史坑（不支持 ADD ... UNIQUE），这里只用 ADD COLUMN，最稳。
-- key_backup 原有的 wrapped_private_key 列保留不用（Apple 未启用），不重命名以避免 RENAME COLUMN 风险。

ALTER TABLE key_backup ADD COLUMN wrapped_vault_key TEXT;
ALTER TABLE recovery_codes ADD COLUMN wrapped_vault_key TEXT;
