/**
 * src/shared/i18n/config.ts
 * i18n 配置：语言列表、文案
 */
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
      yes: '是的',
      no: '不是',
      loading: '加载中…',
      empty: '还没有记录哦',
      error: '出错了，请稍后再试',
      loggedDays: '已记录 {count} 天',
    },
    nav: {
      today: '今日',
      calendar: '日历',
      log: '日记',
      insights: '洞察',
      settings: '设置',
    },
    pages: {
      todayTitle: '今日',
      calendarTitle: '日历',
      logTitle: '健康日记',
      insightsTitle: 'AI 洞察',
      settingsTitle: '设置',
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
      yes: 'Yes',
      no: 'No',
      loading: 'Loading…',
      empty: 'No records yet',
      error: 'Something went wrong, please try again',
      loggedDays_one: '{count} day logged',
      loggedDays_other: '{count} days logged',
    },
    nav: {
      today: 'Today',
      calendar: 'Calendar',
      log: 'Log',
      insights: 'Insights',
      settings: 'Settings',
    },
    pages: {
      todayTitle: 'Today',
      calendarTitle: 'Calendar',
      logTitle: 'Health Log',
      insightsTitle: 'AI Insights',
      settingsTitle: 'Settings',
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