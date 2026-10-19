import { describe, expect, it } from 'vitest';
import {
  APP_COLOR_ROLES,
  appColorSchemeToCssVars,
  generateAppColorScheme,
  type AppColorMode,
  type AppColorRole,
} from './colors.js';

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

const contrastPairs: ReadonlyArray<readonly [AppColorRole, AppColorRole]> = [
  ['onBackground', 'background'],
  ['onSurface', 'surface'],
  ['onSurface', 'surfaceContainerHighest'],
  ['onSurfaceVariant', 'surfaceVariant'],
  ['inverseOnSurface', 'inverseSurface'],
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onPrimaryFixed', 'primaryFixed'],
  ['onPrimaryFixedVariant', 'primaryFixed'],
  ['onSecondary', 'secondary'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onSecondaryFixed', 'secondaryFixed'],
  ['onSecondaryFixedVariant', 'secondaryFixed'],
  ['onTertiary', 'tertiary'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onTertiaryFixed', 'tertiaryFixed'],
  ['onTertiaryFixedVariant', 'tertiaryFixed'],
  ['onError', 'error'],
  ['onErrorContainer', 'errorContainer'],
];

describe('Material 3 2025 app color scheme', () => {
  it.each(['light', 'dark'] satisfies AppColorMode[])(
    'provides all 53 stable semantic roles in %s mode',
    (mode) => {
      const colors = generateAppColorScheme(mode);

      expect(APP_COLOR_ROLES).toHaveLength(53);
      expect(Object.keys(colors)).toHaveLength(53);
      expect(
        Object.values(colors).every((color) => /^#[0-9a-f]{6}$/.test(color)),
      ).toBe(true);
      expect(colors.primary).toBe(mode === 'light' ? '#00675d' : '#b4fff2');
      expect(colors.primaryDim).toBe(mode === 'light' ? '#005a51' : '#00fde7');
      expect(colors.surfaceContainerLowest).toBe(
        mode === 'light' ? '#ffffff' : '#000000',
      );

      const cssVars = appColorSchemeToCssVars(colors);
      expect(Object.keys(cssVars)).toHaveLength(53);
      expect(cssVars['--md-sys-color-on-primary-fixed-variant']).toBe(
        colors.onPrimaryFixedVariant,
      );
    },
  );

  it.each(['light', 'dark'] satisfies AppColorMode[])(
    'keeps primary text and key accent pairs at WCAG AA in %s mode',
    (mode) => {
      const colors = generateAppColorScheme(mode);

      for (const [foreground, background] of contrastPairs) {
        expect(
          contrastRatio(colors[foreground], colors[background]),
          `${mode}: ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
