/**
 * src/shared/sync/crypto.ts
 * Phase 2 E2EE 同步的浏览器端加密层（纯 WebCrypto，无外部依赖）。
 *
 * 设计（对称 vault 方案，详见 docs/V1.0-ACCOUNT-SYSTEM-DESIGN.md §2 缺口②）：
 *  - vault 密钥：随机 256-bit AES-GCM 密钥，用于加解密每条本地记录。
 *  - passphrase 密钥：PBKDF2(passphrase, salt) 派生的 256-bit 密钥，用于「包裹」vault 密钥。
 *  - 恢复码：每个恢复码各自用 PBKDF2(code, salt) 派生的密钥再包裹一份 vault 密钥。
 *  - 服务端只存被包裹的 vault 密钥与密文 blob，永远看不到明文 vault 密钥 / passphrase。
 *  - 改口令：仅重新包裹 vault 密钥，不重加密任何记录 blob。
 *  - 恢复码重置口令：用任一未用恢复码解出 vault 密钥 → 用新 passphrase 重新包裹 → 数据不丢。
 */

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const RECOVERY_CODE_COUNT = 10;

// Crockford base32（去掉易混淆的 I L O U），用于可读恢复码
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('WebCrypto 不可用');
  return c;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 将 Uint8Array 转为确定类型的 ArrayBuffer（规避 TS5.7 ArrayBufferLike/SharedArrayBuffer 严格性） */
function buf(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

export function randomSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_BYTES);
  getCrypto().getRandomValues(salt);
  return salt;
}

/** PBKDF2(passphrase/code, salt) → AES-GCM 256 密钥（不可导出，仅用于包裹 vault） */
async function deriveKey(
  secret: string,
  salt: Uint8Array,
  extractable: boolean,
): Promise<CryptoKey> {
  const baseKey = await getCrypto().subtle.importKey(
    'raw',
    buf(new TextEncoder().encode(secret)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return await getCrypto().subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: buf(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

export async function derivePassphraseKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  return deriveKey(passphrase, salt, false);
}

export async function deriveRecoveryKey(
  code: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  return deriveKey(code, salt, false);
}

/** 生成一个全新的 vault 密钥（可导出，以便多次包裹） */
export async function generateVaultKey(): Promise<CryptoKey> {
  return await getCrypto().subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** 用包裹密钥（passphrase 或恢复码派生的密钥）包裹 vault 密钥 → base64(iv||ct) */
export async function wrapVaultKey(
  vaultKey: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<string> {
  const raw = await getCrypto().subtle.exportKey('raw', vaultKey);
  const iv = new Uint8Array(IV_BYTES);
  getCrypto().getRandomValues(iv);
  const ct = await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, raw);
  return bytesToB64(iv) + '|' + bytesToB64(new Uint8Array(ct));
}

/** 解包 vault 密钥 */
export async function unwrapVaultKey(
  wrapped: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  const [ivB64, ctB64] = wrapped.split('|');
  if (!ivB64 || !ctB64) throw new Error('包裹格式错误');
  const iv = b64ToBytes(ivB64);
  const ct = b64ToBytes(ctB64);
  const raw = await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, wrappingKey, buf(ct));
  return await getCrypto().subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/** 加密一条记录（JSON 序列化） → { blob, hmac }
 *
 *  blob 格式：base64(iv||ct)，即 IV（12 字节）和密文拼接后整体 base64。
 *  不使用分隔符，保证 blob 是纯净的 base64 字符串（服务端可直接 atob 存 R2）。
 */
export async function encryptRecord(
  vaultKey: CryptoKey,
  record: unknown,
): Promise<{ blob: string; hmac: string }> {
  const plaintext = buf(new TextEncoder().encode(JSON.stringify(record)));
  const iv = new Uint8Array(IV_BYTES);
  getCrypto().getRandomValues(iv);
  const ct = await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, plaintext);
  // 拼接 IV + 密文 → 整体 base64（无分隔符，服务端可安全 atob）
  const combined = new Uint8Array(IV_BYTES + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), IV_BYTES);
  const blob = bytesToB64(combined);
  const digest = await getCrypto().subtle.digest('SHA-256', buf(new TextEncoder().encode(blob)));
  const hmac = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { blob, hmac };
}

/** 解密一条记录
 *
 *  blob 格式：base64(iv||ct)，解码后前 IV_BYTES 字节为 IV，余下为密文。
 */
export async function decryptRecord<T = unknown>(
  vaultKey: CryptoKey,
  blob: string,
): Promise<T> {
  const combined = b64ToBytes(blob);
  if (combined.length < IV_BYTES) throw new Error('blob 过短');
  const iv = combined.slice(0, IV_BYTES);
  const ct = combined.slice(IV_BYTES);
  const plaintext = await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, vaultKey, buf(ct));
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

function randomBase32(len: number): string {
  const bytes = new Uint8Array(len);
  getCrypto().getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += BASE32_ALPHABET[b % 32];
  return out;
}

/** 生成一个可读恢复码（5 组 × 4 字符） */
export function generateRecoveryCode(): string {
  return randomBase32(20).match(/.{1,4}/g)!.join('-');
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => generateRecoveryCode());
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const digest = await getCrypto().subtle.digest('SHA-256', buf(new TextEncoder().encode(code)));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// 用户级非对称密钥对（Phase 4 伴侣加密共享，RSA-OAEP 2048）
//
// 设计（见 docs/PHASE4-SHARING.md §3）：
//  - 每用户一对 RSA-OAEP 密钥，用于「密钥投递」：把共享 vault 密钥用对方公钥包裹，
//    对方用自身私钥解开。服务端只存公钥（明文、非敏感）与被公钥包裹的共享密钥。
//  - 复用 wrapVaultKey/unwrapVaultKey 的对称包裹逻辑存储「私钥」：私钥用同步口令派生的
//    密钥包裹后存 D1（与 vault 密钥同等保护），解锁同步时一并解开。
//  - 共享 vault 与私有 vault 只是两把不同的 AES-GCM vault 密钥，encryptRecord/decryptRecord
//    完全复用。
// ---------------------------------------------------------------------------

export interface UserKeyPair {
  /** 公钥 SPKI 编码 base64（明文存 D1，非敏感） */
  publicKeySpkiB64: string;
  /** 私钥（extractable，便于用口令派生密钥包裹后上传） */
  privateKey: CryptoKey;
}

/** 生成一对 RSA-OAEP 2048 用户密钥（用于伴侣间共享密钥投递） */
export async function generateUserKeyPair(): Promise<UserKeyPair> {
  const kp = await getCrypto().subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['wrapKey', 'unwrapKey'],
  );
  const spki = await getCrypto().subtle.exportKey('spki', kp.publicKey);
  return {
    publicKeySpkiB64: bytesToB64(new Uint8Array(spki)),
    privateKey: kp.privateKey,
  };
}

/**
 * 用「口令派生密钥」包裹用户私钥 → base64(iv)|base64(ct)。
 * 私钥是 RSA 密钥，导出格式必须是 pkcs8（不能像对称密钥那样用 'raw'）。
 */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<string> {
  const pkcs8 = await getCrypto().subtle.exportKey('pkcs8', privateKey);
  const iv = new Uint8Array(IV_BYTES);
  getCrypto().getRandomValues(iv);
  const ct = await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, pkcs8);
  return bytesToB64(iv) + '|' + bytesToB64(new Uint8Array(ct));
}

