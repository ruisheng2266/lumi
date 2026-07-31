-- 0002: 补齐 users 表缺失的 apple_id 列
-- users 表在 0001 之前已存在（旧 schema 无 apple_id），
-- CREATE TABLE IF NOT EXISTS 跳过了建表，导致 apple_id 列不存在。
-- 此迁移为 ALTER TABLE 补列。

ALTER TABLE users ADD COLUMN apple_id TEXT UNIQUE;
