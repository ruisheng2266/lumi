/**
 * src/shared/share/shareStore.ts
 * Phase 4 伴侣加密共享的前端编排（Zustand）。
 *
 * 数据语义（v1，刻意保守）：
 *  - 共享是**创建者单向加密镜像**：创建者把自己选定范围的数据加密推送到共享 vault；
 *    伴侣拉取后只在「伴侣视图」里只读展示，**绝不写入伴侣本地主库**，避免两个人的
 *    健康数据互相污染。
 *  - 共享范围（periods / symptoms / all）是**客户端推送前的过滤**——零知识架构下这是
 *    唯一可信的执行点，服务端本就看不到内容。范围偏好只存本地 localStorage。
 *
 * 密钥语义：
 *  - 共享 vault 密钥 = 一把独立的 AES-GCM 256 密钥，用双方 RSA 公钥各包裹一份存 D1。
 *  - 解开需要本人私钥 → 依赖加密同步已解锁（私钥由 vault 密钥包裹）。
 *  - 撤销 = 轮换共享密钥 + 用新密钥重加密全部 blob + 删成员行（不依赖服务端"守信"）。
 */

import { create } from 'zustand';
import {
  generateVaultKey,
  importPublicKeySpki,
  wrapVaultKeyForUser,
  unwrapVaultKeyWithPrivate,
  encryptRecord,
  decryptRecord,
} from '../sync/crypto';
import { getUserPrivateKey } from '../sync/store';
import { collectLocalRecords } from '../sync/data';

export type ShareRole = 'owner' | 'partner';
export type ShareStatus = 'pending' | 'active' | 'revoked';
/** 共享范围：仅经期 / 经期+每日记录 / 全部（含档案与生活事件） */
export type ShareScope = 'periods' | 'symptoms' | 'all';

export interface ShareVaultView {
  vaultId: string;
  ownerUserId: string;
  keyEpoch: number;
  role: ShareRole;
  status: ShareStatus;
  wrappedVaultKey: string;
  partner: { userId: string; status: ShareStatus } | null;
}

export interface SharedRecord {
  recordId: string;
  updatedAt: number;
  data: unknown;
}

export interface SharedSnapshot {
  fetchedAt: number;
  records: SharedRecord[];
}

interface ShareState {
  available: boolean;
  loading: boolean;
  error: string | null;
  /** 成功提示（如「已发送邀请」），供 UI 短暂展示 */
  notice: string | null;
  vaults: ShareVaultView[];
  /** 每个共享 vault 的解密快照（只读展示用，不落本地主库） */
  snapshots: Record<string, SharedSnapshot>;
  lastPushAt: Record<string, number>;
  /** 每个共享 vault 的共享范围（镜像自 localStorage，便于 UI 响应式更新） */
  scopes: Record<string, ShareScope>;
  refresh: () => Promise<void>;
  invite: (partnerEmail: string, scope: ShareScope) => Promise<void>;
  accept: (vaultId: string) => Promise<void>;
  pushShared: (vaultId: string) => Promise<void>;
  pullShared: (vaultId: string) => Promise<void>;
  revoke: (vaultId: string) => Promise<void>;
  setScope: (vaultId: string, scope: ShareScope) => void;
  getScope: (vaultId: string) => ShareScope;
  clearNotice: () => void;
}

// 已解开的共享 vault 密钥：仅存内存，锁定同步 / 刷新页面即消失
const sharedKeys = new Map<string, CryptoKey>();

const SCOPE_PREFIX = 'lumi.share.scope.';

function readScope(vaultId: string): ShareScope {
  try {
    const v = localStorage.getItem(SCOPE_PREFIX + vaultId);
    if (v === 'periods' || v === 'symptoms' || v === 'all') return v;
  } catch {
    /* localStorage 不可用时用默认值 */
  }
  return 'symptoms';
}

function writeScope(vaultId: string, scope: ShareScope): void {
  try {
    localStorage.setItem(SCOPE_PREFIX + vaultId, scope);
  } catch {
    /* 忽略：范围仅影响下次推送 */
  }
}

/** 共享范围过滤：决定哪些本地记录会被加密推送给伴侣 */
export function inScope(recordId: string, scope: ShareScope): boolean {
  const type = recordId.split(':')[0];
  if (scope === 'periods') return type === 'period';
  if (scope === 'symptoms') return type === 'period' || type === 'dailyLog';
  // all：经期 + 每日记录 + 档案 + 生活事件（不含本机设置 / 洞察偏好）
  return type === 'period' || type === 'dailyLog' || type === 'profile' || type === 'lifeEvent';
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
}

