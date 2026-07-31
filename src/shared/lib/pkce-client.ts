/**
 * src/shared/lib/pkce-client.ts
 * 浏览器端 PKCE 工具（WebCrypto API）
 *
 * 与 functions/utils/pkce.ts 算法完全一致（S256 challenge），
 * 供 SPA OAuth 流程在前端生成 code_verifier / code_challenge。
 */

/**
 * 生成随机 code_verifier（43-128 字符的 base64url 字符串）
 */
export async function generateCodeVerifier(): Promise<string> {
  const random = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(random);
}

/**
 * S256 code_challenge = BASE64URL(SHA256(verifier))
 */
export async function pkceChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
