/**
 * src/shared/share/shareStore.test.ts
 * Phase 4 前端编排层单测：重点锁定 v1「共享范围」语义（inScope）与清理行为。
 * 范围过滤是零知识架构下唯一可信的执行点，必须被测试守住。
 */
import { describe, it, expect } from 'vitest';
import { inScope, useShare, clearSharedKeys, type ShareScope } from './shareStore';

describe('shareStore.inScope — v1 共享范围语义', () => {
  it('periods → 仅经期记录', () => {
    expect(inScope('period:2024-01-01', 'periods')).toBe(true);
    expect(inScope('dailyLog:2024-01-02', 'periods')).toBe(false);
    expect(inScope('profile:me', 'periods')).toBe(false);
    expect(inScope('lifeEvent:1', 'periods')).toBe(false);
  });

  it('symptoms → 经期 + 每日记录', () => {
    expect(inScope('period:2024-01-01', 'symptoms')).toBe(true);
    expect(inScope('dailyLog:2024-01-02', 'symptoms')).toBe(true);
    expect(inScope('profile:me', 'symptoms')).toBe(false);
    expect(inScope('lifeEvent:1', 'symptoms')).toBe(false);
  });

  it('all → 经期 + 每日记录 + 档案 + 生活事件', () => {
    const scope: ShareScope = 'all';
    expect(inScope('period:2024-01-01', scope)).toBe(true);
    expect(inScope('dailyLog:2024-01-02', scope)).toBe(true);
    expect(inScope('profile:me', scope)).toBe(true);
    expect(inScope('lifeEvent:1', scope)).toBe(true);
  });

  it('未知类型前缀不会被纳入任何范围', () => {
    expect(inScope('settings:theme', 'all')).toBe(false);
    expect(inScope('insight:cache', 'symptoms')).toBe(false);
  });
});

describe('shareStore.clearSharedKeys', () => {
  it('清空内存密钥相关的 UI 状态（vaults/snapshots/notice/error）', () => {
    useShare.setState({
      vaults: [{ vaultId: 'v1', ownerUserId: 'u', keyEpoch: 1, role: 'owner', status: 'active', wrappedVaultKey: 'x', partner: null }],
      snapshots: { v1: { fetchedAt: 1, records: [] } },
      notice: 'invited',
      error: 'boom',
    });
    clearSharedKeys();
    const s = useShare.getState();
    expect(s.vaults).toEqual([]);
    expect(s.snapshots).toEqual({});
    expect(s.notice).toBeNull();
    expect(s.error).toBeNull();
  });
});
