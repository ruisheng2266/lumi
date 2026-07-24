/**
 * src/i18n.ts
 * i18next 配置（PRD §6.5）
 */
import i18next from 'i18next';

export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_META: Record<
  SupportedLocale,
  { nativeName: string; englishName: string; flag: string }
> = {
  'zh-CN': { nativeName: '简体中文', englishName: 'Simplified Chinese', flag: '🇨🇳' },
  en: { nativeName: 'English', englishName: 'English', flag: '🇺🇸' },
};

export const resources = {
  'zh-CN': {
    common: {
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      confirm: '确认',
      today: '今日',
      calendar: '日历',
      log: '日记',
      insights: '洞察',
      settings: '设置',
      loggedDays: '已记录 {count} 天',
    },
    phases: {
      menstrual: '经期',
      follicular: '卵泡期',
      ovulation: '排卵期',
      luteal: '黄体期',
    },
    insight: {
      regularity_good: '近 6 个月你的周期规律性良好 ✨',
      regularity_ok: '近 6 个月你的周期波动在可接受范围内',
      regularity_irregular: '近期周期波动较大，建议留意',
      data_needed: '再多记录 1~2 次月经，预测会更准哦',
    },
  },
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      confirm: 'Confirm',
      today: 'Today',
      calendar: 'Calendar',
      log: 'Log',
      insights: 'Insights',
      settings: 'Settings',
      loggedDays_one: '{count} day logged',
      loggedDays_other: '{count} days logged',
    },
    phases: {
      menstrual: 'Menstrual',
      follicular: 'Follicular',
      ovulation: 'Ovulation',
      luteal: 'Luteal',
    },
    insight: {
      regularity_good: 'Your cycle has been regular over the last 6 months ✨',
      regularity_ok: 'Your cycle varies within an acceptable range',
      regularity_irregular: 'Recent cycles have varied noticeably',
      data_needed: 'Log 1-2 more periods for more accurate predictions',
    },
  },
} as const;

export async function initI18n(locale: SupportedLocale = 'zh-CN') {
  await i18next.init({
    lng: locale,
    fallbackLng: 'zh-CN',
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: ['common', 'phases', 'insight'],
    defaultNS: 'common',
    resources,
    interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
    returnEmptyString: false,
  });
  return i18next;
}