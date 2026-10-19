# @itools/design-system-adapter

Thin app adapter for the pinned `m3-expressive-react@1.6.0` Material 3 component library. The adapter owns the fixed app theme and local fonts; the library continues to own the internal component markup, interaction and styling.

## Setup and usage

Import the package stylesheet exactly once from the app's global entry point. It is the only global style entry and loads the component styles and self-hosted fonts:

```tsx
// apps/web/src/main.tsx
import '@itools/design-system-adapter/styles.css';
```

```tsx
import {
  AppThemeProvider,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  MaterialIcon,
  NavigationDrawer,
  NavigationDrawerItem,
  SnackbarProvider,
  TextField,
  useSnackbar,
} from '@itools/design-system-adapter';

function SaveAction() {
  const { show } = useSnackbar();

  return (
    <Button
      variant="filled"
      onClick={() => void show({ message: 'Saved', duration: 'short' })}
    >
      Save
    </Button>
  );
}

export function App() {
  return (
    <AppThemeProvider mode="light">
      <SnackbarProvider>
        <NavigationDrawer aria-label="Main navigation">
          <NavigationDrawerItem value="home" label="Home" icon={<MaterialIcon name="home" />} />
        </NavigationDrawer>
        <Card>
          <TextField label="Tool name" />
          <Chip label="Ready" variant="assist" />
          <IconButton aria-label="Search"><MaterialIcon name="search" /></IconButton>
          <SaveAction />
        </Card>
        <Dialog open={false} title="Details" />
      </SnackbarProvider>
    </AppThemeProvider>
  );
}
```

Set `mode` to `'light'` or `'dark'` from the app's own preference state. `AppThemeProvider` always uses seed `#E5007D`, `SchemeVibrant`, MCU spec version `2025`, `phone` platform, and contrast level `0`.

`MaterialIcon` renders a Material Symbols ligature. It is decorative and hidden from assistive technology by default. Pass `aria-label` when the symbol itself conveys meaning. Its `size` is in CSS pixels and defaults to 24.

The package entry re-exports the library's Button, IconButton, TextField, Dialog, Card and card actions, navigation drawer and rail, snackbar provider and hook, linear and circular progress indicators, Switch, Chip, and supporting form, list, search, menu, tabs and feedback components. Import these components through this adapter; application code should not import `m3-expressive-react` directly.

## Color generation

Colors are generated in `src/theme/colors.ts` with the locked `@material/material-color-utilities@0.4.0` package. The generation input is fixed and explicit so package default changes cannot silently switch the scheme:

```ts
new SchemeVibrant(
  Hct.fromInt(argbFromHex('#E5007D')),
  mode === 'dark',
  0,
  '2025',
  'phone',
);
```

Each of the 53 semantic roles becomes `--md-sys-color-{kebab-case-role}` on the provider element. The library provider still supplies its 1.6.0 context and standard component behavior; the adapter's generated role variables override the library's 2021 scheme values, including the four additional 2025 roles `primaryDim`, `secondaryDim`, `tertiaryDim`, and `errorDim`. The table records the emitted values for seed `#E5007D`.

| Role | Light | Dark |
| --- | --- | --- |
| background | `#fff4f7` | `#210218` |
| onBackground | `#48223a` | `#ffdced` |
| surface | `#fff4f7` | `#210218` |
| surfaceDim | `#ffc3e4` | `#210218` |
| surfaceBright | `#fff4f7` | `#4d173c` |
| surfaceContainerLowest | `#ffffff` | `#000000` |
| surfaceContainerLow | `#ffecf3` | `#29051e` |
| surfaceContainer | `#ffe0ef` | `#320926` |
| surfaceContainerHigh | `#ffd8eb` | `#3b0d2d` |
| surfaceContainerHighest | `#ffd0e8` | `#441234` |
| onSurface | `#48223a` | `#ffdced` |
| surfaceVariant | `#ffd0e8` | `#441234` |
| onSurfaceVariant | `#7a4e68` | `#d19bb9` |
| outline | `#986884` | `#976783` |
| outlineVariant | `#d39dbb` | `#643a54` |
| inverseSurface | `#210218` | `#fff8f8` |
| inverseOnSurface | `#c28eab` | `#734761` |
| shadow | `#000000` | `#000000` |
| scrim | `#000000` | `#000000` |
| surfaceTint | `#ad1c60` | `#ff88b2` |
| primary | `#ad1c60` | `#ff88b2` |
| primaryDim | `#9c0854` | `#ff69a3` |
| onPrimary | `#ffeff1` | `#610032` |
| primaryContainer | `#ff6fa6` | `#ff6fa6` |
| onPrimaryContainer | `#4c0025` | `#4c0025` |
| inversePrimary | `#fa5c9c` | `#b22164` |
| primaryFixed | `#ff6fa6` | `#ff6fa6` |
| primaryFixedDim | `#f65a99` | `#f65a99` |
| onPrimaryFixed | `#000000` | `#000000` |
| onPrimaryFixedVariant | `#5d002f` | `#5d002f` |
| secondary | `#963778` | `#fe8ed4` |
| secondaryDim | `#872b6b` | `#ee81c6` |
| onSecondary | `#ffeef5` | `#62054c` |
| secondaryContainer | `#ffbfe2` | `#7c2161` |
| onSecondaryContainer | `#7d2162` | `#ffbde2` |
| secondaryFixed | `#ffbfe2` | `#ffbfe2` |
| secondaryFixedDim | `#ffa9dc` | `#ffa9dc` |
| onSecondaryFixed | `#65084d` | `#65084d` |
| onSecondaryFixedVariant | `#882c6c` | `#882c6c` |
| tertiary | `#524db6` | `#a29eff` |
| tertiaryDim | `#4641a9` | `#9692fe` |
| onTertiary | `#f5f1ff` | `#1e1183` |
| tertiaryContainer | `#aba7ff` | `#938ffc` |
| onTertiaryContainer | `#251b89` | `#11006e` |
| tertiaryFixed | `#aba7ff` | `#aba7ff` |
| tertiaryFixedDim | `#9c98ff` | `#9c98ff` |
| onTertiaryFixed | `#0d005e` | `#0d005e` |
| onTertiaryFixedVariant | `#2f2792` | `#2f2792` |
| error | `#b41340` | `#ff6e84` |
| errorDim | `#a20036` | `#d73357` |
| onError | `#ffefef` | `#490013` |
| errorContainer | `#f74b6d` | `#a70138` |
| onErrorContainer | `#510017` | `#ffb2b9` |

