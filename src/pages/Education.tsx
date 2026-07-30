/**
 * src/pages/Education.tsx
 * 健康科普页（v0.5）——本地中立科普，非诊断。
 */
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { Card } from '../shared/ui/Card';

const ARTICLES = [
  { key: 'cycle', emoji: '🌸' },
  { key: 'peri', emoji: '🌿' },
  { key: 'fertility', emoji: '🌡️' },
  { key: 'irregular', emoji: '🔄' },
] as const;

export function Education() {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen size={20} className="text-lavender-500" />
        <h1 className="text-2xl font-semibold">{t('pages.educationTitle')}</h1>
      </div>

      <p className="text-sm text-fog leading-relaxed">{t('education.intro')}</p>

      <div className="space-y-3">
        {ARTICLES.map(({ key, emoji }) => (
          <Card key={key}>
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-ink">
                  {t(`education.${key}Title`)}
                </h2>
                <p className="text-sm text-fog mt-1.5 leading-relaxed">
                  {t(`education.${key}Body`)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card variant="flat" className="text-xs text-fog leading-relaxed space-y-2">
        <p>{t('education.disclaimer')}</p>
        <p className="text-lavender-500">{t('education.reference')}</p>
      </Card>
    </div>
  );
}
