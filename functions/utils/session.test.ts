// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createFakeD1 } from '../test/fakeD1';
import {
  createSession,
  validateSession,
  getSessionIdFromCookie,
  buildSessionCookie,
} from './session';

describe('session', () => {
  it('创建会话后可校验，过期后失效', async () => {
    const db = createFakeD1();
    const sid = await createSession(db, 'user-1');

    // 立即校验应通过
    expect(await validateSession(db, sid)).toBe('user-1');

    // 篡改：不存在的会话
    expect(await validateSession(db, 'nope')).toBeNull();

    // 过期：直接改 expires_at
    const row = db.tables.sessions.find((s) => s.id === sid)!;
    row.expires_at = Date.now() - 1000;
    expect(await validateSession(db, sid)).toBeNull();
  });

  it('从 cookie 解析 session id', () => {
    const req = new Request('https://x.com/', {
      headers: { cookie: 'foo=bar; session=abc123; oauth_state=xyz' },
    });
    expect(getSessionIdFromCookie(req)).toBe('abc123');
  });

  it('buildSessionCookie 含 HttpOnly / SameSite / Max-Age', () => {
    const c = buildSessionCookie('sid', true);
    expect(c).toContain('session=sid');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Secure');
    expect(c).toContain('Max-Age=');
  });
});
