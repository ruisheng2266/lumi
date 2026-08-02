/**
 * src/shared/notifications.ts
 * 本地周期提醒（隐私优先，best-effort）。
 *
 * 重要限制：Web/PWA 无法像原生 App 那样在后台精确排程本地通知。
 * 这里采用「应用打开时」检查——若经期临近且已授予通知权限，立即弹出一条
 * Notification（仅在页面/标签页处于活动状态时有效）。这是零服务器、零 PII 的
 * 召回手段；更可靠的定时推送需 Push API + 后端，留作后续可选增强。
 */

import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import type { CyclePrediction } from './lib/predict';

/** 经期开始前多少天开始提醒 */
const REMIND_BEFORE_DAYS = 2;

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    return differenceInDays(parseISO(dateStr), startOfDay(new Date()));
  } catch {
    return null;
  }
}

/**
 * 若经期在 [0, REMIND_BEFORE_DAYS] 天内且已授权，弹出一条本地通知。
 * 无预测 / 未授权 / 不支持时静默返回。
 */
export function maybeNotifyUpcomingPeriod(prediction: CyclePrediction | null): void {
  if (!notificationsSupported()) return;
  if (Notification.permission !== 'granted') return;
  if (!prediction?.nextPeriodStart) return;

  const d = daysUntil(prediction.nextPeriodStart);
  if (d === null) return;
  if (d < 0 || d > REMIND_BEFORE_DAYS) return;

  const title = d === 0 ? '经期可能今天开始' : `经期预计 ${d} 天后到来`;
  const body = '记得留意身体信号，打开 Lumi 记录一下吧。';
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png' });
  } catch {
    /* 某些环境下构造 Notification 可能抛错，忽略 */
  }
}
