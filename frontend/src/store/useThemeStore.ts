import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeColor, ThemeMode } from '../types/auth.types';

interface ThemeState {
  themeMode: ThemeMode;
  themeColor: ThemeColor;
  sidebarCollapsed: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeColor: (color: ThemeColor) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  applyThemeToDom: () => void;
}

export function syncDomTheme(mode: ThemeMode, color: ThemeColor) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolvedDark = mode === 'dark' || (mode === 'system' && prefersDark);

  root.classList.remove('light', 'dark');
  root.classList.add(resolvedDark ? 'dark' : 'light');
  root.setAttribute('data-theme-color', color);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'light',
      themeColor: 'indigo',
      sidebarCollapsed: false,

      setThemeMode: (mode) => {
        set({ themeMode: mode });
        syncDomTheme(mode, get().themeColor);
      },

      setThemeColor: (color) => {
        set({ themeColor: color });
        syncDomTheme(get().themeMode, color);
      },

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      toggleSidebarCollapsed: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      applyThemeToDom: () => {
        const { themeMode, themeColor } = get();
        syncDomTheme(themeMode, themeColor);
      },
    }),
    {
      name: 'ksmfg-theme-preferences',
    },
  ),
);