/** 解开被口令派生密钥包裹的用户私钥 */
export async function unwrapPrivateKey(
  wrapped: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  const [ivB64, ctB64] = wrapped.split('|');
  if (!ivB64 || !ctB64) throw new Error('包裹格式错误');
  const iv = b64ToBytes(ivB64);
  const ct = b64ToBytes(ctB64);
  const pkcs8 = await getCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: buf(iv) },
    wrappingKey,
    buf(ct),
  );
  return await getCrypto().subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['unwrapKey'],
  );
}

/** 从 base64 SPKI 导入对方公钥（用于包裹共享 vault 密钥） */
export async function importPublicKeySpki(spkiB64: string): Promise<CryptoKey> {
  const bytes = b64ToBytes(spkiB64);
  return await getCrypto().subtle.importKey(
    'spki',
    buf(bytes),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['wrapKey'],
  );
}

/** 用对方公钥包裹共享 vault 密钥 → base64（RSA-OAEP wrapKey，一步完成） */
export async function wrapVaultKeyForUser(
  vaultKey: CryptoKey,
  partnerPublicKey: CryptoKey,
): Promise<string> {
  const wrapped = await getCrypto().subtle.wrapKey('raw', vaultKey, partnerPublicKey, {
    name: 'RSA-OAEP',
  });
  return bytesToB64(new Uint8Array(wrapped));
}

/** 用自身私钥解开被对方公钥包裹的共享 vault 密钥 */
export async function unwrapVaultKeyWithPrivate(
  wrappedB64: string,
  userPrivateKey: CryptoKey,
): Promise<CryptoKey> {
  return await getCrypto().subtle.unwrapKey(
    'raw',
    buf(b64ToBytes(wrappedB64)),
    userPrivateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}
