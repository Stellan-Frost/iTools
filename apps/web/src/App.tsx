import {
  AppThemeProvider,
  SnackbarProvider,
  type AppColorMode,
} from '@itools/design-system-adapter';
import { createI18n } from '@itools/app-core';
import type { Locale } from '@itools/contracts';
import { I18nextProvider } from 'react-i18next';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { AppNavigationProvider, type AppNavigation } from './app/navigation.js';
import { buildAppPath, parseAppPath, type AppRoute } from './app/route.js';
import { AppShell } from './components/app-shell/AppShell.js';
import { CommandPalette } from './components/command-palette/CommandPalette.js';
import { AdminPage } from './pages/admin/AdminPage.js';
import { CategoryPage } from './pages/category/CategoryPage.js';
import { HomePage } from './pages/home/HomePage.js';
import { NotFoundPage } from './pages/not-found/NotFoundPage.js';
import { TasksPage } from './pages/tasks/TasksPage.js';
import { ToolPage } from './pages/tool/ToolPage.js';

export interface AppProps {
  initialLocale: Locale;
  initialRoute: AppRoute;
}

function scrollToTop() {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function pushPath(path: string) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) return;
  window.history.pushState(null, '', path);
}

function CurrentPage({ route }: { route: AppRoute }) {
  switch (route.page) {
    case 'home':
      return <HomePage />;
    case 'category':
      return <CategoryPage categoryId={route.categoryId} />;
    case 'tool':
      return <ToolPage toolId={route.toolId} />;
    case 'tasks':
      return <TasksPage />;
    case 'admin':
      return <AdminPage />;
    default:
      return <NotFoundPage />;
  }
}

export function App({ initialLocale, initialRoute }: AppProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const [themeMode, setThemeMode] = useState<AppColorMode>('light');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const i18n = useMemo(() => createI18n(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const navigate = useCallback(
    (nextRoute: AppRoute) => {
      pushPath(buildAppPath(locale, nextRoute));
      setRoute(nextRoute);
      scrollToTop();
    },
    [locale],
  );

  const switchLocale = useCallback(
    (nextLocale: Locale) => {
      if (nextLocale === locale) return;
      pushPath(buildAppPath(nextLocale, route));
      setLocale(nextLocale);
      scrollToTop();
    },
    [locale, route],
  );

  useEffect(() => {
    function handlePopState() {
      const parsed = parseAppPath(window.location.pathname);
      setLocale(parsed.locale);
      setRoute(parsed.route);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);

  const navigation = useMemo<AppNavigation>(
    () => ({ locale, route, navigate, switchLocale, openSearch }),
    [locale, route, navigate, switchLocale, openSearch],
  );

  return (
    <I18nextProvider i18n={i18n}>
      <AppThemeProvider mode={themeMode}>
        <SnackbarProvider>
          <AppNavigationProvider value={navigation}>
            <AppShell
              themeMode={themeMode}
              onToggleTheme={() =>
                setThemeMode((mode) => (mode === 'light' ? 'dark' : 'light'))
              }
              onOpenSearch={openSearch}
            >
              <CurrentPage route={route} />
            </AppShell>
            <CommandPalette
              open={isSearchOpen}
              onClose={() => setIsSearchOpen(false)}
            />
          </AppNavigationProvider>
        </SnackbarProvider>
      </AppThemeProvider>
    </I18nextProvider>
  );
}
