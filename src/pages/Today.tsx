import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Droplet, Sparkles, Plus, Pencil } from 'lucide-react';
import { Card, CardTitle } from '../shared/ui/Card';
import { Button } from '../shared/ui/Button';
import { periodRepo, settingsRepo, userProfileRepo, lifeEventRepo, type Period } from '../shared/db/client';
import { predictCycle, cycleRegularity, type CyclePrediction, type PeriodRecord } from '../shared/lib/predict';
import { today, fmtShort, daysBetween } from '../shared/lib/date';
import { useNavigate } from 'react-router-dom';
import { LogSheet } from '../features/LogSheet';
import { PeriodEditSheet } from '../features/PeriodEditSheet';

export function Today() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [logOpen, setLogOpen] = useState(false);
  const [periodEditOpen, setPeriodEditOpen] = useState(false);
  const [periodToEdit, setPeriodToEdit] = useState<Period | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

  // 实时查询周期数据
  const periods = useLiveQuery(() => periodRepo.list(), []);
  const profile = useLiveQuery(() => userProfileRepo.get(), []);
  const lifeEvents = useLiveQuery(() => lifeEventRepo.list(), []);

  useEffect(() => {
    (async () => {
      const o = await settingsRepo.get<boolean>('onboarded');
      if (!o) {
        navigate('/onboarding', { replace: true });
      } else {
        setOnboarded(true);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
  }, [profile]);

  if (onboarded === null || !periods) {
    return <div className="text-fog text-center py-12">{t('common.loading')}</div>;
  }

  // 计算预测
  const prediction: CyclePrediction = predictCycle(
    periods as PeriodRecord[],
    today(),
    profile?.avgCycleLen,
    profile?.avgPeriodLen,
    lifeEvents ?? [],
  );
  const regularity = cycleRegularity(periods as PeriodRecord[]);
  const isIrregular = regularity === 'irregular' && prediction.cycleCount >= 4;

  // 判断问候语
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('today.greetingMorning')
    : hour < 18 ? t('today.greetingAfternoon')
    : t('today.greetingEvening');

  // 距离下次月经
  const daysToNext = prediction.nextPeriodStart
    ? daysBetween(today(), new Date(prediction.nextPeriodStart))
    : null;

  // 是否在经期
  const isOnPeriod = periods.some((p) => {
    const start = new Date(p.startDate);
    const end = p.endDate ? new Date(p.endDate) : null;
    return today() >= start && (!end || today() <= end);
  });

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting}{displayName && <span className="text-fog">, {displayName}</span>}
        </h1>
        <p className="text-sm text-fog mt-1">{fmtShort(today())}</p>
      </div>

      {/* 特殊生理状态横幅（v0.4：孕期/产后/绝经/无周期） */}
      {prediction.specialState && (
        <Card className="bg-lavender-50 border-0">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none" aria-hidden="true">
              {prediction.specialState.type === 'pregnant'
                ? '🤰'
                : prediction.specialState.type === 'postpartum'
                ? '🍼'
                : prediction.specialState.type === 'menopause'
                ? '🌿'
                : '🩺'}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-ink">{t(`lifeEvent.state_${prediction.specialState.type}`)}</p>
              <p className="text-sm text-fog mt-1">{t('lifeEvent.stateDesc')}</p>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="text-xs text-lavender-500 hover:text-lavender-600 mt-2 inline-flex items-center gap-1"
              >
                {t('lifeEvent.manage')} →
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* 当前周期卡片 */}
      {!prediction.specialState && (prediction.currentDayInCycle !== null ? (
        <Card className="bg-gradient-to-br from-lavender-100 via-cream to-coral-100 border-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-fog uppercase tracking-wide">{t('today.phaseLabel')}</p>
              <p className="text-2xl font-semibold text-lavender-600 mt-1">
                {prediction.currentPhase ? t(`phases.${prediction.currentPhase}`) : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-fog">{t('today.cycleDay', { day: prediction.currentDayInCycle })}</p>
              <p className="text-3xl font-bold tabular-nums text-lavender-500 mt-1">
                {prediction.currentDayInCycle}
              </p>
            </div>
          </div>

          {daysToNext !== null && daysToNext >= 0 && (
            <div className="flex items-center gap-2 text-sm text-fog">
              <Droplet size={14} className="text-coral-500" />
              {isIrregular && prediction.rangeStart && prediction.rangeEnd ? (
                t('today.irregularRange', {
                  start: fmtShort(prediction.rangeStart),
                  end: fmtShort(prediction.rangeEnd),
                })
              ) : daysToNext === 0 ? (
                t('today.nextPeriodToday')
              ) : daysToNext === 1 ? (
                t('today.nextPeriodTomorrow')
              ) : (
                t('today.nextPeriodIn', { days: daysToNext })
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card variant="flat" className="text-center py-6">
          <p className="text-fog text-sm">{t('today.notEnoughData')}</p>
        </Card>
      ))}

      {/* 排卵日 + 易孕期 */}
      {!prediction.specialState && prediction.ovulationDay && (
        <Card>
          <CardTitle>{t('today.ovulationIn')}</CardTitle>
          <p className="text-lg font-semibold tabular-nums text-coral-500">
            {fmtShort(prediction.ovulationDay)}
          </p>
          <p className="text-xs text-fog mt-2">
            {t('today.fertileWindow')}: {fmtShort(prediction.fertileWindowStart!)} — {fmtShort(prediction.fertileWindowEnd!)}
          </p>
        </Card>
      )}

      {/* 最近月经历史（最多 3 条） */}
      {periods.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <CardTitle>{t('phases.menstrual')}</CardTitle>
            <button
              type="button"
              onClick={() => setPeriodEditOpen(true)}
              className="text-xs text-lavender-500 hover:text-lavender-600 inline-flex items-center gap-1"
            >
              <Pencil size={12} />
              {t('common.edit')}
            </button>
          </div>
          <ul className="space-y-1">
            {periods.slice(0, 3).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { setPeriodToEdit(p); setPeriodEditOpen(true); }}
                  className="w-full text-left text-sm rounded-md px-3 py-2 hover:bg-lavender-50 transition flex items-center gap-2 tabular-nums"
                >
                  <Droplet size={12} className="text-coral-500 shrink-0" />
                  <span className="text-ink">{p.startDate}</span>
                  {p.endDate && (
                    <span className="text-fog">→ {p.endDate}</span>
                  )}
                  {!p.endDate && (
                    <span className="text-xs text-coral-500 ml-1">●</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 快速操作 */}
      <div className="grid grid-cols-2 gap-3">
        {!isOnPeriod ? (
          <Button
            variant="coral"
            fullWidth
            leftIcon={<Droplet size={18} />}
            onClick={async () => {
              await periodRepo.add({ startDate: today().toISOString().slice(0, 10) });
            }}
          >
            {t('common.startPeriod')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            fullWidth
            leftIcon={<Droplet size={18} />}
            onClick={async () => {
              const last = periods[0];
              if (last?.id) {
                await periodRepo.update(last.id, { endDate: today().toISOString().slice(0, 10) });
              }
            }}
          >
            {t('common.endPeriod')}
          </Button>
        )}
        <Button variant="primary" fullWidth leftIcon={<Plus size={18} />} onClick={() => setLogOpen(true)}>
          {t('today.logToday')}
        </Button>
      </div>

      {/* 不规律诚实预测（v0.4） */}
      {!prediction.specialState && isIrregular && (
        <Card variant="flat" className="border border-coral-200">
          <p className="font-medium text-ink">{t('today.irregularTitle')}</p>
          <p className="text-sm text-fog mt-1 leading-relaxed">
            {t('today.irregularDesc', { count: prediction.cycleCount })}
          </p>
        </Card>
      )}

      {/* 置信度提示（审计 #8：4 档分级文案） */}
      {prediction.confidence !== 'high' && (
        <Card variant="flat" className="flex items-start gap-3">
          <Sparkles size={18} className="text-lavender-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="text-fog">
              {t(`today.${prediction.confidence === 'low' ? 'confidenceLow' : prediction.confidence === 'medium' ? 'confidenceMedium' : 'confidenceNone'}`)}
            </p>
            <p className="text-xs text-fog mt-1">
              {t('common.loggedDays', { count: prediction.cycleCount })}
            </p>
          </div>
        </Card>
      )}

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
      <PeriodEditSheet
        open={periodEditOpen}
        onClose={() => { setPeriodEditOpen(false); setPeriodToEdit(null); }}
        period={periodToEdit ?? undefined}
      />
    </div>
  );
}