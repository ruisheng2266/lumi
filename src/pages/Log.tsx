import { useTranslation } from 'react-i18next';

export function Log() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('pages.logTitle')}</h1>
      <div className="card text-fog text-sm">今日情绪 / 精力 / 症状记录（V1.1 实现）</div>
    </div>
  );
}