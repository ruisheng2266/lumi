import { useTranslation } from 'react-i18next';
import { useLanguage } from '../shared/i18n/useLanguage';

export function Settings() {
  const { t } = useTranslation();
  const { locale, setLocale, available } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('pages.settingsTitle')}</h1>

      <section className="card">
        <h2 className="text-sm font-medium text-fog mb-3">语言</h2>
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
      </section>

      <div className="card text-fog text-sm">
        <p>隐私设置、数据导出、清空数据……（V1.1 实现）</p>
      </div>
    </div>
  );
}