/**
 * src/shared/analytics/index.ts
 * 匿名使用统计（隐私优先）。
 * - 设备级匿名 ID 存于 localStorage（非 PII，与账号体系完全隔离）
 * - 仅上报：事件名 + 时间戳 + 非标识维度（locale / app 版本）
 * - 不上报任何个人信息，也不读取周期/日记内容
 * - 用户可在设置中随时关闭
 * 上报采用 sendBeacon 优先 + 内存队列，失败静默丢弃（best-effort）。
 */

import { APP_VERSION } from '../version';

const ANON_ID_KEY = 'lumi_anon_id';
const FLUSH_THRESHOLD = 10;
const FLUSH_INTERVAL = 30_000;

interface QueuedEvent {
  name: string;
  ts: number;
  props?: Record<string, unknown>;
}

let installId: string | null = null;
let queue: QueuedEvent[] = [];
let enabled = true;
let flushTimer: number | null = null;

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function getInstallId(): string {
  const ls = safeLocalStorage();
  if (!ls) return 'anon';
  try {
    let id = ls.getItem(ANON_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      ls.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

/** 由设置页调用：开/关匿名统计。关闭时立即清空待发队列。 */
export function setAnalyticsEnabled(value: boolean): void {
  enabled = value;
  if (!value) queue = [];
}

/** 在应用启动时调用一次：绑定刷新时机，确保 app_open 等事件能被送达。 */
export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  installId = getInstallId();
  if (flushTimer == null) {
    flushTimer = window.setInterval(flush, FLUSH_INTERVAL);
  }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/** 记录一个匿名事件。非浏览器环境或已关闭时静默忽略。 */
export function track(name: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!enabled) return;
  if (typeof name !== 'string' || name.length === 0) return;
  queue.push({ name, ts: Date.now(), props });
  if (queue.length >= FLUSH_THRESHOLD) flush();
}

/** 把队列里的事件上报到后端。best-effort，失败丢弃。 */
export function flush(): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  if (queue.length === 0) return;

  const events = queue.splice(0, queue.length);
  const payload = {
    install_id: installId || getInstallId(),
    events: events.map((e) => ({ name: e.name, ts: e.ts, props: e.props ?? null })),
    v: APP_VERSION,
    locale: typeof navigator !== 'undefined' ? navigator.language : '',
  };

  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', blob);
      return;
    }
  } catch {
    /* fall through to fetch */
  }

  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    /* best-effort: drop on failure */
  });
}
