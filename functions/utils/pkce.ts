/**
 * functions/utils/pkce.ts
 * OAuth 2.0 PKCE（RFC 7636）工具 —— 公开客户端最佳实践（缺口④）
 */

/** ArrayBuffer/Uint8Array → base64url（无填充） */
export function toBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → 字节数组 */
export function fromBase64Url(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 生成 code_verifier：43 字符（32 随机字节的 base64url），符合 [A-Za-z0-9-._~] */
export async function generateCodeVerifier(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** S256：code_verifier 的 SHA-256 → base64url */
export async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toBase64Url(digest);
}
