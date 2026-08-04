/**
 * src/shared/share/SharePanel.tsx
 * Phase 4 设置页「伴侣共享」面板：邀请 / 接受 / 范围设置 / 同步 / 撤销。
 *
 * 门控与红线：
 *  - 发起共享需创建者具备同步权益（Plus / 创始 / 祖父老用户）；伴侣接受与查看完全免费。
 *  - 依赖加密同步已解锁（私钥在内存里），未解锁时只提示、不隐藏功能。
 *  - 撤销走「轮换密钥 + 全量重加密」，不是删一行了事。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, UserPlus, RefreshCw, ShieldOff, Lock, Check, Eye } from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useAuth } from '../auth/store';
import { useSync } from '../sync/store';
import { useEntitlement } from '../plus/store';
import { useShare, type ShareScope, type ShareVaultView } from './shareStore';
import { predictCycle, type PeriodRecord } from '../lib/predict';

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

/** 从共享快照里抽出伴侣视图需要的摘要（只读，不写本地库） */
function summarize(records: { recordId: string; data: unknown }[]) {
  const periods: PeriodRecord[] = [];
  let logCount = 0;
  let lastLogDate: string | null = null;
  for (const r of records) {
    const type = r.recordId.split(':')[0];
    if (type === 'period') {
      const p = r.data as PeriodRecord;
      if (p?.startDate) periods.push(p);
    } else if (type === 'dailyLog') {
      logCount++;
      const d = (r.data as { date?: string })?.date;
      if (d && (!lastLogDate || d > lastLogDate)) lastLogDate = d;
    }
  }
  periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
  const prediction = periods.length > 0 ? predictCycle(periods) : null;
  return {
    periodCount: periods.length,
    lastPeriodStart: periods.length > 0 ? periods[periods.length - 1].startDate : null,
    logCount,
    lastLogDate,
    prediction,
  };
}

