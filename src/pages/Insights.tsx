import { useTranslation } from 'react-i18next';

export function Insights() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('pages.insightsTitle')}</h1>
      <div className="card text-fog text-sm">本地 AI 洞察引擎（V1.1 实现）</div>
    </div>
  );
}