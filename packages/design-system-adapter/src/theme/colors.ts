import {
  Hct,
  SchemeVibrant,
  argbFromHex,
  hexFromArgb,
  type DynamicColor,
} from '@material/material-color-utilities';

export const APP_THEME_SEED = '#E5007D';

/** All 53 semantic system color roles in the Material 3 2025 color spec. */
export const APP_COLOR_ROLES = [
  'background',
  'onBackground',
  'surface',
  'surfaceDim',
  'surfaceBright',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'outline',
  'outlineVariant',
  'inverseSurface',
  'inverseOnSurface',
  'shadow',
  'scrim',
  'surfaceTint',
  'primary',
  'primaryDim',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'inversePrimary',
  'primaryFixed',
  'primaryFixedDim',
  'onPrimaryFixed',
  'onPrimaryFixedVariant',
  'secondary',
  'secondaryDim',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'secondaryFixed',
  'secondaryFixedDim',
  'onSecondaryFixed',
  'onSecondaryFixedVariant',
  'tertiary',
  'tertiaryDim',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'tertiaryFixed',
  'tertiaryFixedDim',
  'onTertiaryFixed',
  'onTertiaryFixedVariant',
  'error',
  'errorDim',
  'onError',
  'errorContainer',
  'onErrorContainer',
] as const;

export type AppColorRole = (typeof APP_COLOR_ROLES)[number];
export type AppColorScheme = Record<AppColorRole, string>;
export type AppColorMode = 'light' | 'dark';

function toCssName(role: AppColorRole): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Generate fixed-seed Material 3 2025 SchemeVibrant roles.
 * MCU accepts the spec/platform explicitly so package defaults cannot change
 * the result when a future MCU release updates its default scheme.
 */
export function generateAppColorScheme(mode: AppColorMode): AppColorScheme {
  const scheme = new SchemeVibrant(
    Hct.fromInt(argbFromHex(APP_THEME_SEED)),
    mode === 'dark',
    0,
    '2025',
    'phone',
  );

  const colors = {} as AppColorScheme;
  // MCU 0.4.0's SchemeVibrant declaration omits inherited DynamicScheme.colors
  // in some TypeScript resolutions even though the runtime property exists.
  const colorFunctions = (
    scheme as unknown as {
      colors: Record<AppColorRole, () => DynamicColor | undefined>;
    }
  ).colors;
  for (const role of APP_COLOR_ROLES) {
    const dynamicColor = colorFunctions[role]();
    if (!dynamicColor) {
      throw new Error(`MCU 2025 did not provide the ${role} color role`);
    }
    colors[role] = hexFromArgb(
      dynamicColor.getArgb(
        scheme as unknown as Parameters<typeof dynamicColor.getArgb>[0],
      ),
    ).toLowerCase();
  }
  return colors;
}

/** Convert the role map to the CSS custom properties used by M3 components. */
export function appColorSchemeToCssVars(
  colors: AppColorScheme,
): Record<`--md-sys-color-${string}`, string> {
  return Object.fromEntries(
    APP_COLOR_ROLES.map((role) => [
      `--md-sys-color-${toCssName(role)}`,
      colors[role],
    ]),
  ) as Record<`--md-sys-color-${string}`, string>;
}
