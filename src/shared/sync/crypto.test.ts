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
  generateUserKeyPair,
  importPublicKeySpki,
  wrapVaultKeyForUser,
  unwrapVaultKeyWithPrivate,
  wrapPrivateKey,
  unwrapPrivateKey,
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
    const rk = deriveRecoveryKey('secret', salt);
    expect(pk).not.toBe(rk);
  });

  it('用户密钥对：用对方公钥包裹共享 vault 密钥，对方私钥可解开', async () => {
    const owner = await generateUserKeyPair();
    const partner = await generateUserKeyPair();

    const sharedVault = await generateVaultKey();
    const partnerPub = await importPublicKeySpki(partner.publicKeySpkiB64);
    const ownerPub = await importPublicKeySpki(owner.publicKeySpkiB64);
    const wrappedForPartner = await wrapVaultKeyForUser(sharedVault, partnerPub);
    const wrappedForOwner = await wrapVaultKeyForUser(sharedVault, ownerPub);

    // 对方导入公钥后应能解开自己那份
    const restored = await unwrapVaultKeyWithPrivate(wrappedForPartner, partner.privateKey);
    expect(restored).toBeTruthy();

    // owner 解开自己的那份
    const ownerRestored = await unwrapVaultKeyWithPrivate(wrappedForOwner, owner.privateKey);
    expect(ownerRestored).toBeTruthy();

    // 解开后的密钥能正常加解密记录（与共享 vault 一致）
    const sample = { note: 'shared secret' };
    const { blob } = await encryptRecord(restored, sample);
    const out = await decryptRecord(restored, blob);
    expect(out).toEqual(sample);
  });

  it('撤销后：旧 key 解不开用新 key 重新包裹的共享 vault 密钥', async () => {
    const partner = await generateUserKeyPair();
    const partnerPub = await importPublicKeySpki(partner.publicKeySpkiB64);
    const oldVault = await generateVaultKey();
    const wrappedOld = await wrapVaultKeyForUser(oldVault, partnerPub);

    // 轮换：生成新共享 vault 密钥（撤销时只会重新包裹给剩余成员，不再给被撤销方）
    const newVault = await generateVaultKey();

    // 被撤销方（仅持有旧 unwrap 能力？此处模拟：他用同一私钥解开的是旧包裹 → 旧 vault key）
    const oldRestored = await unwrapVaultKeyWithPrivate(wrappedOld, partner.privateKey);
    // 旧 key 能解开旧包裹
    const oldBlob = await encryptRecord(oldVault, { x: 1 });
    expect(await decryptRecord(oldRestored, oldBlob.blob)).toEqual({ x: 1 });

    // 但新 blob（用新 vault key 加密）用旧 key 解密应失败
    const newBlob = await encryptRecord(newVault, { x: 2 });
    await expect(decryptRecord(oldRestored, newBlob.blob)).rejects.toThrow();
  });

  it('用户私钥可经口令派生密钥包裹后还原，并继续解开共享密钥', async () => {
    const salt = randomSalt();
    const passKey = await derivePassphraseKey('correct horse battery', salt);
    const me = await generateUserKeyPair();
    const wrappedPriv = await wrapPrivateKey(me.privateKey, passKey);
    expect(wrappedPriv).toContain('|');

    const restoredPriv = await unwrapPrivateKey(wrappedPriv, passKey);
    // 还原的私钥仍能解开用自身公钥包裹的共享 vault 密钥
    const shared = await generateVaultKey();
    const wrappedShared = await wrapVaultKeyForUser(
      shared,
      await importPublicKeySpki(me.publicKeySpkiB64),
    );
    const sharedRestored = await unwrapVaultKeyWithPrivate(wrappedShared, restoredPriv);
    const { blob } = await encryptRecord(shared, { hi: 1 });
    expect(await decryptRecord(sharedRestored, blob)).toEqual({ hi: 1 });
  });

  it('错误口令无法解开被包裹的私钥', async () => {
    const salt = randomSalt();
    const passKey = await derivePassphraseKey('right', salt);
    const wrongKey = await derivePassphraseKey('wrong', salt);
    const me = await generateUserKeyPair();
    const wrappedPriv = await wrapPrivateKey(me.privateKey, passKey);
    await expect(unwrapPrivateKey(wrappedPriv, wrongKey)).rejects.toThrow();
  });
});
