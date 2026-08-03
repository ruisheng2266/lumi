/**
 * functions/utils/subscription-db.ts
 * Phase 3 Plus 订阅 / 激活码 的 D1 数据访问层 + 权益计算。
 *
 * 关键概念：
 *  - plan: free | plus | founder
 *  - syncEntitled（同步权益）：plan != free（已订阅）  OR  存在旧 key_backup 行（Phase 2 免费期已启用同步的老用户，祖父保留免费同步）
 *  - 订阅过期（expires_at 在过去）视为 free，但祖父用户仍保留同步
 */

import type { D1Database } from './types';
import { getKeyBackup } from './sync-db';

export type Plan = 'free' | 'plus' | 'founder';

/** Plus 的计费周期。founder / 激活码为 null（非循环订阅）。 */
export type BillingCycle = 'monthly' | 'annual' | null;

export interface SubscriptionRow {
  plan: Plan;
  provider: string | null;
  provider_sub_id: string | null;
  billing_cycle: BillingCycle;
  expires_at: number | null;
  created_at: number;
}

export interface ActivationCodeRow {
  code_hash: string;
  plan: Plan;
  expires_at: number | null;
  used_by: string | null;
  created_at: number;
}

export interface Entitlement {
  plan: Plan;
  expiresAt: number | null;
  /** Plus 的计费周期（月付 / 年付）；非循环订阅为 null */
  billingCycle: BillingCycle;
  /** 是否允许使用跨设备同步（已订阅，或祖父老用户） */
  syncEntitled: boolean;
}

/** 读取用户当前有效订阅（过期视为无） */
export async function getSubscription(
  db: D1Database,
  userId: string,
): Promise<SubscriptionRow | null> {
  return await db
    .prepare(
      'SELECT plan, provider, provider_sub_id, billing_cycle, expires_at, created_at FROM subscriptions WHERE user_id = ?',
    )
    .bind(userId)
    .first<SubscriptionRow>();
}

/** 写入 / 覆盖订阅（upsert，幂等） */
export async function upsertSubscription(
  db: D1Database,
  userId: string,
  data: {
    plan: Plan;
    provider: string | null;
    provider_sub_id: string | null;
    billing_cycle: BillingCycle;
    expires_at: number | null;
  },
): Promise<void> {
  await db.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(userId).run();
  await db
    .prepare(
      'INSERT INTO subscriptions (user_id, plan, provider, provider_sub_id, billing_cycle, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      userId,
      data.plan,
      data.provider,
      data.provider_sub_id,
      data.billing_cycle,
      data.expires_at,
      Date.now(),
    )
    .run();
}

/** 读取单个激活码（按 hash） */
export async function getActivationCode(
  db: D1Database,
  codeHash: string,
): Promise<ActivationCodeRow | null> {
  return await db
    .prepare(
      'SELECT code_hash, plan, expires_at, used_by, created_at FROM activation_codes WHERE code_hash = ?',
    )
    .bind(codeHash)
    .first<ActivationCodeRow>();
}

/** 兑换激活码：标记 used_by（幂等，重复兑换同一码不会改写订阅） */
export async function redeemActivationCode(
  db: D1Database,
  userId: string,
  codeHash: string,
): Promise<void> {
  await db
    .prepare('UPDATE activation_codes SET used_by = ? WHERE code_hash = ? AND used_by IS NULL')
    .bind(userId, codeHash)
    .run();
}

/** 批量写入激活码（管理端点生成时调用） */
export async function createActivationCodes(
  db: D1Database,
  codes: { code_hash: string; plan: Plan; expires_at: number | null }[],
): Promise<void> {
  for (const c of codes) {
    await db
      .prepare(
        'INSERT OR IGNORE INTO activation_codes (code_hash, plan, expires_at, used_by, created_at) VALUES (?, ?, ?, NULL, ?)',
      )
      .bind(c.code_hash, c.plan, c.expires_at, Date.now())
      .run();
  }
}

/**
 * 计算用户同步权益：
 *  - plan != free 且未过期 → 已订阅，syncEntitled = true
 *  - plan = free → 若 Phase 2 期间已启用同步（存在 key_backup 行），祖父保留免费同步
 *  - 订阅过期视为 free，但祖父用户仍保留同步
 */
export async function getSyncEntitlement(
  db: D1Database,
  userId: string,
): Promise<Entitlement> {
  const sub = await getSubscription(db, userId);
  const now = Date.now();
  let plan: Plan = 'free';
  let expiresAt: number | null = null;

  if (sub) {
    const notExpired = sub.expires_at == null || sub.expires_at > now;
    if (notExpired) {
      plan = sub.plan;
      expiresAt = sub.expires_at;
    }
  }

  let syncEntitled = plan !== 'free';
  if (!syncEntitled) {
    const kb = await getKeyBackup(db, userId);
    if (kb) syncEntitled = true; // 祖父条款
  }

  return { plan, expiresAt, billingCycle: sub?.billing_cycle ?? null, syncEntitled };
}
