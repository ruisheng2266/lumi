/**
 * src/shared/lib/date.ts
 * 日期工具（基于 date-fns，locale-aware）
 */
import {
  format as dfFormat,
  parseISO,
  startOfDay,
  differenceInDays,
  addDays,
  isSameDay,
  formatDistanceToNow,
} from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import i18next from '../i18n';

const localeMap = { 'zh-CN': zhCN, en: enUS } as const;

function getLocale() {
  const lng = i18next.language || 'zh-CN';
  return localeMap[lng as keyof typeof localeMap] ?? zhCN;
}

export function today() {
  return startOfDay(new Date());
}

export function toISODate(d: Date): string {
  return dfFormat(d, 'yyyy-MM-dd');
}

export function fromISO(s: string): Date {
  return parseISO(s);
}

export function fmt(d: Date | string, pattern: string = 'PPP'): string {
  const date = typeof d === 'string' ? parseISO(d) : d;
  return dfFormat(date, pattern, { locale: getLocale() });
}

export function fmtShort(d: Date | string): string {
  return fmt(d, i18next.language === 'en' ? 'MMM d' : 'M月d日');
}

export function daysBetween(a: Date, b: Date): number {
  return differenceInDays(b, a);
}

export function plusDays(d: Date, n: number): Date {
  return addDays(d, n);
}

export function sameDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

export function relativeTime(d: Date | string): string {
  const date = typeof d === 'string' ? parseISO(d) : d;
  return formatDistanceToNow(date, { addSuffix: true, locale: getLocale() });
}