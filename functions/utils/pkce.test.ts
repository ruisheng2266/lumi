// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, pkceChallenge, toBase64Url, fromBase64Url } from './pkce';

describe('pkce', () => {
  it('生成 43 字符且符合字符集的 code_verifier', async () => {
    const v = await generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('同一 verifier 的 challenge 确定性一致', async () => {
    const v = await generateCodeVerifier();
    expect(await pkceChallenge(v)).toBe(await pkceChallenge(v));
  });

  it('S256 与 RFC 7636 附录 B 已知向量一致', async () => {
    const known = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(await pkceChallenge(known)).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('base64url 编解码可逆', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 255]);
    const enc = toBase64Url(bytes);
    expect(enc).not.toContain('=');
    expect(fromBase64Url(enc)).toEqual(bytes);
  });
});
