/**
 * src/shared/sync/store.ts
 * Phase 2 E2EE 同步编排（Zustand）。
 *
 * 安全模型：vault 密钥仅存于内存（模块级变量），刷新页面后需重新用 passphrase 解锁；
 * 绝不写入 IndexedDB / localStorage。服务端只持有被包裹的密文。
 *
 * 状态机：
 *   disabled →（启用，设 passphrase）→ ready
 *   locked   →（解锁，输入 passphrase）→ ready
 *   ready    ↔ 可同步 / 可重新生成恢复码
 */

import { create } from 'zustand';
import { db } from '../db/client';
import {
  bytesToB64,
  randomSalt,
  derivePassphraseKey,
  deriveRecoveryKey,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  encryptRecord,
  generateRecoveryCodes,
  hashRecoveryCode,
} from './crypto';
import {
  collectLocalRecords,
  applyRemoteRecords,
  applyRemoteDeletion,
  decryptRemoteRecords,
} from './data';

export type SyncStatus = 'unknown' | 'disabled' | 'locked' | 'ready';

interface SyncState {
  status: SyncStatus;
  loading: boolean;
  error: string | null;
  lastSyncAt: number | null;
  /** 启用 / 重新生成后一次性展示的恢复码（仅存在于内存，关闭即不可见） */
  recoveryCodes: string[] | null;
  init: () => Promise<void>;
  enable: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  syncNow: () => Promise<void>;
  regenerateRecoveryCodes: () => Promise<void>;
  resetPassphrase: (recoveryCode: string, newPassphrase: string) => Promise<void>;
  clearRecoveryCodeDisplay: () => void;
  clearSession: () => void;
}

// 仅存于内存的敏感状态（不进 Zustand / 不持久化）
let vaultKey: CryptoKey | null = null;
let vaultSalt: Uint8Array | null = null;
const applyingRemote = { value: false };
let hooksInstalled = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function pushAll(): Promise<void> {
  if (!vaultKey) return;
  const local = await collectLocalRecords();
  const records = [];
  for (const r of local) {
    const { blob, hmac } = await encryptRecord(vaultKey, r.data);
    records.push({ recordId: r.recordId, updatedAt: r.updatedAt, blob, hmac });
  }
  const res = await fetch('/api/sync', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  });
  if (!res.ok) {
    let detail = `push_failed (${res.status})`;
    try {
      const errBody = await res.json();
      const text = JSON.stringify(errBody);
      console.error('[sync] pushAll server error:', res.status, text);
      if (errBody.error) detail = `push_failed: ${errBody.error}`;
      if (errBody.detail) detail += ` + detail: ${errBody.detail}`;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
}

async function pullAll(): Promise<void> {
  if (!vaultKey) return;
  const res = await fetch('/api/sync', { credentials: 'include' });
  if (!res.ok) {
    let detail = `pull_failed (${res.status})`;
    try {
      const errBody = await res.json();
      const text = JSON.stringify(errBody);
      console.error('[sync] pullAll server error:', res.status, text);
      if (errBody.error) detail = `pull_failed: ${errBody.error}`;
      if (errBody.detail) detail += ` + detail: ${errBody.detail}`;
    } catch {
      // 非 JSON 响应（可能是 Cloudflare HTML 错误页）
      try {
        const html = await res.text();
        console.error('[sync] pullAll non-JSON response:', res.status, html.slice(0, 300));
        detail += ` (non-JSON: ${html.slice(0, 100)})`;
      } catch { /* ignore */ }
    }
    throw new Error(detail);
  }
  const data = await res.json();
  const records = data.records ?? [];
  const decrypted = await decryptRemoteRecords(vaultKey, records);
  await applyRemoteRecords(decrypted, applyingRemote);
  for (const r of records) {
    if (r.deleted) await applyRemoteDeletion(r.recordId, applyingRemote);
  }
}

function schedulePush(): void {
  if (applyingRemote.value) return;
  if (!vaultKey) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushAll().catch(() => {/* 后台静默失败，下次同步重试 */});
  }, 1500);
}

function installHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  const tables = [db.periods, db.dailyLogs, db.userProfile, db.settings, db.insightPrefs, db.lifeEvents];
  for (const t of tables) {
    t.hook('creating', () => schedulePush());
    t.hook('updating', () => schedulePush());
    t.hook('deleting', () => schedulePush());
  }
}