async function errorOf(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.error ? String(body.error) : `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

/** 取得某共享 vault 的密钥（缓存未命中则用本人私钥解开） */
async function ensureSharedKey(v: ShareVaultView): Promise<CryptoKey> {
  const cached = sharedKeys.get(v.vaultId);
  if (cached) return cached;
  const priv = getUserPrivateKey();
  if (!priv) throw new Error('sync_locked');
  const key = await unwrapVaultKeyWithPrivate(v.wrappedVaultKey, priv);
  sharedKeys.set(v.vaultId, key);
  return key;
}

export const useShare = create<ShareState>((set, get) => ({
  available: false,
  loading: false,
  error: null,
  notice: null,
  vaults: [],
  snapshots: {},
  lastPushAt: {},
  scopes: {},

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api('/api/share/list');
      if (!res.ok) throw new Error(await errorOf(res, 'list_failed'));
      const data = await res.json();
      const vaults: ShareVaultView[] = data.vaults ?? [];
      // 服务端可能已轮换密钥（key_epoch 提升）→ 丢弃缓存，下次按新包裹重新解开
      for (const v of vaults) sharedKeys.delete(v.vaultId);
      const scopes: Record<string, ShareScope> = {};
      for (const v of vaults) scopes[v.vaultId] = readScope(v.vaultId);
      set({ vaults, scopes, loading: false, available: true });
    } catch (e) {
      set({ loading: false, error: (e as Error).message || 'list_failed' });
    }
  },

  invite: async (partnerEmail: string, scope: ShareScope) => {
    set({ loading: true, error: null, notice: null });
    try {
      const priv = getUserPrivateKey();
      if (!priv) throw new Error('sync_locked');

      // 1) 取双方公钥
      const pubRes = await api(
        `/api/users/public-key?email=${encodeURIComponent(partnerEmail.trim())}`,
      );
      if (!pubRes.ok) throw new Error(await errorOf(pubRes, 'partner_lookup_failed'));
      const partnerInfo = await pubRes.json();
      const meRes = await api('/api/sync-setup');
      const me = await meRes.json();
      if (!me?.publicKey) throw new Error('owner_not_ready');

      // 2) 本地生成共享 vault 密钥，用双方公钥各包裹一份
      const sharedKey = await generateVaultKey();
      const ownerWrapped = await wrapVaultKeyForUser(
        sharedKey,
        await importPublicKeySpki(me.publicKey),
      );
      const partnerWrapped = await wrapVaultKeyForUser(
        sharedKey,
        await importPublicKeySpki(partnerInfo.publicKey),
      );

      // 3) 建立共享关系
      const res = await api('/api/share/invite', {
        method: 'POST',
        body: JSON.stringify({ partnerEmail: partnerEmail.trim(), ownerWrapped, partnerWrapped }),
      });
      if (!res.ok) throw new Error(await errorOf(res, 'invite_failed'));
      const { vaultId } = await res.json();

      sharedKeys.set(vaultId, sharedKey);
      writeScope(vaultId, scope);
      set((s) => ({
        loading: false,
        notice: 'invited',
        scopes: { ...s.scopes, [vaultId]: scope },
      }));

      await get().refresh();
      // 4) 立即推一份数据，伴侣接受后即可看到
      await get().pushShared(vaultId);
    } catch (e) {
      set({ loading: false, error: (e as Error).message || 'invite_failed' });
    }
  },

  accept: async (vaultId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await api('/api/share/accept', {
        method: 'POST',
        body: JSON.stringify({ vaultId }),
      });
      if (!res.ok) throw new Error(await errorOf(res, 'accept_failed'));
      set({ loading: false, notice: 'accepted' });
      await get().refresh();
      await get().pullShared(vaultId);
    } catch (e) {
      set({ loading: false, error: (e as Error).message || 'accept_failed' });
    }
  },

  pushShared: async (vaultId: string) => {
    const v = get().vaults.find((x) => x.vaultId === vaultId);
    if (!v || v.status !== 'active') return;
    set({ loading: true, error: null });
    try {
      const key = await ensureSharedKey(v);
      const scope = get().scopes[vaultId] ?? readScope(vaultId);
      const local = await collectLocalRecords();
      const records = [];
      for (const r of local) {
        if (!inScope(r.recordId, scope)) continue;
        const { blob, hmac } = await encryptRecord(key, r.data);
        records.push({ recordId: r.recordId, updatedAt: r.updatedAt, blob, hmac });
      }
      const res = await api(`/api/share/sync?vaultId=${encodeURIComponent(vaultId)}`, {
        method: 'PUT',
        body: JSON.stringify({ records }),
      });
      if (!res.ok) throw new Error(await errorOf(res, 'push_failed'));
      set((s) => ({
        loading: false,
        lastPushAt: { ...s.lastPushAt, [vaultId]: Date.now() },
      }));
    } catch (e) {
      set({ loading: false, error: (e as Error).message || 'push_failed' });
    }
  },

  pullShared: async (vaultId: string) => {
    const v = get().vaults.find((x) => x.vaultId === vaultId);
    if (!v || v.status !== 'active') return;
    set({ loading: true, error: null });
    try {
      const key = await ensureSharedKey(v);
      const res = await api(`/api/share/sync?vaultId=${encodeURIComponent(vaultId)}`);
      if (!res.ok) throw new Error(await errorOf(res, 'pull_failed'));
      const data = await res.json();
      const out: SharedRecord[] = [];
      for (const r of data.records ?? []) {
        if (r.deleted || !r.blob) continue;
        try {
          out.push({
            recordId: r.recordId,
            updatedAt: r.updatedAt,
            data: await decryptRecord(key, r.blob),
          });
        } catch {
          // 单条解密失败（多半是撤销后轮换过密钥）跳过，不阻塞其余记录
        }
      }
      set((s) => ({
        loading: false,
        snapshots: { ...s.snapshots, [vaultId]: { fetchedAt: Date.now(), records: out } },
      }));
    } catch (e) {
      set({ loading: false, error: (e as Error).message || 'pull_failed' });
    }
  },

  /**
   * 撤销伴侣访问（仅创建者）。真正切断访问靠**轮换密钥 + 全量重加密**：
   * 被撤销方本地留存的旧密钥将解不开任何新 blob。
   */
  revoke: async (vaultId: string) => {
    const v = get().vaults.find((x) => x.vaultId === vaultId);
    if (!v || v.role !== 'owner' || !v.partner) return;
    set({ loading: true, error: null });
    try {
      const oldKey = await ensureSharedKey(v);

      // 1) 用旧密钥拉取并解密现有全部记录
      const pull = await api(`/api/share/sync?vaultId=${encodeURIComponent(vaultId)}`);
      if (!pull.ok) throw new Error(await errorOf(pull, 'revoke_pull_failed'));
      const pulled = await pull.json();

      // 2) 生成新共享密钥，重加密后整体重写（updatedAt 抬高以通过 LWW）
      const newKey = await generateVaultKey();
      const now = Date.now();
      const records = [];
      for (const r of pulled.records ?? []) {
        if (r.deleted || !r.blob) continue;
        let plain: unknown;
        try {
          plain = await decryptRecord(oldKey, r.blob);
        } catch {
          continue;
        }
        const { blob, hmac } = await encryptRecord(newKey, plain);
        records.push({ recordId: r.recordId, updatedAt: Math.max(now, r.updatedAt + 1), blob, hmac });
      }
      if (records.length > 0) {
        const put = await api(`/api/share/sync?vaultId=${encodeURIComponent(vaultId)}`, {
          method: 'PUT',
          body: JSON.stringify({ records }),
        });
        if (!put.ok) throw new Error(await errorOf(put, 'revoke_rekey_failed'));
      }

      // 3) 给剩余成员（此处仅创建者本人）重新包裹新密钥，并删除伴侣成员行
      const meRes = await api('/api/sync-setup');
      const me = await meRes.json();
      if (!me?.publicKey) throw new Error('owner_not_ready');
      const newOwnerWrapped = await wrapVaultKeyForUser(
        newKey,
        await importPublicKeySpki(me.publicKey),
      );
      const res = await api('/api/share/revoke', {
        method: 'POST',
        body: JSON.stringify({
          vaultId,
          memberUserId: v.partner.userId,
          newWrappedKeys: { [v.ownerUserId]: newOwnerWrapped },
          newEpoch: v.keyEpoch + 1,
        }),
      });
      if (!res.ok) throw new Error(await errorOf(res, 'revoke_failed'));

      sharedKeys.set(vaultId, newKey);
      set((s) => {
        const snapshots = { ...s.snapshots };
        delete snapshots[vaultId];
        return { loading: false, notice: 'revoked', snapshots };
      });
      await get().refresh();
      sharedKeys.set(vaultId, newKey);
    } catch (e) {
      set({ loading: false, error: (e as Error).message || 'revoke_failed' });
    }
  },

  setScope: (vaultId: string, scope: ShareScope) => {
    writeScope(vaultId, scope);
    set((s) => ({ scopes: { ...s.scopes, [vaultId]: scope } }));
  },

  getScope: (vaultId: string) => get().scopes[vaultId] ?? readScope(vaultId),

  clearNotice: () => set({ notice: null }),
}));

/** 供外部（如登出 / 锁定）清理内存中的共享密钥 */
export function clearSharedKeys(): void {
  sharedKeys.clear();
  useShare.setState({ vaults: [], snapshots: {}, notice: null, error: null });
}
