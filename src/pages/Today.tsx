import { useTranslation } from 'react-i18next';

export function Today() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('pages.todayTitle')}</h1>
      <p className="text-fog">当前阶段、距下次月经天数、今日提醒……</p>
      <div className="card">
        <p className="text-sm text-fog">占位：算法验证已通过（见 validation/README.md）</p>
      </div>
    </div>
  );
}