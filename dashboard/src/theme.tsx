import { useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';
export type PortalId = 'guardsaab' | 'northstar';

export function getPortalKey(portal: PortalId): string {
  return portal === 'guardsaab' ? 'guardsaab-theme' : 'northstar-theme';
}

export function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function getSavedTheme(portal: PortalId): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(getPortalKey(portal));
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // localStorage might be unavailable or restricted
  }
  return getSystemTheme();
}

export function applyThemeToDom(portal: PortalId, theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-portal', portal);

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    if (portal === 'guardsaab') {
      metaThemeColor.setAttribute('content', theme === 'light' ? '#f8fafc' : '#071014');
    } else {
      metaThemeColor.setAttribute('content', theme === 'light' ? '#f8fafc' : '#101211');
    }
  }
}

export function useTheme(portal: PortalId) {
  const [theme, setThemeState] = useState<Theme>(() => getSavedTheme(portal));

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(getPortalKey(portal), newTheme);
    } catch {
      // ignore
    }
    applyThemeToDom(portal, newTheme);
  }, [portal]);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [theme, setTheme]);

  // Sync with DOM on mount and when portal/theme changes
  useEffect(() => {
    applyThemeToDom(portal, theme);
  }, [portal, theme]);

  // Listen to OS preference changes only if user hasn't explicitly set a preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const key = getPortalKey(portal);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    
    const handler = (e: MediaQueryListEvent) => {
      try {
        const saved = localStorage.getItem(key);
        if (!saved) {
          const sysTheme: Theme = e.matches ? 'light' : 'dark';
          setThemeState(sysTheme);
          applyThemeToDom(portal, sysTheme);
        }
      } catch {
        // ignore
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [portal]);

  return { theme, toggleTheme, setTheme };
}

export function SunIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

export function MoonIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

interface ThemeToggleProps {
  portal: PortalId;
  theme: Theme;
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({
  portal,
  theme,
  onToggle,
  className = '',
}: ThemeToggleProps) {
  const isLight = theme === 'light';
  const label = isLight ? 'Switch to dark theme' : 'Switch to light theme';

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={onToggle}
      aria-label={label}
      title={label}
      data-theme={theme}
      data-portal={portal}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isLight ? <MoonIcon /> : <SunIcon />}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
