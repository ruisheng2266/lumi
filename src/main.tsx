import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './shared/i18n';
import { initAnalytics, setAnalyticsEnabled, track } from './shared/analytics';
import { settingsRepo, periodRepo, lifeEventRepo } from './shared/db/client';
import { predictCycle } from './shared/lib/predict';
import { maybeNotifyUpcomingPeriod } from './shared/notifications';

// PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
import './styles/globals.css';

// 启动初始化：匿名统计 + 周期提醒（隐私优先，best-effort，失败不影响应用）
(async () => {
  try {
    const analyticsOn = (await settingsRepo.get<boolean>('analytics_enabled')) !== false;
    setAnalyticsEnabled(analyticsOn);
    initAnalytics();
    if (analyticsOn) track('app_open');

    const notifOn = (await settingsRepo.get<boolean>('notifications_enabled')) === true;
    if (notifOn) {
      const periods = await periodRepo.list();
      const lifeEvents = await lifeEventRepo.list();
      const prediction = predictCycle(periods, new Date(), undefined, undefined, lifeEvents);
      maybeNotifyUpcomingPeriod(prediction);
    }
  } catch {
    /* 启动初始化失败不应阻断应用 */
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);