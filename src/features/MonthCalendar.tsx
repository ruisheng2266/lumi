/**
 * src/features/MonthCalendar.tsx
 * 月历组件 —— 显示周期状态
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
  differenceInDays,
  addMonths,
  subMonths,

} from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import i18next from '../shared/i18n';
import { cn } from '../shared/lib/cn';
import { IconButton } from '../shared/ui/IconButton';
import { predictCycle, phaseOf, type Phase, type PeriodRecord } from '../shared/lib/predict';
import type { LifeEvent, LifeEventType } from '../shared/db/client';

const localeMap = { 'zh-CN': zhCN, en: enUS } as const;

interface MonthCalendarProps {
  periods: PeriodRecord[];
  userAvgCycle?: number;
  userAvgPeriod?: number;
  lifeEvents?: LifeEvent[];
  onDayClick?: (date: Date) => void;
}

const PHASE_STYLE: Record<Phase, { bg: string; text: string; emoji: string }> = {
  menstrual: { bg: 'bg-coral-100', text: 'text-coral-500', emoji: '🩸' },
  follicular: { bg: 'bg-lavender-50', text: 'text-lavender-500', emoji: '🌱' },
  ovulation: { bg: 'bg-coral-50', text: 'text-coral-500', emoji: '✨' },
  luteal: { bg: 'bg-lavender-50', text: 'text-lavender-600', emoji: '🌙' },
};

const EVENT_GLYPH: Record<LifeEventType, string> = {
  pregnancy: '🤰',
  miscarriage: '💔',
  birth: '🍼',
  hysterectomy: '🩺',
  menopause: '🌿',
  birthControlStart: '💊',
  birthControlStop: '➖',
};

export function MonthCalendar({ periods, userAvgCycle, userAvgPeriod, lifeEvents, onDayClick }: MonthCalendarProps) {
  const { t } = useTranslation();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(startOfMonth(today));
  const lng = (i18next.language || 'zh-CN') as keyof typeof localeMap;
  const locale = localeMap[lng] ?? zhCN;

  // 生成网格日期（包含前后月份填充）
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // 计算预测（含特殊生理状态抑制，v0.4）
  const prediction = predictCycle(periods, today, userAvgCycle, userAvgPeriod, lifeEvents);

  // 特殊生理事件按日期归并（v0.4）
  const lifeEventByDay = new Map<string, LifeEventType[]>();
  for (const ev of lifeEvents ?? []) {
    const arr = lifeEventByDay.get(ev.date) ?? [];
    arr.push(ev.type);
    lifeEventByDay.set(ev.date, arr);
  }

  // 计算周期阶段
  const phaseByDay = new Map<string, Phase>();
  if (prediction.currentDayInCycle !== null && prediction.cycleCount > 0) {
    // 当前周期
    const sortedPeriods = [...periods].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    const latest = sortedPeriods[sortedPeriods.length - 1];
    const latestStart = parseISO(latest.startDate);
    const avg = prediction.avgCycleLen;

    for (const day of days) {
      const dayInCycle = differenceInDays(day, latestStart) + 1;
      if (dayInCycle >= 1 && dayInCycle <= avg) {
        phaseByDay.set(format(day, 'yyyy-MM-dd'), phaseOf(dayInCycle, avg));
      }
    }
  }

  // 计算经期实际日期
  const periodDays = new Set<string>();
  for (const p of periods) {
    const start = parseISO(p.startDate);
    const end = p.endDate ? parseISO(p.endDate) : start;
    let cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
      periodDays.add(format(cur, 'yyyy-MM-dd'));
      cur.setDate(cur.getDate() + 1);
    }
  }

  // 计算易孕期
  const fertileDays = new Set<string>();
  if (prediction.fertileWindowStart && prediction.fertileWindowEnd) {
    const start = parseISO(prediction.fertileWindowStart);
    const end = parseISO(prediction.fertileWindowEnd);
    let cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
      fertileDays.add(format(cur, 'yyyy-MM-dd'));
      cur.setDate(cur.getDate() + 1);
    }
  }

  // 排卵日独立标记（审计 #6）
  const ovulationDays = new Set<string>();
  if (prediction.ovulationDay) ovulationDays.add(prediction.ovulationDay);

  // 预测下次经期范围（审计 #7）
  const predictedPeriodDays = new Set<string>();
  if (prediction.nextPeriodStart && prediction.nextPeriodEnd) {
    const start = parseISO(prediction.nextPeriodStart);
    const end = parseISO(prediction.nextPeriodEnd);
    let cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
      predictedPeriodDays.add(format(cur, 'yyyy-MM-dd'));
      cur.setDate(cur.getDate() + 1);
    }
  }

  const weekDayLabels = t('calendar.weekdaysShort', { returnObjects: true }) as string[];

  return (
    <div className="space-y-3">
      {/* 月份导航 */}
      <div className="flex items-center justify-between">
        <IconButton
          icon={<ChevronLeft size={18} />}
          label="Previous month"
          size="sm"
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
        />
        <h2 className="text-base font-semibold tabular-nums">
          {format(viewMonth, 'MMMM yyyy', { locale })}
        </h2>
        <IconButton
          icon={<ChevronRight size={18} />}
          label="Next month"
          size="sm"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
        />
      </div>

      {/* 周标签 */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-fog">
        {weekDayLabels.map((label, i) => (
          <div key={i} className="py-2">{label}</div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, viewMonth);
          const isToday = isSameDay(day, today);
          const isPeriod = periodDays.has(iso);
          const isFertile = fertileDays.has(iso);
          const isOvulation = ovulationDays.has(iso);
          const isPredictedPeriod = predictedPeriodDays.has(iso);
          const phase = phaseByDay.get(iso);
          const evs = lifeEventByDay.get(iso) ?? [];

          let bg = 'bg-cream';
          let text = inMonth ? 'text-ink' : 'text-fog/50';
          let decoration = '';
          let marker: string | null = null;

          if (isPeriod) {
            bg = 'bg-coral-300';
            text = 'text-white';
          } else if (isPredictedPeriod) {
            bg = 'bg-coral-100 ring-1 ring-coral-300';
            text = 'text-coral-700';
            marker = '≈';
          } else if (isOvulation) {
            bg = 'bg-coral-100 ring-1 ring-coral-300';
            marker = '✸';
          } else if (isFertile) {
            bg = 'bg-coral-50 ring-1 ring-coral-200';
          } else if (phase && inMonth) {
            const style = PHASE_STYLE[phase];
            bg = style.bg;
            text = style.text;
          }

          if (isToday) {
            decoration = 'ring-2 ring-lavender-400 ring-offset-1';
          }

          const ariaParts = [iso];
          if (isPeriod) ariaParts.push(t('calendar.legendPeriod'));
          if (isPredictedPeriod) ariaParts.push(t('calendar.legendPredicted'));
          if (isOvulation) ariaParts.push(t('calendar.legendOvulation'));
          if (isFertile) ariaParts.push(t('calendar.legendFertile'));
          if (evs.length) {
            ariaParts.push(evs.map((e) => t(`lifeEvent.type_${e}`)).join('、'));
          }
          if (isToday) ariaParts.push(t('calendar.legendToday'));

          return (
            <button
              key={iso}
              onClick={() => onDayClick?.(day)}
              className={cn(
                'aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition tabular-nums',
                bg,
                text,
                decoration,
                'hover:opacity-80',
              )}
              aria-label={ariaParts.join(' ')}
            >
              <span className={cn('font-medium', isToday && 'text-lavender-600')}>
                {format(day, 'd')}
              </span>
              {isPeriod && <span className="text-[10px] leading-none">●</span>}
              {marker && !isPeriod && (
                <span className="text-[10px] leading-none text-coral-500">{marker}</span>
              )}
              {evs.length > 0 && !isPeriod && (
                <span className="text-[10px] leading-none" aria-hidden="true">
                  {EVENT_GLYPH[evs[0]]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-fog pt-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-coral-300"></span>
          {t('calendar.legendPeriod')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-coral-50 ring-1 ring-coral-200"></span>
          {t('calendar.legendFertile')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-coral-100 ring-1 ring-coral-300 text-center text-[9px] leading-3 text-coral-500">✸</span>
          {t('calendar.legendOvulation')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-coral-100 ring-1 ring-coral-300 text-center text-[9px] leading-3 text-coral-500">≈</span>
          {t('calendar.legendPredicted')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded ring-2 ring-lavender-400"></span>
          {t('calendar.legendToday')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-lavender-100 ring-1 ring-lavender-300 text-center text-[9px] leading-3">
            ★
          </span>
          {t('lifeEvent.title')}
        </div>
      </div>
    </div>
  );
}