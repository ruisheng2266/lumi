import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, Info, LogIn, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { Card, CardTitle } from '../shared/ui/Card';
import { Button } from '../shared/ui/Button';
import { Sheet } from '../shared/ui/Sheet';
import { Select } from '../shared/ui/Select';
import { useLanguage } from '../shared/i18n/useLanguage';
import { useAuth } from '../shared/auth/store';
import {
  db,
  periodRepo,
  dailyLogRepo,
  userProfileRepo,
  settingsRepo,
} from '../shared/db/client';
import { today } from '../shared/lib/date';
import { useTheme } from '../shared/theme/useTheme';
import { APP_VERSION } from '../shared/version';

export function Settings() {
  const { t } = useTranslation();
  const { locale, setLocale, available } = useLanguage();
  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);
  const { theme, setTheme } = useTheme();
  const [confirmClear, setConfirmClear] = useState(false);
  const [exporting, setExporting] = useState(false);

  const periodsCount = useLiveQuery(() => db.periods.count(), []);
  const logsCount = useLiveQuery(() => db.dailyLogs.count(), []);
  const profile = useLiveQuery(() => userProfileRepo.get(), []);

  async function handleExport() {
    setExporting(true);
    try {
      const exportData = {
        meta: {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          appVersion: APP_VERSION,
          language: locale,
        },
        profile: await userProfileRepo.get(),
        periods: await periodRepo.list(),
        dailyLogs: await dailyLogRepo.list(),
        settings: {
          language: await settingsRepo.get('language'),
          theme: await settingsRepo.get('theme'),
          onboarded: await settingsRepo.get('onboarded'),
        },
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lumi-backup-${today().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleClear() {
    await db.delete();
    await db.open();
    setConfirmClear(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('pages.settingsTitle')}</h1>

      {/* Account (optional, V1.4) */}
      <section>
        <CardTitle>{t('account.title')}</CardTitle>
        <Card>
          {authLoading ? (
            <p className="text-sm text-fog">{t('common.loading')}</p>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.picture && (
                <img src={user.picture} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.name || user.email}</p>
                <p className="text-xs text-fog truncate">{user.email}</p>
              </div>
              <Button variant="ghost" size="sm" leftIcon={<LogOut size={16} />} onClick={logout}>
                {t('account.logout')}
              </Button>
            </div>
          ) : (
            <Button variant="primary" fullWidth leftIcon={<LogIn size={18} />} onClick={login}>
              {t('account.loginWithGoogle')}
            </Button>
          )}
          {user && (
            <p className="mt-3 text-xs text-fog">{t('account.syncHint')}</p>
          )}
        </Card>
      </section>

      {/* Stats overview */}
      <section>
        <Card variant="flat">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums text-lavender-500">
                {periodsCount ?? 0}
              </p>
              <p className="text-xs text-fog mt-1">
                {t('overview.periodUnit', { count: periodsCount ?? 0 })}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-coral-500">
                {logsCount ?? 0}
              </p>
              <p className="text-xs text-fog mt-1">
                {t('overview.logUnit', { count: logsCount ?? 0 })}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-lavender-400">
                {profile?.avgCycleLen ?? '—'}
              </p>
              <p className="text-xs text-fog mt-1">{t('overview.avgCycleUnit')}</p>
            </div>
          </div>
        </Card>
      </section>

      {/* 语言（下拉框） */}
      <section>
        <CardTitle>{t('settings.language')}</CardTitle>
        <Card>
          <Select
            value={locale}
            onChange={(v) => setLocale(v as typeof locale)}
            options={available.map((loc) => ({
              value: loc.code,
              label: loc.nativeName,
              hint: loc.englishName,
              flag: loc.flag,
            }))}
          />
        </Card>
      </section>

      {/* 主题 */}
      <section>
        <CardTitle>{t('settings.theme')}</CardTitle>
        <Card>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={theme === 'light' ? 'primary' : 'ghost'}
              onClick={() => setTheme('light')}
              leftIcon={<Sun size={16} />}
            >
              {t('settings.themeLight')}
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'ghost'}
              onClick={() => setTheme('dark')}
              leftIcon={<Moon size={16} />}
            >
              {t('settings.themeDark')}
            </Button>
            <Button
              variant={theme === 'system' ? 'primary' : 'ghost'}
              onClick={() => setTheme('system')}
              leftIcon={<Monitor size={16} />}
            >
              {t('settings.themeSystem')}
            </Button>
          </div>
        </Card>
      </section>

      {/* 隐私 */}
      <section>
        <CardTitle>{t('settings.privacy')}</CardTitle>
        <Card>
          <div className="flex items-start gap-3">
            <Info size={18} className="text-lavender-500 mt-0.5 shrink-0" />
            <p className="text-sm text-fog leading-relaxed">{t('settings.privacyNotice')}</p>
          </div>
        </Card>
      </section>

      {/* 数据 */}
      <section>
        <CardTitle>{t('settings.about')}</CardTitle>
        <Card className="space-y-3">
          <Button
            variant="ghost"
            fullWidth
            leftIcon={<Download size={18} />}
            onClick={handleExport}
            disabled={exporting}
          >
            {t('settings.exportData')}
          </Button>
          <p className="text-xs text-fog -mt-1">{t('settings.exportDataDesc')}</p>

          <div className="border-t border-lavender-100 pt-3">
            <Button
              variant="danger"
              fullWidth
              leftIcon={<Trash2 size={18} />}
              onClick={() => setConfirmClear(true)}
            >
              {t('settings.clearData')}
            </Button>
            <p className="text-xs text-fog mt-2">{t('settings.clearDataDesc')}</p>
          </div>
        </Card>
      </section>

      {/* About footer */}
      <section>
        <Link
          to="/about"
          className="block rounded-2xl border border-lavender-100 bg-white text-center text-xs text-fog py-4 px-3 space-y-1 hover:bg-lavender-50 transition"
        >
          <p className="font-medium text-ink">Lumi · {t('settings.version')} {APP_VERSION}</p>
          <p>{t('overview.tagline')}</p>
          <p className="text-lavender-500 mt-1">{t('about.title')} →</p>
        </Link>
      </section>

      {/* 清空确认 Sheet */}
      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title={t('settings.clearConfirmTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">{t('settings.clearConfirmDesc')}</p>
          <div className="rounded-lg bg-coral-50 p-3 text-sm text-coral-500">
            {t('clear.willDelete')}
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>
                {t('overview.periodUnit', { count: periodsCount ?? 0 })}
              </li>
              <li>
                {t('overview.logUnit', { count: logsCount ?? 0 })}
              </li>
              <li>{t('clear.profileAndSettings')}</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" fullWidth onClick={handleClear}>
              {t('settings.clearData')}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}