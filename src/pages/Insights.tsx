import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { periodRepo, dailyLogRepo, userProfileRepo } from '../shared/db/client';
import { buildInsights, type Insight } from '../shared/lib/insights';
import { Suspense, lazy } from 'react';
import { Card } from '../shared/ui/Card';
const InsightsCharts = lazy(() => import('../features/InsightsCharts').then((m) => ({ default: m.InsightsCharts })));
import { today } from '../shared/lib/date';

export function Insights() {
  const { t } = useTranslation();
  const periods = useLiveQuery(() => periodRepo.list(), []);
  const logs = useLiveQuery(() => dailyLogRepo.list(), []);
  const profile = useLiveQuery(() => userProfileRepo.get(), []);

  if (!periods || !logs) {
    return <div className="text-fog text-center py-12">{t('common.loading')}</div>;
  }

  const insights = buildInsights(
    periods,
    logs,
    today(),
    profile?.avgCycleLen,
    profile?.avgPeriodLen,
    t,
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

      <div className="space-y-3">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>

      {/* 趋势回顾：心情 / 精力 / 睡眠 + 症状频率（PRD §6.3.3） */}
      <Suspense fallback={<div className="h-40 rounded-2xl bg-lavender-50 animate-pulse" />}>
        <InsightsCharts logs={logs} />
      </Suspense>

      <Card variant="flat" className="text-xs text-fog text-center py-3">
        {t('insight.basedOn', { periods: periods.length, logs: logs.length })}
      </Card>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const bgBySeverity = {
    info: 'bg-white',
    gentle: 'bg-lavender-50',
    important: 'bg-coral-50',
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
      <p className="text-sm text-ink mt-2">{insight.interpretation}</p>
      <div className="mt-3 pt-3 border-t border-lavender-100/50">
        <p className="text-sm text-fog">
          <span className="text-lavender-500">🌿</span> {insight.suggestion}
        </p>
      </div>
    </Card>
  );
}