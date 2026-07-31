// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createFakeD1 } from '../test/fakeD1';
import {
  upsertUser,
  findUserById,
  findUserByGoogleId,
  findUserByAppleId,
  deleteUser,
} from './db';

describe('db: upsertUser', () => {
  it('Google 首次创建、再次更新', async () => {
    const db = createFakeD1();
    const id1 = await upsertUser(db, {
      provider: 'google',
      sub: 'g-1',
      email: 'a@x.com',
      name: 'Ann',
    });
    expect(db.tables.users).toHaveLength(1);
    expect(db.tables.users[0].google_id).toBe('g-1');
    expect(db.tables.users[0].apple_id).toBeNull();

    const id2 = await upsertUser(db, {
      provider: 'google',
      sub: 'g-1',
      email: 'a2@x.com',
      name: 'Ann2',
    });
    expect(id1).toBe(id2);
    expect(db.tables.users).toHaveLength(1);
    expect(db.tables.users[0].email).toBe('a2@x.com');
  });

  it('Apple 创建独立账号', async () => {
    const db = createFakeD1();
    const id = await upsertUser(db, {
      provider: 'apple',
      sub: 'a-1',
      email: 'relay@privaterelay.appleid.com',
    });
    const u = await findUserByAppleId(db, 'a-1');
    expect(u?.id).toBe(id);
    expect(u?.apple_id).toBe('a-1');
    expect(u?.google_id).toBeNull();
    expect(await findUserByGoogleId(db, 'a-1')).toBeNull();
  });
});

describe('db: deleteUser 级联', () => {
  it('删除用户同时清会话/订阅/同步索引/备份/恢复码', async () => {
    const db = createFakeD1();
    const id = await upsertUser(db, { provider: 'google', sub: 'g-9', email: 'z@x.com' });
    db.tables.sessions.push({ id: 's1', user_id: id, expires_at: Date.now() + 1000, created_at: 0 });
    db.tables.subscriptions.push({ user_id: id, plan: 'free', created_at: 0 });
    db.tables.sync_meta.push({ user_id: id, record_id: 'r1', updated_at: 0, blob_ref: 'b', hmac: 'h' });
    db.tables.key_backup.push({ user_id: id, wrapped_private_key: 'k', salt: 's', created_at: 0 });
    db.tables.recovery_codes.push({ user_id: id, code_hash: 'c', created_at: 0 });

    await deleteUser(db, id);

    expect(db.tables.users).toHaveLength(0);
    expect(db.tables.sessions).toHaveLength(0);
    expect(db.tables.subscriptions).toHaveLength(0);
    expect(db.tables.sync_meta).toHaveLength(0);
    expect(db.tables.key_backup).toHaveLength(0);
    expect(db.tables.recovery_codes).toHaveLength(0);
    expect(await findUserById(db, id)).toBeNull();
  });
});
