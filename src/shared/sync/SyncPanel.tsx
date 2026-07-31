/**
 * src/shared/sync/SyncPanel.tsx
 * Phase 2 设置页同步面板：启用 / 解锁 / 同步 / 恢复码 / 重置口令。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Lock, ShieldCheck, RefreshCw, KeyRound, Copy, Check, LogOut } from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSync } from './store';
import { useAuth } from '../auth/store';

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

export function SyncPanel() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const status = useSync((s) => s.status);
  const loading = useSync((s) => s.loading);
  const error = useSync((s) => s.error);
  const lastSyncAt = useSync((s) => s.lastSyncAt);
  const recoveryCodes = useSync((s) => s.recoveryCodes);

  const init = useSync((s) => s.init);
  const enable = useSync((s) => s.enable);
  const unlock = useSync((s) => s.unlock);
  const syncNow = useSync((s) => s.syncNow);
  const regenerateRecoveryCodes = useSync((s) => s.regenerateRecoveryCodes);
  const resetPassphrase = useSync((s) => s.resetPassphrase);
  const clearRecoveryCodeDisplay = useSync((s) => s.clearRecoveryCodeDisplay);
  const clearSession = useSync((s) => s.clearSession);

  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPass, setNewPass] = useState('');
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    init();
  }, [init, user?.id]);

  if (!user) return null;

  async function handleEnable() {
    if (passphrase.length < 8) {
      useSync.setState({ error: t('sync.enableError') });
      return;
    }
    if (passphrase !== confirm) {
      useSync.setState({ error: t('sync.enableError') });
      return;
    }
    await enable(passphrase);
    setPassphrase('');
    setConfirm('');
  }

  async function handleUnlock() {
    await unlock(passphrase);
    setPassphrase('');
  }

  async function handleReset() {
    await resetPassphrase(recoveryInput.trim(), newPass);
    setRecoveryInput('');
    setNewPass('');
    setShowReset(false);
  }

  function copyCode(code: string, idx: number) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (status === 'unknown') {
    return (
      <section>
        <CardTitle>{t('sync.title')}</CardTitle>
        <Card>
          <p className="text-sm text-fog">{t('common.loading')}</p>
        </Card>
      </section>
    );
  }

  if (status === 'disabled') {
    return (
      <section>
        <CardTitle>{t('sync.title')}</CardTitle>
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-lavender-500 mt-0.5 shrink-0" />
            <p className="text-sm text-fog leading-relaxed">{t('sync.enableDesc')}</p>
          </div>
          <div className="space-y-2">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('sync.passphrasePlaceholder')}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('sync.confirmPassphrasePlaceholder')}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
            />
          </div>
          {error && <p className="text-xs text-coral-500">{error}</p>}
          <Button
            variant="primary"
            fullWidth
            leftIcon={<Cloud size={18} />}
            onClick={handleEnable}
            disabled={loading}
          >
            {loading ? t('common.loading') : t('sync.enable')}
          </Button>
        </Card>
      </section>
    );
  }

  if (status === 'locked') {
    return (
      <section>
        <CardTitle>{t('sync.title')}</CardTitle>
        <Card className="space-y-4">
          <p className="text-sm text-fog leading-relaxed">{t('sync.unlockDesc')}</p>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={t('sync.passphrasePlaceholder')}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
          />
          {error && <p className="text-xs text-coral-500">{error}</p>}
          <Button
            variant="primary"
            fullWidth
            leftIcon={<Lock size={18} />}
            onClick={handleUnlock}
            disabled={loading}
          >
            {loading ? t('common.loading') : t('sync.unlock')}
          </Button>
          <button
            type="button"
            className="text-xs text-lavender-500 hover:underline mx-auto block"
            onClick={() => setShowReset(true)}
          >
            {t('sync.forgotPassphrase')}
          </button>
          {showReset && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs text-fog leading-relaxed">{t('sync.resetDesc')}</p>
              <input
                type="text"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder={t('sync.recoveryCodePlaceholder')}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
              />
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder={t('sync.newPassphrasePlaceholder')}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
              />
              <Button
                variant="ghost"
                fullWidth
                leftIcon={<KeyRound size={18} />}
                onClick={handleReset}
                disabled={loading}
              >
                {t('sync.reset')}
              </Button>
            </div>
          )}
        </Card>
      </section>
    );
  }

  // status === 'ready'
  return (
    <section>
      <CardTitle>{t('sync.title')}</CardTitle>
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck size={20} className="text-lavender-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{t('sync.ready')}</p>
            {lastSyncAt && (
              <p className="text-xs text-fog tabular-nums">{t('sync.lastSync', { time: formatTime(lastSyncAt) })}</p>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-coral-500">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            leftIcon={<RefreshCw size={16} />}
            onClick={syncNow}
            disabled={loading}
          >
            {loading ? t('sync.syncing') : t('sync.syncNow')}
          </Button>
          <Button
            variant="ghost"
            leftIcon={<KeyRound size={16} />}
            onClick={regenerateRecoveryCodes}
            disabled={loading}
          >
            {t('sync.regenerate')}
          </Button>
        </div>

        <button
          type="button"
          className="text-xs text-fog hover:text-ink mx-auto block"
          onClick={clearSession}
        >
          <LogOut size={12} className="inline mr-1" />
          {t('sync.lockThisDevice')}
        </button>

        {recoveryCodes && (
          <div className="rounded-lg bg-lavender-50 p-4 space-y-3">
            <p className="text-sm text-ink font-medium">{t('sync.showRecoveryCodes')}</p>
            <p className="text-xs text-fog leading-relaxed">{t('sync.recoveryCodesHint')}</p>
            <ul className="grid grid-cols-1 gap-2">
              {recoveryCodes.map((code, i) => (
                <li key={code} className="flex items-center justify-between gap-2">
                  <code className="text-xs tabular-nums text-ink break-all">{code}</code>
                  <button
                    type="button"
                    onClick={() => copyCode(code, i)}
                    aria-label={t('sync.copy')}
                    className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-fog hover:text-lavender-500 hover:bg-white transition"
                  >
                    {copied === i ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="primary" fullWidth onClick={clearRecoveryCodeDisplay}>
              {t('sync.recoverySaved')}
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}
