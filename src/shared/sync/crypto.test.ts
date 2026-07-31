/**
 * src/shared/sync/crypto.test.ts
 * Phase 2 浏览器端加密层单测（纯 WebCrypto 往返）。
 */
import { describe, it, expect } from 'vitest';
import {
  randomSalt,
  derivePassphraseKey,
  deriveRecoveryKey,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  encryptRecord,
  decryptRecord,
  generateRecoveryCodes,
  hashRecoveryCode,
} from './crypto';

describe('sync crypto', () => {
  it('vault 密钥可经 passphrase 包裹后还原', async () => {
    const salt = randomSalt();
    const vault = await generateVaultKey();
    const passKey = await derivePassphraseKey('correct horse', salt);
    const wrapped = await wrapVaultKey(vault, passKey);
    const restored = await unwrapVaultKey(wrapped, passKey);
    expect(restored).toBeTruthy();
  });

  it('错误 passphrase 无法解包 vault 密钥', async () => {
    const salt = randomSalt();
    const vault = await generateVaultKey();
    const wrapped = await wrapVaultKey(vault, await derivePassphraseKey('right', salt));
    await expect(unwrapVaultKey(wrapped, await derivePassphraseKey('wrong', salt))).rejects.toThrow();
  });

  it('记录加解密往返保持数据一致', async () => {
    const vault = await generateVaultKey();
    const sample = { startDate: '2026-01-01', notes: 'hello 世界', flow: 'medium' as const };
    const { blob, hmac } = await encryptRecord(vault, sample);
    expect(typeof blob).toBe('string');
    expect(hmac).toMatch(/^[0-9a-f]{64}$/);
    const out = await decryptRecord<typeof sample>(vault, blob);
    expect(out).toEqual(sample);
  });

  it('恢复码：数量正确、格式为 4×4 分组、哈希确定', async () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    for (const c of codes) {
      expect(c.split('-')).toHaveLength(5);
      expect(c).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/);
    }
    const h1 = await hashRecoveryCode(codes[0]);
    const h2 = await hashRecoveryCode(codes[0]);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('派生 recovery 密钥与 passphrase 密钥不同', async () => {
    const salt = randomSalt();
    const pk = await derivePassphraseKey('secret', salt);
    const rk = await deriveRecoveryKey('secret', salt);
    expect(pk).not.toBe(rk);
  });
});
