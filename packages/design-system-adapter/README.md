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

Set `mode` to `'light'` or `'dark'` from the app's own preference state. `AppThemeProvider` always uses seed `#009688`, `SchemeVibrant`, MCU spec version `2025`, `phone` platform, and contrast level `0`.

`MaterialIcon` renders a Material Symbols ligature. It is decorative and hidden from assistive technology by default. Pass `aria-label` when the symbol itself conveys meaning. Its `size` is in CSS pixels and defaults to 24.

The package entry re-exports the library's Button, IconButton, TextField, Dialog, Card and card actions, navigation drawer and rail, snackbar provider and hook, linear and circular progress indicators, Switch, Chip, and supporting form, list, search, menu, tabs and feedback components. Import these components through this adapter; application code should not import `m3-expressive-react` directly.

## Color generation

Colors are generated in `src/theme/colors.ts` with the locked `@material/material-color-utilities@0.4.0` package. The generation input is fixed and explicit so package default changes cannot silently switch the scheme:

```ts
new SchemeVibrant(
  Hct.fromInt(argbFromHex('#009688')),
  mode === 'dark',
  0,
  '2025',
  'phone',
);
```

Each of the 53 semantic roles becomes `--md-sys-color-{kebab-case-role}` on the provider element. The library provider still supplies its 1.6.0 context and standard component behavior; the adapter's generated role variables override the library's 2021 scheme values, including the four additional 2025 roles `primaryDim`, `secondaryDim`, `tertiaryDim`, and `errorDim`. The table records the emitted values for seed `#009688`.

| Role | Light | Dark |
| --- | --- | --- |
| background | `#d3fffd` | `#001111` |
| onBackground | `#003534` | `#b8f3f1` |
| surface | `#d3fffd` | `#001111` |
| surfaceDim | `#87e4e2` | `#001111` |
| surfaceBright | `#d3fffd` | `#003232` |
| surfaceContainerLowest | `#ffffff` | `#000000` |
| surfaceContainerLow | `#bafdfb` | `#001716` |
| surfaceContainer | `#adf5f3` | `#001e1d` |
| surfaceContainerHigh | `#a2f0ee` | `#002424` |
| surfaceContainerHighest | `#96ebe9` | `#002b2b` |
| onSurface | `#003534` | `#b8f3f1` |
| surfaceVariant | `#96ebe9` | `#002b2b` |
| onSurfaceVariant | `#296463` | `#7bb5b4` |
| outline | `#46807f` | `#457f7e` |
| outlineVariant | `#7db7b6` | `#0d5050` |
| inverseSurface | `#001111` | `#e3fffd` |
| inverseOnSurface | `#6da7a5` | `#215e5d` |
| shadow | `#000000` | `#000000` |
| scrim | `#000000` | `#000000` |
| surfaceTint | `#00675d` | `#b4fff2` |
| primary | `#00675d` | `#b4fff2` |
| primaryDim | `#005a51` | `#00fde7` |
| onPrimary | `#c0fff4` | `#00665c` |
| primaryContainer | `#00f7e1` | `#00fde7` |
| onPrimaryContainer | `#005950` | `#005c53` |
| inversePrimary | `#00fde7` | `#006b61` |
| primaryFixed | `#00f7e1` | `#00f7e1` |
| primaryFixedDim | `#00e8d3` | `#00e8d3` |
| onPrimaryFixed | `#00443d` | `#00443d` |
| onPrimaryFixedVariant | `#00635a` | `#00635a` |
| secondary | `#006666` | `#37fbf8` |
| secondaryDim | `#005959` | `#0eecea` |
| onSecondary | `#bbfffd` | `#005c5b` |
| secondaryContainer | `#37fbf8` | `#006a69` |
| onSecondaryContainer | `#005c5b` | `#dafffd` |
| secondaryFixed | `#37fbf8` | `#37fbf8` |
| secondaryFixedDim | `#0eecea` | `#0eecea` |
| onSecondaryFixed | `#004747` | `#004747` |
| onSecondaryFixedVariant | `#006666` | `#006666` |
| tertiary | `#006287` | `#62c9ff` |
| tertiaryDim | `#005676` | `#1ebdfd` |
| onTertiary | `#e7f4ff` | `#003f58` |
| tertiaryContainer | `#1ebdfd` | `#1ebdfd` |
| onTertiaryContainer | `#00354a` | `#00354a` |
| tertiaryFixed | `#1ebdfd` | `#1ebdfd` |
| tertiaryFixedDim | `#00afec` | `#00afec` |
| onTertiaryFixed | `#001a27` | `#001a27` |
| onTertiaryFixedVariant | `#003e57` | `#003e57` |
| error | `#b31b25` | `#ff716c` |
| errorDim | `#9f0519` | `#d7383b` |
| onError | `#ffefee` | `#490006` |
| errorContainer | `#fb5151` | `#9f0519` |
| onErrorContainer | `#570008` | `#ffa8a3` |

