import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { periodRepo, userProfileRepo } from '../shared/db/client';
import { Card } from '../shared/ui/Card';
import { MonthCalendar } from '../features/MonthCalendar';

export function Calendar() {
  const { t } = useTranslation();
  const periods = useLiveQuery(() => periodRepo.list(), []);
  const profile = useLiveQuery(() => userProfileRepo.get(), []);

  if (!periods) {
    return <div className="text-fog text-center py-12">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t('pages.calendarTitle')}</h1>

      <Card>
        <MonthCalendar
          periods={periods}
          userAvgCycle={profile?.avgCycleLen}
          userAvgPeriod={profile?.avgPeriodLen}
        />
      </Card>

      <Card variant="flat" className="text-sm text-fog">
        <p className="text-xs">
          💡 预测基于你最近 6 个周期的平均值；点击日期查看该日的日记（如有）。
        </p>
      </Card>
    </div>
  );
}