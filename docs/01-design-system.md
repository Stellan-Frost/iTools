# 01 · MD3 设计系统规范（强制）

> 定位：定义全部视觉与组件规则；新增页面、组件或改样式前必读，违反即无法通过 `check:tokens` 与评审。
> 状态：已实现（阶段 2，阶段 3–4 扩展壳层与页面骨架）。
> 代码入口：`packages/design-system-adapter/src/{index.ts,styles.css,theme/}`、`apps/web/src/components/**`。

## 1. 当前事实

| 项 | 值 |
| --- | --- |
| 规范体系 | Material Design 3（Expressive）；不用 MD2 |
| 组件库 | `m3-expressive-react@1.6.0`（锁定版本，单维护者，升级有风险） |
| 颜色引擎 | `@material/material-color-utilities`，种子 `#009688`（`APP_THEME_SEED`），`SchemeVibrant` + 2025 规范 + phone + contrast 0，产出 **53 个** `--md-sys-color-*` 语义角色 |
| 已知颜色差异 | 上游 ThemeProvider 内部是 2021 模型、少 4 个 2025 dim roles；不要把上游 `useTheme()` 的颜色映射当 2025 全量角色来源 |
| 字体 | Roboto Variable 5.3.0、Noto Sans SC Variable 5.3.1、Material Symbols Rounded 5.3.9（Fontsource 本地打包，无字体 CDN；许可 OFL 1.1 / OFL 1.1 / Apache-2.0） |
| Typescale | Display / Headline / Title / Body / Label × Large / Medium / Small = 15 个 `--md-sys-typescale-*` 角色，文本只允许用这 15 个 |
| 无障碍基线 | 交互目标 ≥48px、键盘焦点可见、`prefers-reduced-motion: reduce` 时动效归零；不做额外无障碍专项 |

### 1.1 设计 Token（唯一合法的样式来源）

| Token 组 | 变量与取值 |
| --- | --- |
| 颜色 | `--md-sys-color-*`（53 个角色，由 `AppThemeProvider` 生成） |
| 间距 | `--itools-space-*`：4px 基数，0.25rem → 4rem（1/2/3/4/5/6/8/10/12/16 级） |
| 断点 | compact 600px、medium 840px、expanded 1200px、large 1600px（media query 用字面值） |
| 布局 | 内容最大宽 80rem、可读宽 72ch、侧栏宽 18.5rem、品牌标记 2rem |
| 形状 | `--itools-shape-corner-rectangle` = 32px；`--itools-shape-corner-dialog` = 48px；胶囊/圆形 = `full`（IconButton 在适配层强制圆形） |
| 动效 | `--itools-motion-*`：instant 0ms、short 150ms、medium 250ms、long 400ms；state layer hover 8%、focus/pressed 10% |

### 1.2 适配层公开入口（`@itools/design-system-adapter`）

- 主题：`AppThemeProvider`（`mode` 必须由应用传入 `'light' | 'dark'`）、`APP_THEME_SEED`、`generateAppColorScheme`、`appColorSchemeToCssVars`。
- 包装器（`forwardRef`，透传公开 props）：`IconButton`（固定圆形）、`Dialog`（固定 48px 圆角）、`NavigationDrawer`（末端两角 32px）。
- 白名单转发主库组件：`Button`、`ButtonGroup`、`TextField`、`SearchBar`、`Card`、`Chip`、`NavigationRail`、`SnackbarProvider`/`useSnackbar`、进度、表单控件、列表、菜单、Tabs、Tooltip、Badge、Divider、FAB 等；导出名以 `src/index.ts` 为准。
- 图标：`MaterialIcon`（本地 Material Symbols ligature，默认 24px、默认 `aria-hidden`；符号承载含义时必须传 `aria-label`）。
- 全局样式：`@itools/design-system-adapter/styles.css`，只在 `entry-client.tsx` 引入一次。

### 1.3 品牌图标（`apps/web/public/brand-icon/`）

| 文件 | 用途 |
| --- | --- |
| `icon-preview.svg` | 顶栏品牌标记（`AppShell.tsx` 引用） |
| `favicon.svg` | 浏览器标签页图标（`index.html`） |
| `icon-{background,foreground}[-dark].svg` | 分层导出素材，页面当前未单独引用 |

功能图标一律用 `MaterialIcon`，不使用品牌 SVG；仓库没有 PNG 导出与 `apple-touch-icon.png`，不得假定存在。

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `packages/design-system-adapter/src/theme/` | 种子色 → 53 个颜色角色 → CSS 变量（唯一 Token 来源） |
| `packages/design-system-adapter/src/components/` | 对 `m3-expressive-react` 的白名单包装 |
| `packages/design-system-adapter/src/styles.css` | 全局样式与 Token 声明 |
| `apps/web/src/components/app-shell/` | 壳层：`AppShell`、`AppShellTopBar`、`AppShellDrawer`、`ToolAccordionNavigation`、`ToolInfoDialog` |
| `apps/web/src/components/page-chrome/` | `PreviewBadge`、`PageHeading`、`PreviewNotice`、`MetadataChip` 等共享展示组件 |
| `apps/web/src/components/{catalog,command-palette,recent-tasks,tool-search-entry,app-icon}/` | 分类卡片、命令面板、最近任务、搜索入口、品牌图标 |