export function SharePanel() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const syncStatus = useSync((s) => s.status);
  const { syncEntitled } = useEntitlement();

  const vaults = useShare((s) => s.vaults);
  const snapshots = useShare((s) => s.snapshots);
  const scopes = useShare((s) => s.scopes);
  const loading = useShare((s) => s.loading);
  const error = useShare((s) => s.error);
  const notice = useShare((s) => s.notice);
  const refresh = useShare((s) => s.refresh);
  const invite = useShare((s) => s.invite);
  const accept = useShare((s) => s.accept);
  const pushShared = useShare((s) => s.pushShared);
  const pullShared = useShare((s) => s.pullShared);
  const revoke = useShare((s) => s.revoke);
  const setScope = useShare((s) => s.setScope);

  const [email, setEmail] = useState('');
  const [newScope, setNewScope] = useState<ShareScope>('symptoms');
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const ready = syncStatus === 'ready';

  useEffect(() => {
    if (user && ready) refresh();
  }, [user, ready, refresh]);

  if (!user) return null;

  const owned = vaults.filter((v) => v.role === 'owner');
  const joined = vaults.filter((v) => v.role === 'partner');

  if (!ready) {
    return (
      <section>
        <CardTitle>{t('share.title')}</CardTitle>
        <Card className="space-y-3">
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-lavender-500 mt-0.5 shrink-0" />
            <p className="text-sm text-fog leading-relaxed">{t('share.needSync')}</p>
          </div>
        </Card>
      </section>
    );
  }

  async function handleInvite() {
    if (!email.includes('@')) return;
    await invite(email, newScope);
    setEmail('');
  }

  function renderOwned(v: ShareVaultView) {
    const partnerStatus = v.partner?.status ?? 'pending';
    return (
      <div key={v.vaultId} className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-lavender-500 shrink-0" />
          <p className="text-sm font-medium flex-1 min-w-0 truncate">
            {t(`share.partnerStatus.${partnerStatus}`)}
          </p>
          <span className="text-xs text-fog tabular-nums">
            {t('share.epoch', { n: v.keyEpoch })}
          </span>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-fog">{t('share.scopeLabel')}</span>
          <Select
            value={scopes[v.vaultId] ?? 'symptoms'}
            onChange={(val) => setScope(v.vaultId, val as ShareScope)}
            options={[
              { value: 'periods', label: t('share.scope.periods') },
              { value: 'symptoms', label: t('share.scope.symptoms') },
              { value: 'all', label: t('share.scope.all') },
            ]}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            leftIcon={<RefreshCw size={16} />}
            onClick={() => pushShared(v.vaultId)}
            disabled={loading || v.status !== 'active'}
          >
            {t('share.pushNow')}
          </Button>
          <Button
            variant="ghost"
            leftIcon={<ShieldOff size={16} />}
            onClick={() => setConfirmRevoke(v.vaultId)}
            disabled={loading}
          >
            {t('share.revoke')}
          </Button>
        </div>

        {confirmRevoke === v.vaultId && (
          <div className="rounded-lg bg-lavender-50 p-3 space-y-2">
            <p className="text-xs text-ink leading-relaxed">{t('share.revokeConfirm')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmRevoke(null)}
                disabled={loading}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  await revoke(v.vaultId);
                  setConfirmRevoke(null);
                }}
                disabled={loading}
              >
                {t('share.revokeConfirmYes')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderJoined(v: ShareVaultView) {
    const snap = snapshots[v.vaultId];
    const s = snap ? summarize(snap.records) : null;
    return (
      <div key={v.vaultId} className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-lavender-500 shrink-0" />
          <p className="text-sm font-medium flex-1">
            {t(`share.myStatus.${v.status}`)}
          </p>
        </div>

        {v.status === 'pending' && (
          <>
            <p className="text-xs text-fog leading-relaxed">{t('share.acceptDesc')}</p>
            <Button
              variant="primary"
              fullWidth
              leftIcon={<Check size={16} />}
              onClick={() => accept(v.vaultId)}
              disabled={loading}
            >
              {t('share.accept')}
            </Button>
          </>
        )}

        {v.status === 'active' && (
          <>
            <Button
              variant="ghost"
              fullWidth
              leftIcon={<Eye size={16} />}
              onClick={() => pullShared(v.vaultId)}
              disabled={loading}
            >
              {loading ? t('common.loading') : t('share.viewPartner')}
            </Button>
            {s && (
              <div className="rounded-lg bg-lavender-50 p-3 space-y-1">
                <p className="text-xs text-fog">
                  {t('share.snapshotAt', { time: formatTime(snap!.fetchedAt) })}
                </p>
                <p className="text-sm text-ink">
                  {t('share.summaryPeriods', {
                    count: s.periodCount,
                    date: s.lastPeriodStart ?? '—',
                  })}
                </p>
                {s.prediction?.nextPeriodStart && (
                  <p className="text-sm text-ink">
                    {t('share.summaryNext', { date: s.prediction.nextPeriodStart })}
                  </p>
                )}
                {s.logCount > 0 && (
                  <p className="text-sm text-ink">
                    {t('share.summaryLogs', { count: s.logCount, date: s.lastLogDate ?? '—' })}
                  </p>
                )}
                <p className="text-xs text-fog leading-relaxed pt-1">{t('share.readOnlyHint')}</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <section>
      <CardTitle>{t('share.title')}</CardTitle>
      <Card className="space-y-4">
        <div className="flex items-start gap-3">
          <Users size={18} className="text-lavender-500 mt-0.5 shrink-0" />
          <p className="text-sm text-fog leading-relaxed">{t('share.desc')}</p>
        </div>

        {error && <p className="text-xs text-coral-500 break-words">{t('share.error')}：{error}</p>}
        {notice && <p className="text-xs text-lavender-600">{t(`share.notice.${notice}`)}</p>}

        {/* 我发起的共享 */}
        {syncEntitled ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('share.inviteTitle')}</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('share.emailPlaceholder')}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
            />
            <Select
              value={newScope}
              onChange={(val) => setNewScope(val as ShareScope)}
              options={[
                { value: 'periods', label: t('share.scope.periods') },
                { value: 'symptoms', label: t('share.scope.symptoms') },
                { value: 'all', label: t('share.scope.all') },
              ]}
            />
            <Button
              variant="primary"
              fullWidth
              leftIcon={<UserPlus size={18} />}
              onClick={handleInvite}
              disabled={loading || !email.includes('@')}
            >
              {loading ? t('common.loading') : t('share.invite')}
            </Button>
            <p className="text-xs text-fog leading-relaxed">{t('share.inviteHint')}</p>
          </div>
        ) : (
          <div className="rounded-lg bg-lavender-50 p-3">
            <p className="text-xs text-lavender-700 leading-relaxed">{t('share.lockedHint')}</p>
          </div>
        )}

        {owned.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('share.ownedTitle')}</p>
            {owned.map(renderOwned)}
          </div>
        )}

        {joined.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('share.joinedTitle')}</p>
            {joined.map(renderJoined)}
          </div>
        )}

        {owned.length === 0 && joined.length === 0 && (
          <p className="text-xs text-fog">{t('share.empty')}</p>
        )}
      </Card>
    </section>
  );
}
