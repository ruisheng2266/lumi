// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  generateAppleClientSecret,
  verifyAppleIdToken,
} from './apple-jwt';
import { toBase64Url } from './pkce';

const TEAM = 'TEAMID1234';
const CLIENT = 'com.lumi.app';
const KEY_ID = 'KEYIDABCD';

function derToBase64(der: ArrayBuffer): string {
  const bytes = new Uint8Array(der);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function toPem(der: ArrayBuffer): string {
  const b64 = derToBase64(der);
  const body = b64.match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

let privateKey: CryptoKey;
let publicJwk: JsonWebKey;

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  privateKey = pair.privateKey;
  publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
});

describe('generateAppleClientSecret', () => {
  it('签发 3 段 JWT，且签名可被对应公钥验过', async () => {
    const pem = toPem(await crypto.subtle.exportKey('pkcs8', privateKey));
    const jwt = await generateAppleClientSecret(TEAM, CLIENT, KEY_ID, pem);
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);

    const header = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
      ),
    );
    expect(header.alg).toBe('ES256');
    expect(header.kid).toBe(KEY_ID);

    const pubKey = await crypto.subtle.importKey(
      'jwk',
      publicJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    expect(valid).toBe(true);
  });
});

describe('verifyAppleIdToken', () => {
  let originalFetch: typeof fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });
  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('用本地生成的 JWKS 验签并返回 payload', async () => {
    // 伪造 Apple JWKS：只含本测试公钥
    const jwks = {
      keys: [
        {
          kty: 'EC',
          crv: 'P-256',
          kid: KEY_ID,
          x: publicJwk.x,
          y: publicJwk.y,
        },
      ],
    };
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => jwks,
    })) as unknown as typeof fetch;

    // 用本私钥签发一个 id_token
    const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: 'https://appleid.apple.com',
      aud: CLIENT,
      exp: now + 3600,
      iat: now,
      sub: 'apple-sub-1',
      email: 'user@privaterelay.appleid.com',
    };
    const enc = new TextEncoder();
    const hB64 = toBase64Url(enc.encode(JSON.stringify(header)));
    const pB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      enc.encode(`${hB64}.${pB64}`),
    );
    const sigB64 = toBase64Url(sig);
    const idToken = `${hB64}.${pB64}.${sigB64}`;

    const result = await verifyAppleIdToken(idToken, CLIENT);
    expect(result.sub).toBe('apple-sub-1');
    expect(result.email).toBe('user@privaterelay.appleid.com');
  });

  it('aud 不匹配时抛错', async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ keys: [{ kty: 'EC', crv: 'P-256', kid: KEY_ID, x: publicJwk.x, y: publicJwk.y }] }),
    })) as unknown as typeof fetch;

    const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: 'https://appleid.apple.com', aud: 'wrong', exp: now + 3600, iat: now, sub: 's' };
    const enc = new TextEncoder();
    const hB64 = toBase64Url(enc.encode(JSON.stringify(header)));
    const pB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(`${hB64}.${pB64}`));
    const idToken = `${hB64}.${pB64}.${toBase64Url(sig)}`;

    await expect(verifyAppleIdToken(idToken, CLIENT)).rejects.toThrow(/aud/);
  });
});