## 3. 必须遵守的规则

1. **禁止裸 HTML 交互控件**：`button/input/select/textarea` 必须用适配层组件。执行：`apps/web` 的 ESLint `no-restricted-syntax` 直接阻断；`<a>` 与纯展示元素不受限。
2. **禁止直接 import `m3-expressive-react`**：只能从 `@itools/design-system-adapter` 导入。执行：ESLint `no-restricted-imports`。
3. **颜色只用语义变量**：不得出现十六进制颜色、内联 `style`、`!important`。执行：`pnpm check:tokens` 扫 `apps/web/src` 的 `.css/.ts/.tsx`。
4. 样式放在 CSS Module；布局与间距通过外层容器、组件 props 或 `className` 实现，**不得覆盖组件库内部选择器**。
5. 图标按钮统一圆形；独立图标底板用等宽高 + `full` 圆角 + 成对的语义前景/容器色。
6. 交互目标 ≥48px（IconButton 的 48px 命中区由上游提供，不随视觉 `size` 缩小）；键盘焦点必须可见。
7. 文本字号只允许 15 个 typescale 角色；间距只用 `--itools-space-*` 档位。
8. 动效只用 `--itools-motion-*` 时长/缓动；新增动画必须处理 `prefers-reduced-motion: reduce`。
9. 预览态标识统一用 `PreviewBadge` + `common:availability.preview`；卡片/页面/壳层不得各造一套徽标。
10. 主题与语言入口只在顶栏/抽屉；`AppShell` 仅保留状态与组合（顶栏、抽屉在独立文件）。

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| `<button onClick={...}>关闭</button>` | `<Button onClick={...}>{t('actions.close')}</Button>` |
| `import { Button } from 'm3-expressive-react'` | `import { Button } from '@itools/design-system-adapter'` |
| `<div style={{ color: '#0f766e' }}>` | `className` + CSS Module 内 `color: var(--md-sys-color-primary)` |
| `padding: 13px`、`border-radius: 7px` | `var(--itools-space-3)`、`var(--itools-shape-corner-rectangle)` |
| 在页面里重新实现「预览」徽标 | 复用 `components/page-chrome/PreviewBadge` |
| 覆盖上游类名（`.m3-button__label { ... }`） | 用包装组件或语义 Token 表达差异 |
| `MaterialIcon` 传了承载含义的符号却不给 `aria-label` | 补 `aria-label`（或确认纯装饰保持默认隐藏） |

## 5. 如何验证

```sh
pnpm check:tokens                                # 期望：无硬编码颜色/内联 style/!important
pnpm lint                                        # 含裸控件与组件库直用阻断
pnpm --filter @itools/design-system-adapter test # 9 项组件测试
pnpm --filter @itools/web test                   # 96 项（壳层、页面、路由、SEO）
pnpm build && node scripts/verify-stage-4.mjs    # SSR 全链路 28 项
```

负向探针（验证规则活着）：向 `apps/web/src` 临时加入 `<button>`、`#ff0000`、`style={{}}`，三者应分别被 ESLint 与 `check:tokens` 拒绝，验证后删除。

## 6. 常见任务（step-by-step）

### 6.1 新增一个页面组件

1. 组件放 `apps/web/src/components/<域>/<Name>.tsx`（PascalCase），样式 `<Name>.module.css`。
2. 只用适配层组件与语义 Token；文案走 i18n（见 [02](02-app-routing-i18n-seo.md) §6.1）。
3. 跑 `pnpm check:tokens && pnpm --filter @itools/web test`。

### 6.2 需要适配层还没有的能力

1. 在 `packages/design-system-adapter/src/components/` 加包装（不复制基础组件），`forwardRef` 透传公开 props。
2. 在 `src/index.ts` 导出组件与 Props 类型；补适配层测试。
3. 应用代码仍只从包根导入；不得绕过。

### 6.3 调整主题种子或形状

1. 种子色只改 `theme/` 内 `APP_THEME_SEED`；形状只改 `styles.css` 的 `--itools-shape-*`。
2. 同步本文 §1.1 表格；跑适配层与 web 测试、`verify-stage-4.mjs` 确认 SSR。

## 7. 已知限制与相关决策

- 无视觉回归工具（Playwright 截图对比属阶段 11）；不得声称做过像素级验收。
- `PreviewBadge` 用 `aria-hidden`（避免改变按钮/对话框可访问名称）；导航中无等价读屏文本，属已知取舍。
- 主题偏好不持久化（刷新回浅色）；持久化待产品决定。
- Symbols 只加载静态 400 字重，不承诺 FILL/GRAD/opsz 可变轴。
- 升级 `m3-expressive-react` / MCU / 字体包前必须：核对 `src/index.ts` 导出与 Props/ref 兼容、Provider 颜色角色差异、SSR（`ssr.noExternal` 需含 `m3-expressive-react` 与 `@material/material-color-utilities`，见 [00](00-architecture-overview.md) §5），再跑适配层与 web 测试。
- 相关决策：D08、D15、D21、D34，全文见 [13](13-acceptance-open-decisions.md)。
