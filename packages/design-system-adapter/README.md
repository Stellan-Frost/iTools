# `@itools/design-system-adapter`

应用唯一的 Material 3 UI 接入层。包装器负责 iTools 主题、少量形状适配和本地字体；组件主体、交互与组件样式由锁定的 `m3-expressive-react@1.6.0` 提供。应用应从此包导入基础 UI，不直接导入主库。

## 接入

在应用全局入口只引入一次样式：

```tsx
// apps/web/src/main.tsx
import '@itools/design-system-adapter/styles.css';
```

最小根级提供器：

```tsx
import {
  AppThemeProvider,
  SnackbarProvider,
} from '@itools/design-system-adapter';

<AppThemeProvider mode="light">
  <SnackbarProvider>{children}</SnackbarProvider>
</AppThemeProvider>;
```

`mode` 必须由应用传入 `'light' | 'dark'`。当前 App 初值为 light，状态只存在内存中。

## 公开入口

从包根入口 `src/index.ts` 导入组件及其公开 Props 类型。可用项包括：

- 适配器：`AppThemeProvider` / `AppThemeProviderProps`、`MaterialIcon` / `MaterialIconProps`、`IconButton` / `IconButtonProps`、`Dialog` / `DialogProps`、`NavigationDrawer` / `NavigationDrawerProps`。
- 主库组件：`Button`、`ButtonGroup`、`IconButton` 包装器、`TextField`、`SearchBar`、`Dialog` 包装器、`Card` 及 actions、`Chip`、`NavigationDrawer` 包装器及 item、`NavigationRail` 及 item、`SnackbarProvider` / `useSnackbar`、线性与环形进度、表单控件、列表、菜单、tabs、tooltip、autocomplete、date picker、bottom sheet、badge、divider、fab 等；对应 Props 类型亦从根入口导出，具体导出名以 `src/index.ts` 为准。
- 主题工具：`APP_THEME_SEED`、`APP_COLOR_ROLES`、`generateAppColorScheme`、`appColorSchemeToCssVars` 及相关主题类型。

`IconButton`、`Dialog`、`NavigationDrawer` 包装器以 `forwardRef` 保留对应主库公开 ref 和 Props。IconButton 固定圆形 `borderRadius`；Dialog 固定 48px 圆角；NavigationDrawer 将末端两角设为 32px、起始边保持贴合。包装器透传其余公开 props。`IconButton` 的 48px 最小点击区域由上游组件提供，不随视觉 `size` 缩小。`MaterialIcon` 使用本地 Material Symbols ligature，默认 24px，默认对辅助技术隐藏；若符号本身传递含义可传 `aria-label`。

## 主题与 Token

`AppThemeProvider` 使用 `#009688`、MCU `SchemeVibrant`、2025 规范、phone 平台和 contrast level 0，生成 53 个 `--md-sys-color-*` 语义角色。适配层覆盖组件库的 CSS 颜色变量；组件库 ThemeProvider/context 仍来自上游 1.6.0，内置颜色模型基于 2021 规范且少四个 2025 dim roles。不要把上游 `useTheme()` 的颜色映射当作 2025 全量角色来源。具体生成逻辑在 `src/theme/colors.ts`，无需在此重复整张颜色表。

| Token 组 | 入口及值                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| 间距     | `--itools-space-*`：4px 基数，0.25rem 至 4rem，包含 1、2、3、4、5、6、8、10、12、16 级。                             |
| 断点     | compact 600px、medium 840px、expanded 1200px、large 1600px；CSS media query 使用对应字面值。                         |
| 布局     | 内容最大宽 80rem、可读宽 72ch、侧栏宽 18.5rem；页边距随 medium/expanded 增长。                                       |
| 形状     | app rectangle 32px、Dialog 48px；MD3 类型比例 15 个 display/headline/title/body/label 角色由上游提供。               |
| 动效     | instant 0ms、short 150ms、medium 250ms、long 400ms；state layer hover 8%，focus/pressed 10%。                        |
| 字体     | Roboto Variable、Noto Sans SC Variable、Material Symbols Rounded 400，均由 Fontsource 打包进应用，无运行时字体 CDN。 |

当前字体包版本为 Roboto 5.3.0、Noto Sans SC 5.3.1、Material Symbols Rounded 5.3.9；字体包及上游组件库/MCU 的 license 与版本元数据随依赖保留。字体许可证为 SIL OFL 1.1，组件库为 MIT，MCU 为 Apache-2.0。Symbols 当前只加载静态 400 字重，不承诺 FILL、GRAD、opsz 可变轴。

适配层和应用样式支持 `prefers-reduced-motion: reduce`：适配层时长归零，应用自有的手风琴和 Dialog 动画关闭；移动 drawer 的开合仍由上游组件控制。当前产品没有用户可切换的减少动态效果设置。

## 升级检查

`m3-expressive-react`、`@material/material-color-utilities` 和字体包均应按锁定版本审查。升级时检查 `src/index.ts` 导出和 Props/ref 兼容性、Provider/context 与颜色角色差异、公开 style prop 在真实 surface 上的效果、字体许可/资源打包；再运行适配层测试、类型与构建门禁，并检查桌面/移动浅深主题、搜索和导航视觉交互。不要通过覆盖上游内部 CSS 类修补组件；优先使用语义 Token 与应用布局包装。
