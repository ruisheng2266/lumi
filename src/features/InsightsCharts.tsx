/**
 * src/features/InsightsCharts.tsx
 * 趋势图 + 症状频率图（PRD §6.3.3 历史回看）
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { Card, CardTitle } from '../shared/ui/Card';
import { Button } from '../shared/ui/Button';
import type { DailyLog } from '../shared/db/client';
import { parseISO, subDays, startOfDay } from 'date-fns';

const SYMPTOM_KEYS = [
  'cramps', 'headache', 'bloating', 'discharge',
  'breast', 'nausea', 'appetite', 'fever',
  'sleepy', 'insomnia', 'acne', 'constipated', 'diarrhea',
  'hotFlash', 'nightSweat',
] as const;

type Metric = 'mood' | 'energy' | 'sleep';
type RangeKey = '7d' | '30d' | '90d' | 'all';

interface InsightsChartsProps {
  logs: DailyLog[];
}

interface Point {
  date: string;       // YYYY-MM-DD
  label: string;      // X 轴短标签 (M/d 或 周)
  mood?: number;
  energy?: number;
  sleepHours?: number;
}

function buildRange(range: RangeKey, today: Date): { from: Date; days: number | null } {
  switch (range) {
    case '7d': return { from: subDays(today, 6), days: 7 };
    case '30d': return { from: subDays(today, 29), days: 30 };
    case '90d': return { from: subDays(today, 89), days: 90 };
    case 'all': return { from: subDays(today, 365 * 3), days: null }; // 上限 3 年
  }
}

function pickLabel(date: Date, range: RangeKey): string {
  if (range === '7d') {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  if (range === '30d') {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  // 90d / all：按周聚合显示周首日
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function InsightsCharts({ logs }: InsightsChartsProps) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<Metric>('mood');
  const [range, setRange] = useState<RangeKey>('30d');

  // 过滤时间范围
  const rangeInfo = useMemo(() => buildRange(range, startOfDay(new Date())), [range]);
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const d = parseISO(l.date);
      return d >= rangeInfo.from;
    });
  }, [logs, rangeInfo.from]);

  // 趋势数据：按日聚合（取该日均值）
  const points = useMemo<Point[]>(() => {
    const map = new Map<string, { mood: number[]; energy: number[]; sleep: number[] }>();
    for (const log of filteredLogs) {
      const bucket = map.get(log.date) ?? { mood: [], energy: [], sleep: [] };
      if (log.mood !== undefined) bucket.mood.push(log.mood);
      if (log.energy !== undefined) bucket.energy.push(log.energy);
      if (log.sleepHours !== undefined) bucket.sleep.push(log.sleepHours);
      map.set(log.date, bucket);
    }
    const result: Point[] = [];
    for (const [date, bucket] of map.entries()) {
      const d = parseISO(date);
      result.push({
        date,
        label: pickLabel(d, range),
        mood: bucket.mood.length ? +(bucket.mood.reduce((s, n) => s + n, 0) / bucket.mood.length).toFixed(1) : undefined,
        energy: bucket.energy.length ? +(bucket.energy.reduce((s, n) => s + n, 0) / bucket.energy.length).toFixed(1) : undefined,
        sleepHours: bucket.sleep.length ? +(bucket.sleep.reduce((s, n) => s + n, 0) / bucket.sleep.length).toFixed(1) : undefined,
      });
    }
    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }, [filteredLogs, range]);

  // 症状频率：每个症状在范围内出现的"天数"（一条日志内出现算一次）
  const symptomCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of filteredLogs) {
      if (!log.symptoms) continue;
      const uniq = new Set(log.symptoms);
      for (const s of uniq) {
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    return SYMPTOM_KEYS
      .map((key) => ({ key, label: t(`symptoms.${key}` as 'symptoms.cramps'), count: counts.get(key) ?? 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredLogs, t]);

  // 数据不足
  if (logs.length < 7) {
    return (
      <Card variant="flat" className="text-center py-8">
        <p className="text-sm text-fog">{t('chart.notEnough')}</p>
      </Card>
    );
  }

  const hasTrendData = points.some(
    (p) => metric === 'mood' ? p.mood !== undefined
      : metric === 'energy' ? p.energy !== undefined
      : p.sleepHours !== undefined,
  );

  // 图表用色（与 design token 对齐）
  const moodColor = '#C8B6E2';   // lavender-300
  const energyColor = '#E8B4A0'; // coral-300
  const sleepColor = '#7FA888';  // success
  const accentColor = metric === 'mood' ? moodColor : metric === 'energy' ? energyColor : sleepColor;

  const yAxisLabel = metric === 'mood'
    ? t('chart.yLabelMood')
    : metric === 'energy'
    ? t('chart.yLabelEnergy')
    : t('chart.yLabelSleep');

  return (
    <div className="space-y-3">
      {/* 趋势图 */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>{t('chart.title')}</CardTitle>
        </div>

        {/* 指标切换 */}
        <div className="flex gap-2 mb-3">
          {(['mood', 'energy', 'sleep'] as Metric[]).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={metric === m ? 'primary' : 'ghost'}
              onClick={() => setMetric(m)}
            >
              {m === 'mood' ? t('chart.metricMood') : m === 'energy' ? t('chart.metricEnergy') : t('chart.metricSleep')}
            </Button>
          ))}
        </div>

        {/* 时间范围 */}
        <div className="flex gap-1.5 mb-4 text-xs">
          {(['7d', '30d', '90d', 'all'] as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-full transition ${
                range === r
                  ? 'bg-lavender-600 text-white'
                  : 'bg-lavender-50 text-fog hover:bg-lavender-100'
              }`}
            >
              {r === '7d' ? t('chart.range7') : r === '30d' ? t('chart.range30') : r === '90d' ? t('chart.range90') : t('chart.rangeAll')}
            </button>
          ))}
        </div>

        {/* 图表 */}
        <div className="h-56 w-full">
          {hasTrendData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F1FA" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#8B8680' }}
                  stroke="#F5F1FA"
                  interval={range === '7d' ? 0 : range === '30d' ? 4 : 8}
                />
                <YAxis
                  domain={metric === 'sleep' ? [0, 12] : [1, 5]}
                  ticks={metric === 'sleep' ? [0, 3, 6, 9, 12] : [1, 2, 3, 4, 5]}
                  tick={{ fontSize: 11, fill: '#8B8680' }}
                  stroke="#F5F1FA"
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #F5F1FA',
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: '#2D2A26' }}
                  formatter={(value: number) => value?.toFixed?.(1) ?? value}
                />
                {metric === 'sleep' && (
                  <ReferenceLine y={7} stroke="#7FA888" strokeDasharray="3 3" label={{ value: yAxisLabel, fontSize: 10, fill: '#8B8680', position: 'right' }} />
                )}
                <Line
                  type="monotone"
                  dataKey={metric === 'mood' ? 'mood' : metric === 'energy' ? 'energy' : 'sleepHours'}
                  stroke={accentColor}
                  strokeWidth={2}
                  dot={{ r: 3, fill: accentColor }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-fog">{t('chart.chartEmpty')}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-fog mt-2 text-center">{yAxisLabel}</p>
      </Card>

      {/* 症状频率图 */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>{t('chart.symptomTitle')}</CardTitle>
        </div>
        {symptomCounts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-fog">{t('chart.symptomEmpty')}</p>
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={symptomCounts} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F1FA" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#8B8680' }} stroke="#F5F1FA" />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fontSize: 11, fill: '#2D2A26' }}
                  stroke="#F5F1FA"
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #F5F1FA',
                    borderRadius: 8,
                  }}
                  formatter={(value: number) => t('chart.symptomCount', { count: value })}
                />
                <Bar dataKey="count" fill="#E8B4A0" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}