Automated contrast checks cover text-on-surface/background and text-on-accent roles in both modes. Primary text pairs are `#c0fff4` on `#00675d` (6.08:1) in light mode and `#00665c` on `#b4fff2` (6.06:1) in dark mode. These results apply to this seed and default contrast level; validate any future color or contrast change independently.

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

`--itools-layout-content-max` is `80rem`, `--itools-layout-readable-max` is `72ch`, `--itools-layout-sidebar-width` is `18.5rem`, and `--itools-layout-page-gutter` grows from `1rem` to `1.5rem` at medium and `2rem` at expanded. Use these values in app-owned page layout CSS.

### Shape and typography tokens

`AppThemeProvider` writes `--itools-shape-corner-rectangle: 3rem` (48px) through the library `ThemeProvider` public `style` prop. The same style maps the fixed MD3 corner tokens (`extra-small` through `extra-extra-large`) to that app token; `none` and `full` stay at their library values. App-owned rectangular surfaces also use the app token. Full-radius capsule and circular geometry retain their semantic shape. The installed library exposes no dedicated shape configuration prop; its documented public style prop is the supported CSS custom property entry point. The library's internal component selectors are not overridden.

The library provides the fifteen text roles as `--md-sys-typescale-{group}-{size}` tokens. Text uses only Display, Headline, Title, Body and Label at Large, Medium or Small. The default role sizes are respectively Display 57/45/36px, Headline 32/28/24px, Title 22/16/14px, Body 16/14/12px and Label 14/12/11px. Font family, weight, line height and tracking come from the matching role tokens. Material Symbols use their own icon size.
Navigation and shell layout tokens are app-owned dimensions, added to keep the persistent accordion, compact header, and detail metadata aligned across desktop and drawer presentations:

| Token | Value | Use |
| --- | ---: | --- |
| `--itools-layout-app-bar-height` | `4.5rem` | Desktop top bar and sticky navigation offset |
| `--itools-layout-brand-mark-size` | `2rem` | App brand mark |
| `--itools-layout-navigation-item-min-height` | `3.5rem` | Home/category rows and compact drawer trigger; 56px target |
| `--itools-layout-navigation-home-min-height` | `3.75rem` | Home row emphasis |
| `--itools-layout-navigation-tool-min-height` | `3rem` | Tool rows; 48px touch target |
| `--itools-layout-navigation-icon-size` | `1.5rem` | Accordion category and tool icons |
| `--itools-layout-dialog-metadata-label-width` | `5rem` | Metadata label column before compact stacking |
| `--itools-layout-focus-ring-width` | `0.125rem` | Visible keyboard focus ring |
| `--itools-layout-focus-ring-inset` | `-0.125rem` | Keep row focus rings visible inside the clipped accordion list |

`--itools-state-layer-hover-opacity` is `8%`; focus and pressed layers are `10%`. These opacity values blend the semantic `on-surface` role into the current surface and avoid fixed state colors. The accordion uses the existing short/medium motion durations and standard/emphasized easing for row feedback, expansion, and chevron rotation; no separate component duration is needed.

The small press response uses `--itools-motion-feedback-scale` (`0.99`); the dialog content entrance uses `--itools-motion-dialog-entry-scale` (`0.985`) with the existing medium duration. These scales are shared motion parameters so individual surfaces do not introduce unrelated values.

App motion tokens are `--itools-motion-duration-instant` 0ms, short 150ms, medium 250ms, long 400ms, and standard/emphasized easing `cubic-bezier(0.2, 0, 0, 1)`. `prefers-reduced-motion: reduce` sets all adapter durations to 0ms and app-owned accordion/dialog animations are disabled. The underlying library is configured with the standard motion scheme and its own CSS also sets spatial spring durations to zero for reduced motion. The mobile drawer continues to use the library `NavigationDrawer` open/close transition; app-owned drawer content only controls its scroll and heading layout.

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
