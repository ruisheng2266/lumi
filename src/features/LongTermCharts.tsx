/**
 * src/features/LongTermCharts.tsx
 * 多年趋势 & 相关性 & BBT 曲线（v0.5）
 * 懒加载挂载于 Insights 页，传入 periods + logs。
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { Card, CardTitle } from '../shared/ui/Card';
import type { DailyLog, Period } from '../shared/db/client';
import {
  cycleLengthSeries,
  symptomPhaseCorrelation,
  PHASE_ORDER,
} from '../shared/lib/trends';
import { buildBBTChart } from '../shared/lib/fertility';

interface LongTermChartsProps {
  periods: Period[];
  logs: DailyLog[];
}

const phaseColors: Record<string, string> = {
  menstrual: '#E8B4A0',
  follicular: '#C8B6E2',
  ovulation: '#7FA888',
  luteal: '#F1C5B7',
};

export function LongTermCharts({ periods, logs }: LongTermChartsProps) {
  const { t } = useTranslation();

  const cyclePoints = useMemo(
    () => cycleLengthSeries(periods as any),
    [periods],
  );
  const correlation = useMemo(
    () => symptomPhaseCorrelation(periods as any, logs as any),
    [periods, logs],
  );
  const bbt = useMemo(() => buildBBTChart(logs as any), [logs]);

  return (
    <div className="space-y-3">
      {/* 周期长度长期趋势 */}
      <Card>
        <CardTitle>{t('chart.cycleTrend')}</CardTitle>
        {cyclePoints.length < 2 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-fog">{t('chart.cycleTrendEmpty')}</p>
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cyclePoints} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F1FA" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B8680' }} stroke="#F5F1FA" interval="preserveStartEnd" />
                <YAxis domain={[15, 45]} tick={{ fontSize: 11, fill: '#8B8680' }} stroke="#F5F1FA" width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 12, backgroundColor: '#FFFFFF', border: '1px solid #F5F1FA', borderRadius: 8 }}
                  labelStyle={{ color: '#2D2A26' }}
                  formatter={(value: number) => [`${value} ${t('common.days')}`, t('chart.cycleTrendY')]}
                />
                <Line type="monotone" dataKey="interval" stroke="#7FA888" strokeWidth={2} dot={{ r: 3, fill: '#7FA888' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* 症状-阶段相关性 */}
      <Card>
        <CardTitle>{t('chart.correlation')}</CardTitle>
        {correlation.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-fog">{t('chart.correlationEmpty')}</p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={correlation.map((c) => ({ ...c, name: t(`symptoms.${c.symptom}`) }))}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F1FA" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#8B8680' }} stroke="#F5F1FA" />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#2D2A26' }} stroke="#F5F1FA" />
                <Tooltip
                  contentStyle={{ fontSize: 12, backgroundColor: '#FFFFFF', border: '1px solid #F5F1FA', borderRadius: 8 }}
                  formatter={(value: number) => t('chart.correlationDays', { count: value })}
                />
                {PHASE_ORDER.map((p) => (
                  <Bar key={p} dataKey={p} stackId="phase" fill={phaseColors[p]} name={t(`phases.${p}`)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* BBT 曲线（备孕） */}
      <Card>
        <CardTitle>{t('chart.bbtTitle')}</CardTitle>
        {bbt.points.length < 2 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-fog">{t('chart.bbtEmpty')}</p>
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bbt.points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F1FA" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B8680' }} stroke="#F5F1FA" interval="preserveStartEnd" />
                <YAxis domain={['dataMin - 0.2', 'dataMax + 0.2']} tick={{ fontSize: 11, fill: '#8B8680' }} stroke="#F5F1FA" width={32} />
                <Tooltip
                  contentStyle={{ fontSize: 12, backgroundColor: '#FFFFFF', border: '1px solid #F5F1FA', borderRadius: 8 }}
                  labelStyle={{ color: '#2D2A26' }}
                  formatter={(value: number) => [`${value} ${t('log.bbtUnit')}`, t('chart.bbtY')]}
                />
                {bbt.ovulationDate && (
                  <ReferenceLine x={toLabel(bbt.points, bbt.ovulationDate)} stroke="#E8B4A0" strokeDasharray="4 2" label={{ value: t('chart.bbtOvulation'), fontSize: 10, fill: '#A8573F', position: 'top' }} />
                )}
                <Line type="monotone" dataKey="bbt" stroke="#7FA888" strokeWidth={2} dot={{ r: 3, fill: '#7FA888' }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

function toLabel(points: { date: string; label: string }[], date: string): string | undefined {
  return points.find((p) => p.date === date)?.label;
}
