/**
 * src/shared/i18n/useLanguage.ts
 * 语言切换 hook
 */
import { useCallback } from 'react';
import i18next from './index';
import { settingsRepo } from '../db/client';
import { SUPPORTED_LOCALES, LOCALE_META, type SupportedLocale } from './config';

export function useLanguage() {
  const locale = (i18next.language || 'zh-CN') as SupportedLocale;

  const setLocale = useCallback(async (next: SupportedLocale) => {
    await i18next.changeLanguage(next);
    await settingsRepo.set('language', next);
  }, []);

  return {
    locale,
    setLocale,
    available: SUPPORTED_LOCALES.map((code) => ({
      code,
      ...LOCALE_META[code],
    })),
  };
}