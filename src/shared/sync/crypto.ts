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

/** 加密一条记录（JSON 序列化） → { blob, hmac } */
export async function encryptRecord(
  vaultKey: CryptoKey,
  record: unknown,
): Promise<{ blob: string; hmac: string }> {
  const plaintext = buf(new TextEncoder().encode(JSON.stringify(record)));
  const iv = new Uint8Array(IV_BYTES);
  getCrypto().getRandomValues(iv);
  const ct = await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, plaintext);
  const blob = bytesToB64(iv) + '|' + bytesToB64(new Uint8Array(ct));
  const digest = await getCrypto().subtle.digest('SHA-256', buf(new TextEncoder().encode(blob)));
  const hmac = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { blob, hmac };
}

/** 解密一条记录 */
export async function decryptRecord<T = unknown>(
  vaultKey: CryptoKey,
  blob: string,
): Promise<T> {
  const [ivB64, ctB64] = blob.split('|');
  if (!ivB64 || !ctB64) throw new Error('blob 格式错误');
  const iv = b64ToBytes(ivB64);
  const ct = b64ToBytes(ctB64);
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
