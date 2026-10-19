import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@itools/contracts';
import type { AppRoute } from './route.js';

export interface AppNavigation {
  locale: Locale;
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  switchLocale: (locale: Locale) => void;
  openSearch: () => void;
}

export const AppNavigationContext = createContext<AppNavigation | null>(null);

export function AppNavigationProvider(props: {
  value: AppNavigation;
  children: ReactNode;
}): ReactNode {
  return (
    <AppNavigationContext.Provider value={props.value}>
      {props.children}
    </AppNavigationContext.Provider>
  );
}

export function useAppNavigation(): AppNavigation {
  const navigation = useContext(AppNavigationContext);

  if (!navigation) {
    throw new Error(
      'useAppNavigation must be used inside AppNavigationProvider.',
    );
  }

  return navigation;
}