export const useSync = create<SyncState>((set) => ({
  status: 'unknown',
  loading: false,
  error: null,
  lastSyncAt: null,
  recoveryCodes: null,

  init: async () => {
    installHooks();
    try {
      const res = await fetch('/api/sync-setup', { credentials: 'include' });
      const data = await res.json();
      if (data.initialized) set({ status: 'locked' });
      else set({ status: 'disabled' });
    } catch {
      set({ status: 'disabled' });
    }
  },

  enable: async (passphrase: string) => {
    set({ loading: true, error: null });
    try {
      vaultKey = await generateVaultKey();
      vaultSalt = randomSalt();
      const passKey = await derivePassphraseKey(passphrase, vaultSalt);
      const wrapped = await wrapVaultKey(vaultKey, passKey);

      const codes = generateRecoveryCodes();
      const recoveryCodes = [];
      for (const code of codes) {
        const rKey = await deriveRecoveryKey(code, vaultSalt);
        const wrappedR = await wrapVaultKey(vaultKey, rKey);
        const codeHash = await hashRecoveryCode(code);
        recoveryCodes.push({ codeHash, wrappedVaultKey: wrappedR });
      }

      const res = await fetch('/api/sync-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wrappedVaultKey: wrapped,
          salt: bytesToB64(vaultSalt),
          recoveryCodes,
        }),
      });
      if (!res.ok) {
        let detail = `setup_failed (${res.status})`;
        try {
          const errBody = await res.json();
          if (errBody.error) detail = `setup_failed: ${errBody.error}`;
        } catch { /* ignore parse failure */ }
        throw new Error(detail);
      }

      // push 成功后才设为 ready（push 失败保持 error 状态）
      await pushAll();
      installHooks();
      set({ status: 'ready', loading: false, recoveryCodes: codes, lastSyncAt: Date.now() });
    } catch (e) {
      vaultKey = null;
      vaultSalt = null;
      set({ loading: false, error: (e as Error).message || 'enable_failed' });
    }
  },

  unlock: async (passphrase: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/sync-setup', { credentials: 'include' });
      const data = await res.json();
      if (!data.initialized) throw new Error('not_initialized');
      vaultSalt = Uint8Array.from(atob(data.salt), (c) => c.charCodeAt(0));
      const passKey = await derivePassphraseKey(passphrase, vaultSalt);
      vaultKey = await unwrapVaultKey(data.wrappedVaultKey, passKey);

      set({ status: 'ready', loading: false, lastSyncAt: Date.now() });
      // 同步步骤单独处理错误，不与口令验证混淆
      try {
        await pullAll();
        await pushAll();
        set({ lastSyncAt: Date.now() });
      } catch (syncErr) {
        // 同步失败不影响解锁状态，仅显示警告
        set({ error: (syncErr as Error).message || 'sync_after_unlock_failed' });
      }
    } catch (e) {
      vaultKey = null;
      vaultSalt = null;
      const msg = (e as Error).message || 'unknown';
      // 区分真正的口令错误和其他异常（格式/网络/服务端）
      if (msg === '包裹格式错误') set({ loading: false, error: 'invalid_vault_format' });
      else set({ loading: false, error: `wrong_passphrase: ${msg}` });
    }
  },

  syncNow: async () => {
    set({ loading: true, error: null });
    try {
      await pullAll();
      await pushAll();
      set({ loading: false, lastSyncAt: Date.now() });
    } catch (e) {
      set({ loading: false, error: (e as Error).message || 'sync_failed' });
    }
  },

  regenerateRecoveryCodes: async () => {
    if (!vaultKey || !vaultSalt) {
      set({ error: 'not_unlocked' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const codes = generateRecoveryCodes();
      const recoveryCodes = [];
      for (const code of codes) {
        const rKey = await deriveRecoveryKey(code, vaultSalt);
        const wrappedR = await wrapVaultKey(vaultKey, rKey);
        const codeHash = await hashRecoveryCode(code);
        recoveryCodes.push({ codeHash, wrappedVaultKey: wrappedR });
      }
      const res = await fetch('/api/recovery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryCodes }),
      });
      if (!res.ok) throw new Error('regenerate_failed');
      set({ loading: false, recoveryCodes: codes });
    } catch (e) {
      set({ loading: false, error: (e as Error).message || 'regenerate_failed' });
    }
  },

  resetPassphrase: async (recoveryCode: string, newPassphrase: string) => {
    set({ loading: true, error: null });
    try {
      // 1) 用恢复码换回包裹的 vault 密钥 + salt
      const redeem = await fetch('/api/recovery-redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryCode }),
      });
      if (!redeem.ok) throw new Error('invalid_recovery_code');
      const rd = await redeem.json();
      const salt = Uint8Array.from(atob(rd.salt), (c) => c.charCodeAt(0));

      // 2) 解开 vault 密钥
      const rKey = await deriveRecoveryKey(recoveryCode, salt);
      vaultKey = await unwrapVaultKey(rd.wrappedVaultKey, rKey);
      vaultSalt = salt;

      // 3) 用新 passphrase 重新包裹 + 生成新恢复码组
      const newPassKey = await derivePassphraseKey(newPassphrase, salt);
      const newWrapped = await wrapVaultKey(vaultKey, newPassKey);
      const codes = generateRecoveryCodes();
      const newRecoveryCodes = [];
      for (const code of codes) {
        const crk = await deriveRecoveryKey(code, salt);
        const wrappedR = await wrapVaultKey(vaultKey, crk);
        const codeHash = await hashRecoveryCode(code);
        newRecoveryCodes.push({ codeHash, wrappedVaultKey: wrappedR });
      }

      const res = await fetch('/api/recovery', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recoveryCode,
          newWrappedVaultKey: newWrapped,
          newSalt: bytesToB64(salt),
          newRecoveryCodes,
        }),
      });
      if (!res.ok) throw new Error('reset_failed');

      set({ status: 'ready', loading: false, recoveryCodes: codes, lastSyncAt: Date.now() });
      await pushAll();
    } catch (e) {
      vaultKey = null;
      vaultSalt = null;
      set({ loading: false, error: (e as Error).message || 'reset_failed' });
    }
  },

  clearRecoveryCodeDisplay: () => set({ recoveryCodes: null }),

  clearSession: () => {
    vaultKey = null;
    vaultSalt = null;
    set({ status: 'locked', recoveryCodes: null, error: null });
  },
}));

// 便于其他模块在调用 repo 后主动触发同步（如删除操作）
export function notifyLocalChange(): void {
  schedulePush();
}
