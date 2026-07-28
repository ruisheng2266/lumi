import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { periodRepo, userProfileRepo } from '../shared/db/client';
import { Card } from '../shared/ui/Card';
import { MonthCalendar } from '../features/MonthCalendar';
import { DayDetailSheet } from '../features/DayDetailSheet';

export function Calendar() {
  const { t } = useTranslation();
  const periods = useLiveQuery(() => periodRepo.list(), []);
  const profile = useLiveQuery(() => userProfileRepo.get(), []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
          onDayClick={(date) => setSelectedDate(date)}
        />
      </Card>

      <Card variant="flat" className="text-sm text-fog">
        <p className="text-xs">
          {t('calendar.footnote')}
        </p>
      </Card>

      <DayDetailSheet
        open={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        date={selectedDate}
      />
    </div>
  );
}