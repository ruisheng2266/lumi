import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Home,
  BookHeart,
  Sparkles,
  Settings as SettingsIcon,
  GraduationCap,
  MoreHorizontal,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../shared/lib/cn';

// 主区域：高频使用的 4 项，直接平铺，移动端更宽松（v0.6 导航优化）
const primaryItems = [
  { to: '/today', icon: Home, key: 'today' },
  { to: '/calendar', icon: Calendar, key: 'calendar' },
  { to: '/log', icon: BookHeart, key: 'log' },
  { to: '/insights', icon: Sparkles, key: 'insights' },
] as const;

// 次级区域：低频入口收进「更多」弹出层，避免 6 项平铺拥挤
const secondaryItems = [
  { to: '/education', icon: GraduationCap, key: 'education' },
  { to: '/settings', icon: SettingsIcon, key: 'settings' },
] as const;

export function AppShell() {
  const { t, i18n } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const moreRef = useRef<HTMLDivElement>(null);

  // a11y：同步 <html lang> 与当前语言，确保屏幕阅读器正确朗读（v0.4）
  useEffect(() => {
    document.documentElement.lang = i18n.language || 'zh-CN';
  }, [i18n.language]);

  // 路由变化时关闭「更多」弹出层
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  // 点击外部 / 按 Esc 关闭弹出层（a11y）
  useEffect(() => {
    if (!moreOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const inSecondary = secondaryItems.some((i) => location.pathname.startsWith(i.to));

  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 px-4 py-6 pb-24 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>

      <nav
        aria-label={t('nav.a11yLabel')}
        className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur border-t border-lavender-50 pb-safe"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-5 relative">
          {primaryItems.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-3 text-xs transition',
                  isActive ? 'text-lavender-500' : 'text-fog hover:text-ink',
                )
              }
            >
              <Icon size={20} strokeWidth={1.75} />
              <span>{t(`nav.${key}`)}</span>
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={moreOpen}
            aria-label={t('nav.more')}
            className={cn(
              'flex flex-col items-center gap-1 py-3 text-xs transition',
              moreOpen || inSecondary ? 'text-lavender-500' : 'text-fog hover:text-ink',
            )}
          >
            <MoreHorizontal size={20} strokeWidth={1.75} />
            <span>{t('nav.more')}</span>
          </button>

          {/* 「更多」弹出层：次级入口 */}
          {moreOpen && (
            <div
              ref={moreRef}
              role="menu"
              aria-label={t('nav.more')}
              className="absolute bottom-full right-0 z-50 mb-2 w-44 rounded-2xl bg-surface shadow-lg border border-lavender-50 p-1.5"
            >
              {secondaryItems.map(({ to, icon: Icon, key }) => (
                <button
                  key={to}
                  type="button"
                  role="menuitem"
                  onClick={() => navigate(to)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition',
                    location.pathname.startsWith(to)
                      ? 'bg-lavender-50 text-lavender-500'
                      : 'text-ink hover:bg-lavender-50/60',
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{t(`nav.${key}`)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
