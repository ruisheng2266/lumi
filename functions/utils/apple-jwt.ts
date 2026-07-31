/**
 * functions/utils/apple-jwt.ts
 * Sign in with Apple 相关 JWT 工具
 *  - generateAppleClientSecret：用 p8 私钥签发 client_secret（ES256，有效期 ≤6 个月）
 *  - verifyAppleIdToken：用 Apple 公开 JWKS 校验 id_token 签名并返回 payload
 * 全部基于 WebCrypto（Workers / Node 均可用），不引入第三方依赖。
 */

import { toBase64Url, fromBase64Url } from './pkce';

function pemToDer(pem: string) {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  return fromBase64Url(cleaned);
}

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

interface AppleIdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * 用 Service ID 私钥（AuthKey_*.p8）签发 client_secret JWT。
 * exp 不得超过 6 个月（Apple 限制）。
 */
export async function generateAppleClientSecret(
  teamId: string,
  clientId: string,
  keyId: string,
  privateKeyPem: string,
): Promise<string> {
  const der = pemToDer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 15777000, // 6 个月（Apple 上限）
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  const enc = new TextEncoder();
  const headerB64 = toBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(signingInput),
  );
  const sigB64 = toBase64Url(signature);

  return `${signingInput}.${sigB64}`;
}

async function fetchAppleJwks(): Promise<unknown[]> {
  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Apple JWKS: ${res.status}`);
  const json = (await res.json()) as { keys: unknown[] };
  return json.keys;
}

/**
 * 校验 Apple id_token：
 *  - 用 JWKS 中匹配 kid 的 EC 公钥验签（ES256）
 *  - 检查 iss / aud / exp
 * 返回解析后的 payload（含 sub 与 email）。
 */
export async function verifyAppleIdToken(
  idToken: string,
  expectedClientId: string,
): Promise<AppleIdTokenPayload> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed id_token');
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(
    new TextDecoder().decode(fromBase64Url(headerB64)),
  ) as { kid?: string; alg?: string };
  if (header.alg !== 'ES256') throw new Error(`Unexpected alg: ${header.alg}`);

  const keys = await fetchAppleJwks();
  const jwk = keys.find(
    (k) => (k as { kid?: string }).kid === header.kid,
  ) as { kty: string; crv: string; x: string; y: string } | undefined;
  if (!jwk) throw new Error('No matching JWK for id_token kid');

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = fromBase64Url(sigB64);
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    sig,
    data,
  );
  if (!valid) throw new Error('id_token signature verification failed');

  const payload = JSON.parse(
    new TextDecoder().decode(fromBase64Url(payloadB64)),
  ) as AppleIdTokenPayload;

  if (payload.iss !== 'https://appleid.apple.com') {
    throw new Error('id_token iss mismatch');
  }
  if (payload.aud !== expectedClientId) {
    throw new Error('id_token aud mismatch');
  }
  if (payload.exp * 1000 < Date.now()) {
    throw new Error('id_token expired');
  }
  return payload;
}
