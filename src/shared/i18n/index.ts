/**
 * src/shared/i18n/index.ts
 * i18next 配置（PRD §6.5）
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SUPPORTED_LOCALES, LOCALE_META, resources, type SupportedLocale } from './config';

export { SUPPORTED_LOCALES, LOCALE_META };
export type { SupportedLocale };

/**
 * 浏览器语言检测
 */
export function detectLocale(): SupportedLocale {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'zh-CN';
  if (nav.toLowerCase().startsWith('zh')) return 'zh-CN';
  if (SUPPORTED_LOCALES.includes(nav as SupportedLocale)) {
    return nav as SupportedLocale;
  }
  return 'zh-CN';
}

let initialized = false;

export async function initI18n(locale?: SupportedLocale) {
  if (initialized) return i18next;
  initialized = true;

  await i18next
    .use(initReactI18next)
    .init({
      lng: locale ?? detectLocale(),
      fallbackLng: 'zh-CN',
      supportedLngs: [...SUPPORTED_LOCALES],
      ns: ['common', 'pages', 'phases', 'insight'],
      defaultNS: 'common',
      resources,
      interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
      returnEmptyString: false,
    });

  return i18next;
}

// 立即初始化（同步）
initI18n().catch(console.error);

export default i18next;