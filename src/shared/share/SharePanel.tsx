/**
 * src/shared/share/SharePanel.tsx
 * Phase 4 设置页「伴侣共享」面板：邀请 / 接受 / 范围设置 / 同步 / 撤销。
 *
 * 门控与红线（2026-08-04 修复「伴侣免费」BLOCKER 后）：
 *  - 发起共享需创建者具备同步权益（Plus / 创始 / 祖父老用户）；伴侣接受与查看完全免费。
 *  - 伴侣**无需启用付费的 E2EE 同步**即可接收共享：首次接收前自设一个「共享口令」，用于
 *    加密保护其共享私钥（零知识，服务端不可解）。该口令与同步口令相互独立。
 *  - 已启用同步的用户，其共享私钥由同步 vault 密钥包裹（口令重置不失效）；未启用同步的免费
 *    伴侣，由共享口令包裹。两条路径在 shareStore 中分别处理。
 *  - 撤销走「轮换密钥 + 全量重加密」，不是删一行了事。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, UserPlus, RefreshCw, ShieldOff, Lock, Check, Eye } from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useAuth } from '../auth/store';
import { useSync, getUserPrivateKey, setupShareKeypair, unlockShareKeypair } from '../sync/store';
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
  // 免费伴侣「共享口令」表单状态
  const [sharePass, setSharePass] = useState('');
  const [sharePassConfirm, setSharePassConfirm] = useState('');
  const [shareKeyError, setShareKeyError] = useState<string | null>(null);

  const ready = syncStatus === 'ready';
  const hasShareKey = !!getUserPrivateKey();

  // 联调/接收：用户登录即拉取共享关系（list 端点不查 plan，免费伴侣也可查看）
  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  if (!user) return null;

  const owned = vaults.filter((v) => v.role === 'owner');
  const joined = vaults.filter((v) => v.role === 'partner');

  /**
   * 确保当前会话持有共享私钥：若内存中已有则直接返回；否则先用共享口令解锁，
   * 若服务端尚无密钥材料（首次）则改用口令创建。口令错误时抛错交由 UI 提示。
   */
  async function ensureShareKey(pass: string): Promise<void> {
    if (getUserPrivateKey()) return;
    try {
      await unlockShareKeypair(pass);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'no_remote_share_key') {
        await setupShareKeypair(pass);
      } else {
        throw new Error('wrong_share_passphrase');
      }
    }
  }

  async function handleInvite() {
    if (!email.includes('@')) return;
    await invite(email, newScope);
    setEmail('');
  }

  /** 伴侣侧：若已持有密钥直接接受；否则先用共享口令解锁/创建再接受 */
  async function handlePartnerAccess(vaultId: string) {
    if (!hasShareKey) {
      if (sharePass.length < 1) {
        setShareKeyError(t('share.passphraseRequired'));
        return;
      }
      if (sharePass !== sharePassConfirm) {
        setShareKeyError(t('share.passphraseMismatch'));
        return;
      }
      try {
        await ensureShareKey(sharePass);
      } catch {
        setShareKeyError(t('share.wrongSharePassphrase'));
        return;
      }
    }
    await accept(vaultId);
    setSharePass('');
    setSharePassConfirm('');
    setShareKeyError(null);
  }

  /** 顶部「共享口令」设置卡（免费伴侣在收到邀请前主动设置，使创建者可成功邀请） */
  async function handleSetupShareKey() {
    if (sharePass.length < 1) {
      setShareKeyError(t('share.passphraseRequired'));
      return;
    }
    if (sharePass !== sharePassConfirm) {
      setShareKeyError(t('share.passphraseMismatch'));
      return;
    }
    try {
      await setupShareKeypair(sharePass);
      setSharePass('');
      setSharePassConfirm('');
      setShareKeyError(null);
    } catch {
      setShareKeyError(t('share.setupShareKeyFailed'));
    }
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
            {hasShareKey ? (
              <Button
                variant="primary"
                fullWidth
                leftIcon={<Check size={16} />}
                onClick={() => accept(v.vaultId)}
                disabled={loading}
              >
                {t('share.accept')}
              </Button>
            ) : (
              <div className="space-y-2">
                <input
                  type="password"
                  value={sharePass}
                  onChange={(e) => setSharePass(e.target.value)}
                  placeholder={t('share.sharePassphrasePlaceholder')}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
                />
                <input
                  type="password"
                  value={sharePassConfirm}
                  onChange={(e) => setSharePassConfirm(e.target.value)}
                  placeholder={t('share.confirmPassphrasePlaceholder')}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
                />
                {shareKeyError && <p className="text-xs text-coral-500 break-words">{shareKeyError}</p>}
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<Check size={16} />}
                  onClick={() => handlePartnerAccess(v.vaultId)}
                  disabled={loading}
                >
                  {t('share.setupShareKey')}
                </Button>
              </div>
            )}
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

        {/* 免费伴侣：设置共享口令以接收（无需启用付费同步） */}
        {!syncEntitled && !hasShareKey && (
          <div className="rounded-lg bg-lavender-50 p-3 space-y-2">
            <p className="text-xs text-lavender-700 leading-relaxed">
              {t('share.sharePassphraseDesc')}
            </p>
            <input
              type="password"
              value={sharePass}
              onChange={(e) => setSharePass(e.target.value)}
              placeholder={t('share.sharePassphrasePlaceholder')}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
            />
            <input
              type="password"
              value={sharePassConfirm}
              onChange={(e) => setSharePassConfirm(e.target.value)}
              placeholder={t('share.confirmPassphrasePlaceholder')}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
            />
            {shareKeyError && <p className="text-xs text-coral-500 break-words">{shareKeyError}</p>}
            <Button
              variant="primary"
              fullWidth
              leftIcon={<Lock size={16} />}
              onClick={handleSetupShareKey}
              disabled={loading}
            >
              {t('share.setupShareKey')}
            </Button>
          </div>
        )}
        {!syncEntitled && hasShareKey && (
          <p className="text-xs text-lavender-600">{t('share.shareKeyReady')}</p>
        )}

        {/* 我发起的共享（仅创建者 / Plus） */}
        {syncEntitled ? (
          ready ? (
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
              <p className="text-xs text-lavender-700 leading-relaxed">{t('share.needSync')}</p>
            </div>
          )
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
