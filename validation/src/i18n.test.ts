/**
 * src/i18n.test.ts
 * i18next 配置验证（PRD §6.5.9）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import i18next from 'i18next';
import {
  initI18n,
  SUPPORTED_LOCALES,
  LOCALE_META,
  resources,
  type SupportedLocale,
} from './i18n';

describe('i18n setup', () => {
  beforeAll(async () => {
    await initI18n('zh-CN');
  });

  it('initializes with zh-CN by default', () => {
    expect(i18next.language).toBe('zh-CN');
  });

  it('has all supported locales as resources', () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(resources[loc]).toBeDefined();
      expect(resources[loc].common).toBeDefined();
      expect(resources[loc].phases).toBeDefined();
      expect(resources[loc].insight).toBeDefined();
    }
  });

  it('translates UI strings (zh-CN)', () => {
    // 当 defaultNS='common' 时可直接用 key
    expect(i18next.t('save')).toBe('保存');
    expect(i18next.t('today')).toBe('今日');
    expect(i18next.t('menstrual', { ns: 'phases' })).toBe('经期');
    expect(i18next.t('ovulation', { ns: 'phases' })).toBe('排卵期');
  });

  it('interpolates with parameters (zh-CN has no plural)', () => {
    expect(i18next.t('loggedDays', { count: 1 })).toBe('已记录 1 天');
    expect(i18next.t('loggedDays', { count: 5 })).toBe('已记录 5 天');
    expect(i18next.t('loggedDays', { count: 100 })).toBe('已记录 100 天');
  });
});

describe('i18n language switching', () => {
  beforeAll(async () => {
    await initI18n('zh-CN');
  });

  it('switches to English without reload', async () => {
    expect(i18next.t('save')).toBe('保存');
    await i18next.changeLanguage('en');
    expect(i18next.language).toBe('en');
    expect(i18next.t('save')).toBe('Save');
    expect(i18next.t('today')).toBe('Today');
    expect(i18next.t('menstrual', { ns: 'phases' })).toBe('Menstrual');
    expect(i18next.t('ovulation', { ns: 'phases' })).toBe('Ovulation');
  });

  it('handles English plural forms correctly', async () => {
    expect(i18next.t('loggedDays', { count: 1 })).toBe('1 day logged');
    expect(i18next.t('loggedDays', { count: 5 })).toBe('5 days logged');
    expect(i18next.t('loggedDays', { count: 0 })).toBe('0 days logged');
  });

  it('switches back to zh-CN', async () => {
    await i18next.changeLanguage('zh-CN');
    expect(i18next.t('save')).toBe('保存');
  });
});

describe('i18n locale meta', () => {
  it('has all required metadata', () => {
    for (const loc of SUPPORTED_LOCALES) {
      const meta = LOCALE_META[loc];
      expect(meta.nativeName).toBeTruthy();
      expect(meta.englishName).toBeTruthy();
      expect(meta.flag).toBeTruthy();
    }
  });

  it('flags are valid emoji', () => {
    for (const loc of SUPPORTED_LOCALES) {
      const meta = LOCALE_META[loc];
      expect(meta.flag.length).toBeGreaterThan(0);
    }
  });
});