-- 0002: 补齐 users 表缺失的 apple_id 列
-- users 表在 0001 之前已存在（旧 schema 无 apple_id），
-- CREATE TABLE IF NOT EXISTS 跳过了建表，导致 apple_id 列不存在。
--
-- 注意：D1 (SQLite) 不支持 ALTER TABLE ADD COLUMN + UNIQUE，
-- 所以分两步：先加列，再建唯一索引。

ALTER TABLE users ADD COLUMN apple_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id);