Automated contrast checks cover text-on-surface/background and text-on-accent roles in both modes. The lowest tested pair is `onErrorContainer` on `errorContainer`: 4.54:1 in light mode and 4.56:1 in dark mode. These results apply to this seed and default contrast level; validate any future color or contrast change independently.

## Layout and foundation tokens

Spacing tokens use a 4px base scale and rem units so they respond to the user's root font size.

| Token | Value |
| --- | ---: |
| `--itools-space-1` | `0.25rem` (4px) |
| `--itools-space-2` | `0.5rem` (8px) |
| `--itools-space-3` | `0.75rem` (12px) |
| `--itools-space-4` | `1rem` (16px) |
| `--itools-space-5` | `1.25rem` (20px) |
| `--itools-space-6` | `1.5rem` (24px) |
| `--itools-space-8` | `2rem` (32px) |
| `--itools-space-10` | `2.5rem` (40px) |
| `--itools-space-12` | `3rem` (48px) |
| `--itools-space-16` | `4rem` (64px) |

| Breakpoint token | CSS media query | M3 window class |
| --- | --- | --- |
| `--itools-breakpoint-compact` | `37.5rem` / 600px | compact upper bound |
| `--itools-breakpoint-medium` | `52.5rem` / 840px | medium upper bound |
| `--itools-breakpoint-expanded` | `75rem` / 1200px | expanded upper bound |
| `--itools-breakpoint-large` | `100rem` / 1600px | large upper bound |

CSS custom properties cannot be used as media-query thresholds, so write these same values as literal `rem` values in `@media`. The tokens document the shared breakpoints for app styles and TypeScript consumers.

`--itools-layout-content-max` is `80rem`, `--itools-layout-readable-max` is `72ch`, `--itools-layout-sidebar-width` is `17.5rem`, and `--itools-layout-page-gutter` grows from `1rem` to `1.5rem` at medium and `2rem` at expanded. Use these values in app-owned page layout CSS. The component library's established shape tokens remain authoritative: `--md-sys-shape-corner-none` 0px, extra-small 4px, small 8px, medium 12px, large 16px, large-increased 20px, extra-large 28px, extra-large-increased 32px, extra-extra-large 48px, full 9999px. Typography roles use the library's `--md-sys-typescale-*` tokens and Roboto/Noto Sans SC font family values.

App motion tokens are `--itools-motion-duration-instant` 0ms, short 150ms, medium 250ms, long 400ms, and standard/emphasized easing `cubic-bezier(0.2, 0, 0, 1)`. `prefers-reduced-motion: reduce` sets all adapter durations to 0ms. The underlying library is configured with the standard motion scheme and its own CSS also sets spatial spring durations to zero for reduced motion.

## Local fonts, icons and licenses

Fontsource assets are imported from the exact package versions already pinned in the workspace lockfile and are served by the app build. There are no Google Fonts or other runtime font requests.

| Resource | Package version | Loaded file | License / source metadata |
| --- | --- | --- | --- |
| Roboto Variable | `@fontsource-variable/roboto@5.3.0` | `wght.css` (variable 100–900) | SIL Open Font License 1.1; Fontsource package metadata |
| Noto Sans SC Variable | `@fontsource-variable/noto-sans-sc@5.3.1` | `wght.css` (variable 100–900, Unicode subsets) | SIL Open Font License 1.1; Fontsource package metadata |
| Material Symbols Rounded | `@fontsource/material-symbols-rounded@5.3.9` | `400.css` (Latin, `v378`) | SIL Open Font License 1.1; Fontsource package metadata |

Fontsource's Material Symbols Rounded package provides static weight files rather than a variable font. This adapter loads weight 400 and does not promise the Symbols `FILL`, `GRAD`, or `opsz` axes; use the available ligatures and alternate symbol names when an outlined/selected distinction is needed. The supplied font package license files and version metadata are the licensing record to retain with the lockfile.

The component library is MIT licensed. `@material/material-color-utilities` is Apache-2.0 licensed; its code and scheme output are not copied into this package.

## Known library constraints

- `m3-expressive-react@1.6.0` has a small maintainer and relatively fast release cadence. Keep the exact version pinned and rerun the adapter tests and app visual checks before upgrades.
- Its built-in theme generator is still based on the 2021 color spec and exposes fewer roles. `AppThemeProvider` uses it only for the library provider/context, then overrides CSS color variables with the generated 2025 scheme. Do not export or rely on the library `useTheme()` color map as if it included the 2025 roles.
- The library styles are imported here once. Avoid local overrides of its internal component selectors; use semantic tokens and app-owned layout wrappers.
