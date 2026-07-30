/**
 * src/pages/DoctorReport.tsx
 * 医生报告（v0.4）：本地生成可打印的健康摘要，便于就诊沟通。
 * 通过浏览器「打印 / 另存为 PDF」导出，无任何网络请求。
 */
import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { Button } from '../shared/ui/Button';
import {
  periodRepo,
  dailyLogRepo,
  userProfileRepo,
  lifeEventRepo,
  type Period,
  type DailyLog,
} from '../shared/db/client';
import { avgCycleLen, cycleRegularity } from '../shared/lib/predict';
import { fromISO, fmtShort, daysBetween } from '../shared/lib/date';
import { exportElementToPdf } from '../shared/lib/pdf';

export function DoctorReport() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function handleDownload() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportElementToPdf(reportRef.current, {
        filename: `lumi-doctor-report-${stamp}.pdf`,
      });
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setExporting(false);
    }
  }

  const periods = useLiveQuery(() => periodRepo.list(), []);
  const logs = useLiveQuery(() => dailyLogRepo.list(), []);
  const profile = useLiveQuery(() => userProfileRepo.get(), []);
  const lifeEvents = useLiveQuery(() => lifeEventRepo.list(), []);

  if (!periods || !logs || !lifeEvents) {
    return <div className="text-fog text-center py-12">{t('common.loading')}</div>;
  }

  const sortedPeriods = [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const periodLenAvg = (() => {
    const lengths = periods
      .map((p: Period) => (p.endDate ? daysBetween(fromISO(p.startDate), fromISO(p.endDate)) + 1 : 1))
      .filter((n) => n > 0);
    return lengths.length ? lengths.reduce((s, n) => s + n, 0) / lengths.length : null;
  })();

  const regularity = cycleRegularity(periods as Period[]);
  const regularityLabel = (() => {
    switch (regularity) {
      case 'good': return t('report.regularity_good');
      case 'ok': return t('report.regularity_ok');
      case 'irregular': return t('report.regularity_irregular');
      default: return t('report.regularity_insufficient');
    }
  })();

  const avgOf = (
    arr: DailyLog[],
    pick: (l: DailyLog) => number | undefined | null,
  ) => {
    const vals = arr.map(pick).filter((v): v is number => typeof v === 'number');
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const avgMood = avgOf(logs, (l) => l.mood);
  const avgEnergy = avgOf(logs, (l) => l.energy);
  const avgSleep = avgOf(logs, (l) => l.sleepHours);

  const symptomCounts: Record<string, number> = {};
  for (const log of logs) {
    for (const s of log.symptoms ?? []) {
      symptomCounts[s] = (symptomCounts[s] ?? 0) + 1;
    }
  }
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const generatedOn = fmtShort(new Date());
  const historyCount = 12;

  return (
    <div className="min-h-full bg-cream py-6 px-4">
      <div className="max-w-2xl mx-auto report-root">
        {/* 顶部工具条（打印时隐藏） */}
        <div className="no-print flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
            ← {t('report.back')}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Printer size={16} />}
              onClick={() => window.print()}
            >
              {t('report.print')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download size={16} />}
              onClick={handleDownload}
              disabled={exporting}
            >
              {exporting ? '…' : t('report.downloadPdf')}
            </Button>
          </div>
        </div>

        {/* 报告主体（导出锚点） */}
        <div
          ref={reportRef}
          className="bg-white rounded-lg shadow-card p-6 print:shadow-none print:p-0"
        >
          {/* 抬头 */}
          <header className="border-b border-lavender-100 pb-4 mb-5">
            <h1 className="text-2xl font-semibold text-ink">Lumi · {t('report.title')}</h1>
            <p className="text-sm text-fog mt-1">{t('report.desc')}</p>
            <p className="text-xs text-fog mt-2">
              {t('report.generatedOn')}: {generatedOn}
            </p>
          </header>

          {/* 基本信息 */}
          <section className="mb-5">
            <h2 className="text-sm font-semibold text-lavender-600 mb-2">{t('report.patient')}</h2>
            <p className="text-sm text-ink">
              {t('report.name')}: {profile?.displayName || t('report.notSet')}
            </p>
          </section>

          {/* 周期统计 */}
          <section className="mb-5">
            <h2 className="text-sm font-semibold text-lavender-600 mb-2">{t('report.cycleStats')}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-lavender-50 px-3 py-2">
                <p className="text-fog text-xs">{t('report.trackedCycles')}</p>
                <p className="font-semibold text-ink tabular-nums">{periods.length}</p>
              </div>
              <div className="rounded-lg bg-lavender-50 px-3 py-2">
                <p className="text-fog text-xs">{t('report.regularity')}</p>
                <p className="font-semibold text-ink">{regularityLabel}</p>
              </div>
              <div className="rounded-lg bg-lavender-50 px-3 py-2">
                <p className="text-fog text-xs">{t('report.avgCycleLen')}</p>
                <p className="font-semibold text-ink tabular-nums">
                  {periods.length >= 2 ? `${Math.round(avgCycleLen(periods as Period[]))} 天` : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-lavender-50 px-3 py-2">
                <p className="text-fog text-xs">{t('report.avgPeriodLen')}</p>
                <p className="font-semibold text-ink tabular-nums">
                  {periodLenAvg ? `${periodLenAvg.toFixed(1)} 天` : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-lavender-50 px-3 py-2">
                <p className="text-fog text-xs">{t('report.firstPeriod')}</p>
                <p className="font-semibold text-ink tabular-nums">
                  {sortedPeriods.length ? fmtShort(fromISO(sortedPeriods[sortedPeriods.length - 1].startDate)) : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-lavender-50 px-3 py-2">
                <p className="text-fog text-xs">{t('report.lastPeriod')}</p>
                <p className="font-semibold text-ink tabular-nums">
                  {sortedPeriods.length ? fmtShort(fromISO(sortedPeriods[0].startDate)) : '—'}
                </p>
              </div>
            </div>
          </section>

          {/* 月经记录历史 */}
          {sortedPeriods.length > 0 && (
            <section className="mb-5">
              <h2 className="text-sm font-semibold text-lavender-600 mb-2">
                {t('report.periodHistory', { count: Math.min(historyCount, sortedPeriods.length) })}
              </h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-fog border-b border-lavender-100">
                    <th className="py-1 pr-2 font-medium">{t('report.startDate')}</th>
                    <th className="py-1 pr-2 font-medium">{t('report.endDate')}</th>
                    <th className="py-1 pr-2 font-medium">{t('report.length')}</th>
                    <th className="py-1 font-medium">{t('report.flow')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPeriods.slice(0, historyCount).map((p) => (
                    <tr key={p.id} className="border-b border-lavender-50">
                      <td className="py-1 pr-2 tabular-nums">{p.startDate}</td>
                      <td className="py-1 pr-2 tabular-nums">{p.endDate ?? '—'}</td>
                      <td className="py-1 pr-2 tabular-nums">
                        {p.endDate ? daysBetween(fromISO(p.startDate), fromISO(p.endDate)) + 1 : 1}
                      </td>
                      <td className="py-1">
                        {p.flow ? t(`flow.${p.flow}`) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 症状频次 */}
          {topSymptoms.length > 0 && (
            <section className="mb-5">
              <h2 className="text-sm font-semibold text-lavender-600 mb-2">{t('report.symptoms')}</h2>
              <ul className="text-sm text-ink space-y-1">
                {topSymptoms.map(([sym, count]) => (
                  <li key={sym} className="flex justify-between">
                    <span>{t(`symptoms.${sym}`)}</span>
                    <span className="text-fog tabular-nums">{count} 天</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 情绪与睡眠 */}
          <section className="mb-5">
            <h2 className="text-sm font-semibold text-lavender-600 mb-2">{t('report.moodSleep')}</h2>
            <p className="text-sm text-ink">
              {t('report.avgMood')}: {avgMood ? avgMood.toFixed(1) : '—'} / 5 ·{' '}
              {t('report.avgEnergy')}: {avgEnergy ? avgEnergy.toFixed(1) : '—'} / 5 ·{' '}
              {t('report.avgSleep')}: {avgSleep ? avgSleep.toFixed(1) : '—'} h
            </p>
            <p className="text-xs text-fog mt-1">{t('report.daysTracked', { count: logs.length })}</p>
          </section>

          {/* 特殊生理事件 */}
          <section className="mb-5">
            <h2 className="text-sm font-semibold text-lavender-600 mb-2">{t('report.events')}</h2>
            {lifeEvents.length > 0 ? (
              <ul className="text-sm text-ink space-y-1">
                {lifeEvents.map((ev) => (
                  <li key={ev.id} className="flex justify-between">
                    <span>{t(`lifeEvent.type_${ev.type}`)}</span>
                    <span className="text-fog tabular-nums">{ev.date}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fog">{t('report.noEvents')}</p>
            )}
          </section>

          {/* 免责声明 */}
          <footer className="border-t border-lavender-100 pt-4">
            <p className="text-xs text-fog leading-relaxed">{t('report.disclaimer')}</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
