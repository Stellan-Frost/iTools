import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { ThemeProvider } from 'm3-expressive-react';
import {
  APP_THEME_SEED,
  appColorSchemeToCssVars,
  generateAppColorScheme,
  type AppColorMode,
} from './colors.js';

export interface AppThemeProviderProps {
  mode: AppColorMode;
  children: ReactNode;
}

/** Fixed iTools SchemeVibrant 2025 theme provider for the frozen app shell. */
export function AppThemeProvider({ mode, children }: AppThemeProviderProps) {
  const colorVars = useMemo(
    () => appColorSchemeToCssVars(generateAppColorScheme(mode)),
    [mode],
  );

  return (
    <ThemeProvider
      seedColor={APP_THEME_SEED}
      mode={mode}
      variant="vibrant"
      contrastLevel={0}
      motionScheme="standard"
      style={colorVars as CSSProperties}
    >
      {children}
    </ThemeProvider>
  );
}
