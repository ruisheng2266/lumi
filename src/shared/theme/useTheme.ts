/**
 * src/shared/theme/useTheme.ts
 * 主题切换 hook（light / dark / system）
 */
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { settingsRepo } from '../db/client';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  const theme = useLiveQuery(
    async () => (await settingsRepo.get<Theme>(STORAGE_KEY)) ?? 'light',
    [],
  ) as Theme | undefined;

  const resolved = theme ? resolveTheme(theme) : 'light';

  // 监听系统主题变化（当 user 选 'system' 时）
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(getSystemTheme());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // 应用主题
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  async function setTheme(next: Theme) {
    await settingsRepo.set(STORAGE_KEY, next);
  }

  async function toggleTheme() {
    // light ↔ dark 切换（system 视为 light）
    const next = resolved === 'dark' ? 'light' : 'dark';
    await setTheme(next);
  }

  return {
    theme: theme ?? 'light',
    resolved,
    setTheme,
    toggleTheme,
  };
}