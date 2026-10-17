import React, { useEffect } from 'react';
import { useThemeStore, syncDomTheme } from '../../store/useThemeStore';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const themeMode = useThemeStore((s) => s.themeMode);
  const themeColor = useThemeStore((s) => s.themeColor);

  useEffect(() => {
    syncDomTheme(themeMode, themeColor);

    if (themeMode === 'system' && typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => syncDomTheme('system', themeColor);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [themeMode, themeColor]);

  return <>{children}</>;
};
