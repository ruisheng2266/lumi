/**
 * functions/utils/billing-config.ts
 * Phase 3 价格与激活码工具（供各 billing 端点共用）。
 */

import type { Plan } from './subscription-db';

/** 海外以 USD 计价（PayPal）。价格可在此集中调整。 */
export const PRICES = {
  /** 创始终身（$ 一次性） */
  founderUsd: '29.99',
  /** Plus 年付（$/年） */
  plusUsd: '19.99',
} as const;

/** 对激活码明文做 SHA-256 hex（与兑换端一致） */
export async function hashActivationCode(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(raw.trim().toUpperCase()),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32（去易混 I L O U）

/** 生成单个激活码明文：XXXXXX-XXXXXX（Crockford base32，12 字符） */
export function generateActivationCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % 32];
  return `${out.slice(0, 6)}-${out.slice(6, 12)}`;
}

export function isValidPlan(p: string): p is Plan {
  return p === 'plus' || p === 'founder';
}
