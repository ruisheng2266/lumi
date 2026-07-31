import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronDown } from 'lucide-react';
import { periodRepo, dailyLogRepo, userProfileRepo, insightPrefRepo, lifeEventRepo } from '../shared/db/client';
import { buildInsights, type Insight, INSIGHT_CATEGORIES } from '../shared/lib/insights';
import { Suspense, lazy, useState } from 'react';
import { Card } from '../shared/ui/Card';
const InsightsCharts = lazy(() => import('../features/InsightsCharts').then((m) => ({ default: m.InsightsCharts })));
const LongTermCharts = lazy(() => import('../features/LongTermCharts').then((m) => ({ default: m.LongTermCharts })));
import { today } from '../shared/lib/date';

export function Insights() {
  const { t } = useTranslation();
  const periods = useLiveQuery(() => periodRepo.list(), []);
  const logs = useLiveQuery(() => dailyLogRepo.list(), []);
  const profile = useLiveQuery(() => userProfileRepo.get(), []);
  const prefs = useLiveQuery(() => insightPrefRepo.getAll(), []) ?? {};
  const lifeEvents = useLiveQuery(() => lifeEventRepo.list(), []);

  if (!periods || !logs) {
    return <div className="text-fog text-center py-12">{t('common.loading')}</div>;
  }

  const disabledCategories = INSIGHT_CATEGORIES.filter((c) => prefs[c] === false);
  const insights = buildInsights(
    periods,
    logs,
    today(),
    profile?.avgCycleLen,
    profile?.avgPeriodLen,
    t,
    disabledCategories,
    lifeEvents ?? [],
  );

  if (insights.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold">{t('pages.insightsTitle')}</h1>
        <Card variant="flat" className="text-center py-12">
          <Sparkles size={32} className="text-lavender-300 mx-auto mb-3" />
          <p className="text-fog">{t('today.notEnoughData')}</p>
          <p className="text-xs text-fog mt-2">
            {t('common.loggedDays', { count: periods.length })}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles size={20} className="text-lavender-500" />
        <h1 className="text-2xl font-semibold">{t('pages.insightsTitle')}</h1>
      </div>

      <p className="text-xs text-fog">
        {t('insight.privacyFooter')}
      </p>

      {/* 洞察分类开关（PRD §6.4.6 / 审计 #3）：可关闭某类洞察并持久化 */}
      <Card variant="flat" className="space-y-1">
        <p className="text-sm font-medium text-fog mb-1">{t('insight.manageCategories')}</p>
        {INSIGHT_CATEGORIES.map((cat) => {
          const enabled = prefs[cat] !== false;
          return (
            <div key={cat} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-ink">{t(`insight.category.${cat}`)}</span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={t(`insight.category.${cat}`)}
                onClick={() => insightPrefRepo.set(cat, !enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  enabled ? 'bg-lavender-400' : 'bg-lavender-100'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </Card>

      <div className="space-y-3">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>

      {/* 趋势回顾：心情 / 精力 / 睡眠 + 症状频率（PRD §6.3.3） */}
      <Suspense fallback={<div className="h-40 rounded-2xl bg-surface animate-pulse" />}>
        <InsightsCharts logs={logs} />
      </Suspense>

      {/* 多年趋势 & 相关性 & BBT（v0.5） */}
      <Suspense fallback={<div className="h-40 rounded-2xl bg-surface animate-pulse" />}>
        <LongTermCharts periods={periods} logs={logs} />
      </Suspense>

      <Card variant="flat" className="text-xs text-fog text-center py-3">
        {t('insight.basedOn', { periods: periods.length, logs: logs.length })}
      </Card>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const bgBySeverity = {
    info: 'bg-surface',
    gentle: 'bg-surface',
    important: 'bg-surface',
  }[insight.severity];

  const accentColor = {
    info: 'text-lavender-500',
    gentle: 'text-lavender-600',
    important: 'text-coral-500',
  }[insight.severity];

  return (
    <Card className={`${bgBySeverity} transition`}>
      <div className="flex items-start gap-3 mb-2">
        {insight.emoji && <span className="text-2xl">{insight.emoji}</span>}
        <div className="flex-1">
          <h3 className={`text-base font-semibold ${accentColor}`}>
            {insight.title}
          </h3>
          <p className="text-sm text-fog mt-0.5 tabular-nums">{insight.data}</p>
        </div>
      </div>

      {expanded && (
        <>
          <p className="text-sm text-ink mt-2">{insight.interpretation}</p>
          <div className="mt-3 pt-3 border-t border-lavender-100/50">
            <p className="text-sm text-fog">
              <span className="text-lavender-500">🌿</span> {insight.suggestion}
            </p>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-xs text-lavender-500 hover:text-lavender-600 inline-flex items-center gap-1"
        aria-expanded={expanded}
      >
        {expanded ? t('insight.hideDetails') : t('insight.viewDetails')}
        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </Card>
  );
}