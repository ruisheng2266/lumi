import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, Info, LogIn, LogOut, Sun, Moon } from 'lucide-react';
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

export function Settings() {
  const { t } = useTranslation();
  const { locale, setLocale, available } = useLanguage();
  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);
  const { theme, toggleTheme } = useTheme();
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
          appVersion: '0.1.0',
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

      {/* 账号 */}
      <section>
        <CardTitle>账号</CardTitle>
        <Card>
          {authLoading ? (
            <p className="text-sm text-fog">加载中...</p>
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
                登出
              </Button>
            </div>
          ) : (
            <Button variant="primary" fullWidth leftIcon={<LogIn size={18} />} onClick={login}>
              用 Google 登录
            </Button>
          )}
          {user && (
            <p className="mt-3 text-xs text-fog">登录后可保存偏好到云端；健康数据仍仅存储在本地。</p>
          )}
        </Card>
      </section>

      {/* 概况 */}
      <section>
        <Card variant="flat">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums text-lavender-500">
                {periodsCount ?? 0}
              </p>
              <p className="text-xs text-fog mt-1">次月经记录</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-coral-500">
                {logsCount ?? 0}
              </p>
              <p className="text-xs text-fog mt-1">条健康日记</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-lavender-400">
                {profile?.avgCycleLen ?? '—'}
              </p>
              <p className="text-xs text-fog mt-1">天平均周期</p>
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
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={theme === 'light' ? 'primary' : 'ghost'}
              onClick={() => theme !== 'light' && toggleTheme()}
              leftIcon={<Sun size={16} />}
            >
              {t('settings.themeLight')}
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'ghost'}
              onClick={() => theme !== 'dark' && toggleTheme()}
              leftIcon={<Moon size={16} />}
            >
              {t('settings.themeDark')}
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

      {/* 关于 */}
      <section>
        <Card variant="flat" className="text-center text-xs text-fog py-4 space-y-1">
          <p>Lumi · {t('settings.version')} 0.1.0</p>
          <p>本地优先 · 数据归你 · 永远免费</p>
        </Card>
      </section>

      {/* 清空确认 Sheet */}
      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title={t('settings.clearConfirmTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">{t('settings.clearConfirmDesc')}</p>
          <div className="rounded-lg bg-coral-50 p-3 text-sm text-coral-500">
            ⚠️ 将被删除：
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>{periodsCount ?? 0} 次月经记录</li>
              <li>{logsCount ?? 0} 条健康日记</li>
              <li>个人档案与设置</li>
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