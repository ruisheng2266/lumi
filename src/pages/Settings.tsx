import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, Info, LogIn, LogOut, Sun, Moon, Monitor, Upload, FileText, Plus } from 'lucide-react';
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
  lifeEventRepo,
  type LifeEventType,
} from '../shared/db/client';
import { today } from '../shared/lib/date';
import { useTheme } from '../shared/theme/useTheme';
import { APP_VERSION } from '../shared/version';
import { detectAndParse, type ImportPreview } from '../shared/lib/import';

export function Settings() {
  const { t } = useTranslation();
  const { locale, setLocale, available } = useLanguage();
  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ periods: number; logs: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const periodsCount = useLiveQuery(() => db.periods.count(), []);
  const logsCount = useLiveQuery(() => db.dailyLogs.count(), []);
  const profile = useLiveQuery(() => userProfileRepo.get(), []);
  const lifeEvents = useLiveQuery(() => lifeEventRepo.list(), []);

  // 特殊生理场景：添加 / 删除
  const [eventOpen, setEventOpen] = useState(false);
  const [eventType, setEventType] = useState<LifeEventType>('pregnancy');
  const [eventDate, setEventDate] = useState(today().toISOString().slice(0, 10));
  const [eventNotes, setEventNotes] = useState('');
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);

  const lifeEventTypes: LifeEventType[] = [
    'pregnancy',
    'miscarriage',
    'birth',
    'hysterectomy',
    'menopause',
    'perimenopause',
    'birthControlStart',
    'birthControlStop',
  ];
  const eventTypeOptions = lifeEventTypes.map((tp) => ({
    value: tp,
    label: t(`lifeEvent.type_${tp}`),
  }));

  function openEventSheet() {
    setEventType('pregnancy');
    setEventDate(today().toISOString().slice(0, 10));
    setEventNotes('');
    setEventOpen(true);
  }
  async function handleEventSave() {
    if (!eventDate) return;
    await lifeEventRepo.add({
      type: eventType,
      date: eventDate,
      notes: eventNotes.trim() || undefined,
    });
    setEventOpen(false);
  }
  async function handleEventDelete(id: number) {
    await lifeEventRepo.remove(id);
    setEventToDelete(null);
  }

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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选择同一文件
    if (!file) return;
    setImportError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const result = detectAndParse(text, file.name);
      if (result.format === 'unknown') {
        setImportError(t('settings.importUnsupported'));
        return;
      }
      setPreview(result);
    } catch {
      setImportError(t('settings.importUnsupported'));
    }
  }

  async function handleImportConfirm() {
    if (!preview) return;
    setImporting(true);
    try {
      let periodCount = 0;
      let logCount = 0;
      for (const p of preview.periods) {
        const existing = await db.periods.where('startDate').equals(p.startDate).first();
        if (existing?.id) {
          await db.periods.update(existing.id, p);
        } else {
          await db.periods.add({ ...p, createdAt: Date.now(), updatedAt: Date.now() });
        }
        periodCount++;
      }
      for (const l of preview.dailyLogs) {
        await dailyLogRepo.upsertByDate(l.date, {
          mood: l.mood,
          energy: l.energy,
          sleepHours: l.sleepHours,
          symptoms: l.symptoms,
          notes: l.notes,
        });
        logCount++;
      }
      if (preview.profile) {
        await userProfileRepo.upsert({
          avgCycleLen: preview.profile.avgCycleLen ?? 28,
          avgPeriodLen: preview.profile.avgPeriodLen ?? 5,
          displayName: preview.profile.displayName,
        });
      }
      setImportResult({ periods: periodCount, logs: logCount });
      setPreview(null);
    } finally {
      setImporting(false);
    }
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
              <p className="text-2xl font-bold tabular-nums text-lavender-500">
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

      {/* 特殊生理场景（v0.4） */}
      <section>
        <CardTitle>{t('lifeEvent.title')}</CardTitle>
        <Card className="space-y-3">
          <p className="text-xs text-fog leading-relaxed">{t('lifeEvent.desc')}</p>
          {lifeEvents && lifeEvents.length > 0 ? (
            <ul className="divide-y divide-lavender-50">
              {lifeEvents.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between py-2 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{t(`lifeEvent.type_${ev.type}`)}</p>
                    <p className="text-xs text-fog tabular-nums">{ev.date}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEventToDelete(ev.id ?? null)}
                    aria-label={t('lifeEvent.deleteConfirm')}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full text-fog hover:text-coral-500 hover:bg-coral-50 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-fog">{t('lifeEvent.none')}</p>
          )}
          <Button variant="ghost" fullWidth leftIcon={<Plus size={18} />} onClick={openEventSheet}>
            {t('lifeEvent.add')}
          </Button>
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

          <Button
            variant="ghost"
            fullWidth
            leftIcon={<FileText size={18} />}
            onClick={() => navigate('/report')}
          >
            {t('report.open')}
          </Button>
          <p className="text-xs text-fog -mt-1">{t('report.desc')}</p>

          <Button
            variant="ghost"
            fullWidth
            leftIcon={<Upload size={18} />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('settings.importData')}
          </Button>
          <p className="text-xs text-fog -mt-1">{t('settings.importDataDesc')}</p>
          {importError && <p className="text-xs text-coral-500">{importError}</p>}
          {importResult && (
            <p className="text-xs text-lavender-500">
              {t('settings.importSuccess', { periods: importResult.periods, logs: importResult.logs })}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            aria-label={t('settings.importData')}
            className="hidden"
            onChange={handleFile}
          />

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
          className="block rounded-2xl border border-border bg-surface text-center text-xs text-fog py-4 px-3 space-y-1 hover:bg-lavender-50 transition"
        >
          <p className="font-medium text-ink">Lumi · {t('settings.version')} {APP_VERSION}</p>
          <p>{t('overview.tagline')}</p>
          <p className="text-lavender-500 mt-1">{t('about.title')} →</p>
        </Link>
      </section>

      {/* 导入预览 Sheet */}
      <Sheet open={preview !== null} onClose={() => setPreview(null)} title={t('settings.importPreviewTitle')}>
        {preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-fog">{t('settings.importFormat')}</span>
              <span className="font-medium text-ink">
                {preview.format === 'lumi-json'
                  ? t('settings.importFormatLumi')
                  : preview.format === 'generic-csv'
                    ? t('settings.importFormatCsv')
                    : t('settings.importFormatUnknown')}
              </span>
            </div>
            {preview.rowCount === 0 ? (
              <p className="text-sm text-danger">{t('settings.importNoData')}</p>
            ) : (
              <ul className="text-sm text-ink space-y-1">
                <li>{t('settings.importPeriodCount', { count: preview.periods.length })}</li>
                <li>{t('settings.importLogCount', { count: preview.dailyLogs.length })}</li>
              </ul>
            )}
            {preview.warnings.length > 0 && (
              <div className="rounded-lg bg-coral-50 p-3 text-sm text-danger">
                <p className="font-medium mb-1">{t('settings.importWarningTitle')}</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-fog">{t('settings.importMergeHint')}</p>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setPreview(null)} disabled={importing}>
                {t('settings.importCancel')}
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleImportConfirm}
                disabled={importing || preview.rowCount === 0}
              >
                {t('settings.importConfirm')}
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* 清空确认 Sheet */}
      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title={t('settings.clearConfirmTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">{t('settings.clearConfirmDesc')}</p>
          <div className="rounded-lg bg-coral-50 p-3 text-sm text-danger">
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

      {/* 添加特殊生理场景 Sheet */}
      <Sheet open={eventOpen} onClose={() => setEventOpen(false)} title={t('lifeEvent.addTitle')}>
        <div className="space-y-5">
          <section>
            <label className="block text-sm font-medium text-fog mb-2">{t('lifeEvent.type')}</label>
            <Select value={eventType} onChange={(v) => setEventType(v as LifeEventType)} options={eventTypeOptions} />
          </section>
          <section>
            <label htmlFor="eventDate" className="block text-sm font-medium text-fog mb-2">
              {t('lifeEvent.date')}
            </label>
            <input
              id="eventDate"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300 tabular-nums"
            />
          </section>
          <section>
            <label htmlFor="eventNotes" className="block text-sm font-medium text-fog mb-2">
              {t('lifeEvent.notes')}
            </label>
            <textarea
              id="eventNotes"
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              placeholder={t('lifeEvent.notesPlaceholder')}
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300 resize-none"
            />
          </section>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setEventOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button fullWidth onClick={handleEventSave} disabled={!eventDate}>
              {t('lifeEvent.save')}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* 删除特殊生理场景确认 Sheet */}
      <Sheet open={eventToDelete !== null} onClose={() => setEventToDelete(null)} title={t('lifeEvent.deleteConfirm')}>
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">{t('lifeEvent.deleteConfirm')}</p>
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setEventToDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" fullWidth onClick={() => eventToDelete !== null && handleEventDelete(eventToDelete)}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}