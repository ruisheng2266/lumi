import { useTranslation } from 'react-i18next';

export function Calendar() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('pages.calendarTitle')}</h1>
      <div className="card text-fog text-sm">月历视图（V1.1 实现）</div>
    </div>
  );
}