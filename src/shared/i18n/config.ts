/**
 * src/shared/i18n/config.ts
 * 语言包按 locale 拆分为独立文件（审计 #10）：src/shared/i18n/locales/{lang}.ts
 * 新增语言只需在 locales/ 下加一个文件并在 SUPPORTED_LOCALES / LOCALE_META 注册。
 */
import { zhCN } from './locales/zh-CN';
import { en } from './locales/en';

export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_META: Record<SupportedLocale, { nativeName: string; englishName: string; flag: string }> = {
  'zh-CN': { nativeName: '简体中文', englishName: 'Simplified Chinese', flag: '🇨🇳' },
  en: { nativeName: 'English', englishName: 'English', flag: '🇺🇸' },
};

export const resources = {
  'zh-CN': { translation: zhCN },
  en: { translation: en },
} as const;
