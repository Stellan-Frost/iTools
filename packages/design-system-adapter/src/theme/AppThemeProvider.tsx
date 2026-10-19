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
  const shapeVars = {
    '--itools-shape-corner-rectangle': '2rem',
    '--itools-shape-corner-dialog': '3rem',
    '--md-sys-shape-corner-extra-small': 'var(--itools-shape-corner-rectangle)',
    '--md-sys-shape-corner-small': 'var(--itools-shape-corner-rectangle)',
    '--md-sys-shape-corner-medium': 'var(--itools-shape-corner-rectangle)',
    '--md-sys-shape-corner-large': 'var(--itools-shape-corner-rectangle)',
    '--md-sys-shape-corner-large-increased':
      'var(--itools-shape-corner-rectangle)',
    '--md-sys-shape-corner-extra-large': 'var(--itools-shape-corner-rectangle)',
    '--md-sys-shape-corner-extra-large-increased':
      'var(--itools-shape-corner-rectangle)',
    '--md-sys-shape-corner-extra-extra-large':
      'var(--itools-shape-corner-rectangle)',
  } as CSSProperties;

  return (
    <ThemeProvider
      seedColor={APP_THEME_SEED}
      mode={mode}
      variant="vibrant"
      contrastLevel={0}
      motionScheme="standard"
      style={{ ...colorVars, ...shapeVars }}
    >
      {children}
    </ThemeProvider>
  );
}
