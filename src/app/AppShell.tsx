import { Outlet, NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { Calendar, Home, BookHeart, Sparkles, Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../shared/lib/cn';

const navItems = [
  { to: '/today', icon: Home, key: 'today' },
  { to: '/calendar', icon: Calendar, key: 'calendar' },
  { to: '/log', icon: BookHeart, key: 'log' },
  { to: '/insights', icon: Sparkles, key: 'insights' },
  { to: '/settings', icon: SettingsIcon, key: 'settings' },
] as const;

export function AppShell() {
  const { t, i18n } = useTranslation();

  // a11y：同步 <html lang> 与当前语言，确保屏幕阅读器正确朗读（v0.4）
  useEffect(() => {
    document.documentElement.lang = i18n.language || 'zh-CN';
  }, [i18n.language]);

  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 px-4 py-6 pb-24 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>

      <nav
        aria-label={t('nav.a11yLabel')}
        className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t border-lavender-50 pb-safe"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {navItems.map(({ to, icon: Icon, key }) => (
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
        </div>
      </nav>
    </div>
  );
}