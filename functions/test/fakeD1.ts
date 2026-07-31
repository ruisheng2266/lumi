/**
 * functions/test/fakeD1.ts
 * 仅供单元测试的内存版 D1（识别本项目用到的有限 SQL，不做通用解析）
 */
import type { D1Database } from '../utils/types';

export interface FakeD1 extends D1Database {
  tables: Record<string, Record<string, unknown>[]>;
}

export function createFakeD1(): FakeD1 {
  const tables: Record<string, Record<string, unknown>[]> = {
    users: [],
    sessions: [],
    subscriptions: [],
    sync_meta: [],
    key_backup: [],
    recovery_codes: [],
  };

  const execute = (sql: string, vals: unknown[]): Record<string, unknown>[] => {
    // ---- reads ----
    if (/SELECT id FROM users WHERE google_id/.test(sql))
      return tables.users.filter((u) => u.google_id === vals[0]);
    if (/SELECT id FROM users WHERE apple_id/.test(sql))
      return tables.users.filter((u) => u.apple_id === vals[0]);
    if (/SELECT \* FROM users WHERE id = \?/.test(sql))
      return tables.users.filter((u) => u.id === vals[0]);
    if (/SELECT \* FROM users WHERE google_id = \?/.test(sql))
      return tables.users.filter((u) => u.google_id === vals[0]);
    if (/SELECT \* FROM users WHERE apple_id = \?/.test(sql))
      return tables.users.filter((u) => u.apple_id === vals[0]);
    if (/SELECT user_id FROM sessions WHERE id = \? AND expires_at > \?/.test(sql)) {
      const [sid, now] = vals as [string, number];
      return tables.sessions.filter((s) => s.id === sid && (s.expires_at as number) > now);
    }

    // ---- writes ----
    if (/UPDATE users SET/.test(sql)) {
      const [email, name, picture, ts, id] = vals as [string, string | null, string | null, number, string];
      const u = tables.users.find((u) => u.id === id);
      if (u) {
        u.email = email;
        u.name = name;
        u.picture = picture;
        u.last_login_at = ts;
      }
      return [];
    }
    if (/INSERT INTO users/.test(sql)) {
      const [id, gid, aid, email, name, picture, created, last] = vals as [
        string, string | null, string | null, string, string | null, string | null, number, number,
      ];
      tables.users.push({
        id, google_id: gid, apple_id: aid, email, name, picture,
        created_at: created, last_login_at: last,
      });
      return [];
    }
    if (/INSERT INTO sessions/.test(sql)) {
      const [id, uid, exp, created] = vals as [string, string, number, number];
      tables.sessions.push({ id, user_id: uid, expires_at: exp, created_at: created });
      return [];
    }
    if (/DELETE FROM sessions WHERE id = \?/.test(sql)) {
      tables.sessions = tables.sessions.filter((s) => s.id !== vals[0]);
      return [];
    }
    const delByUser = (table: string) => {
      tables[table] = tables[table].filter((r) => r.user_id !== vals[0]);
    };
    if (/DELETE FROM sessions WHERE user_id = \?/.test(sql)) return delByUser('sessions'), [];
    if (/DELETE FROM recovery_codes WHERE user_id = \?/.test(sql)) return delByUser('recovery_codes'), [];
    if (/DELETE FROM key_backup WHERE user_id = \?/.test(sql)) return delByUser('key_backup'), [];
    if (/DELETE FROM sync_meta WHERE user_id = \?/.test(sql)) return delByUser('sync_meta'), [];
    if (/DELETE FROM subscriptions WHERE user_id = \?/.test(sql)) return delByUser('subscriptions'), [];
    if (/DELETE FROM users WHERE id = \?/.test(sql)) {
      tables.users = tables.users.filter((u) => u.id !== vals[0]);
      return [];
    }
    return [];
  };

  const prepare = (sql: string) => ({
    bind: (...vals: unknown[]) => ({
      run: async () => {
        execute(sql, vals);
        return { meta: { changes: 1, last_row_id: 1 } };
      },
      first: async (col?: string) => {
        const rows = execute(sql, vals);
        const row = rows[0] ?? null;
        if (row && col) return (row as Record<string, unknown>)[col] ?? null;
        return row as unknown;
      },
      all: async () => execute(sql, vals),
    }),
  });

  return { tables, prepare: prepare as D1Database['prepare'] } as FakeD1;
}
