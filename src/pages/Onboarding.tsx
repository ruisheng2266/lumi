import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Sheet } from '../shared/ui/Sheet';
import { useLanguage } from '../shared/i18n/useLanguage';
import { userProfileRepo, settingsRepo, periodRepo } from '../shared/db/client';
import { today } from '../shared/lib/date';
import { toISODate } from '../shared/lib/date';

type Step = 1 | 2 | 3;

export function Onboarding() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { locale, setLocale, available } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState('');
  const [lastPeriodDate, setLastPeriodDate] = useState(toISODate(today()));
  const [avgCycleLen, setAvgCycleLen] = useState(28);
  const [avgPeriodLen, setAvgPeriodLen] = useState(5);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleNext = () => {
    if (step < 3) setStep((step + 1) as Step);
    else finish();
  };
  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  async function finish() {
    // 写用户档案
    await userProfileRepo.upsert({
      displayName: displayName.trim() || undefined,
      avgCycleLen,
      avgPeriodLen,
    });

    // 写首次月经记录
    await periodRepo.add({
      startDate: lastPeriodDate,
      endDate: undefined, // 用户没填结束日
    });

    // 标记 onboarding 完成
    await settingsRepo.set('onboarded', true);
    await settingsRepo.set('language', locale);

    navigate('/today', { replace: true });
  }

  return (
    <div className="min-h-full flex flex-col px-4 py-6 max-w-md mx-auto w-full">
      {/* Progress bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition ${
              s <= step ? 'bg-lavender-300' : 'bg-lavender-50'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 space-y-6">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-lavender-300 to-coral-300 mb-3">
                <Heart size={24} className="text-white" fill="white" strokeWidth={0} />
              </div>
              <h1 className="text-2xl font-semibold">{t('onboarding.welcomeTitle')}</h1>
              <p className="text-fog mt-2 text-sm">{t('onboarding.welcomeDesc')}</p>
            </div>

            <Card>
              <h2 className="text-sm font-medium text-fog mb-3">
                {t('onboarding.language')}
              </h2>
              <div className="space-y-2">
                {available.map((loc) => (
                  <button
                    key={loc.code}
                    onClick={() => setLocale(loc.code)}
                    className={`w-full text-left rounded-lg px-4 py-3 transition ${
                      locale === loc.code
                        ? 'bg-lavender-100 ring-2 ring-lavender-300'
                        : 'hover:bg-lavender-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{loc.flag}</span>
                      <div>
                        <div className="font-medium">{loc.nativeName}</div>
                        <div className="text-xs text-fog">{loc.englishName}</div>
                      </div>
                      {locale === loc.code && (
                        <span className="ml-auto text-lavender-500">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-fog mb-3">
                {t('onboarding.nickname')}
              </h2>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('onboarding.nicknamePlaceholder')}
                maxLength={30}
                className="w-full rounded-lg border border-lavender-100 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300"
              />
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-semibold">{t('onboarding.lastPeriodTitle')}</h1>
              <p className="text-fog mt-2 text-sm">{t('onboarding.lastPeriodDesc')}</p>
            </div>

            <Card variant="flat">
              <div className="text-center py-4">
                <p className="text-xs text-fog mb-1">{t('onboarding.lastPeriodDate')}</p>
                <button
                  onClick={() => setShowDatePicker(true)}
                  className="text-3xl font-semibold tabular-nums text-lavender-500 hover:text-lavender-600 transition"
                >
                  {lastPeriodDate}
                </button>
              </div>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-semibold">{t('onboarding.cycleTitle')}</h1>
              <p className="text-fog mt-2 text-sm">{t('onboarding.cycleDesc')}</p>
            </div>

            <Card>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-fog">{t('onboarding.avgCycle')}</span>
                  <span className="text-2xl font-semibold tabular-nums text-lavender-500">
                    {avgCycleLen} <span className="text-base text-fog">{t('common.days')}</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={21}
                  max={45}
                  value={avgCycleLen}
                  onChange={(e) => setAvgCycleLen(Number(e.target.value))}
                  className="w-full accent-lavender-400"
                />
                <div className="flex justify-between text-xs text-fog">
                  <span>21</span>
                  <span>45</span>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-fog">{t('onboarding.avgPeriod')}</span>
                  <span className="text-2xl font-semibold tabular-nums text-coral-500">
                    {avgPeriodLen} <span className="text-base text-fog">{t('common.days')}</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={avgPeriodLen}
                  onChange={(e) => setAvgPeriodLen(Number(e.target.value))}
                  className="w-full accent-coral-400"
                />
                <div className="flex justify-between text-xs text-fog">
                  <span>2</span>
                  <span>10</span>
                </div>
              </div>
            </Card>

            <p className="text-xs text-fog text-center">
              {t('onboarding.canAdjustLater')}
            </p>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-6">
        {step > 1 && (
          <Button variant="ghost" leftIcon={<ChevronLeft size={18} />} onClick={handleBack}>
            {t('common.back')}
          </Button>
        )}
        <Button fullWidth rightIcon={<ChevronRight size={18} />} onClick={handleNext}>
          {step === 3 ? t('onboarding.finish') : t('common.next')}
        </Button>
      </div>

      {/* Date picker (Sheet) */}
      <Sheet open={showDatePicker} onClose={() => setShowDatePicker(false)} title={t('onboarding.lastPeriodDate')}>
        <DateQuickPicker
          value={lastPeriodDate}
          onChange={(date) => {
            setLastPeriodDate(date);
            setShowDatePicker(false);
          }}
        />
      </Sheet>
    </div>
  );
}

/**
 * 简化版日期选择器：最近 30 天快捷选择
 */
function DateQuickPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const today_ = today();
  const options = [0, 1, 2, 3, 5, 7, 14, 21, 28].map((daysAgo) => {
    const date = new Date(today_);
    date.setDate(date.getDate() - daysAgo);
    return { daysAgo, date: toISODate(date) };
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-fog">{t('onboarding.pickRecent')}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ daysAgo, date }) => (
          <button
            key={daysAgo}
            onClick={() => onChange(date)}
            className={`rounded-lg px-3 py-3 text-sm transition ${
              value === date
                ? 'bg-lavender-300 text-white'
                : 'bg-lavender-50 hover:bg-lavender-100'
            }`}
          >
            {daysAgo === 0 ? t('common.today') : `-${daysAgo}d`}
          </button>
        ))}
      </div>
    </div>
  );
}