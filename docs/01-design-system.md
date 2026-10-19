# 01 · 设计系统与视觉规范

> 状态：**已实现（阶段 2，阶段 3–4 扩展）**。所有页面经统一适配层使用 MD3。
> 代码入口：`packages/design-system-adapter/src/{index.ts,styles.css,theme/}`。

## 1. 规范来源

- 视觉体系：Material Design 3（Expressive），不使用 MD2。
- 组件库：`m3-expressive-react@1.6.0`，锁定版本，集中封装在 `packages/design-system-adapter`；应用不得直接从该库导入。
- 品牌：鸭青，固定种子色 `#009688`（`APP_THEME_SEED`），使用 MD3 2025 `SchemeVibrant` 生成浅色/深色语义角色。
- 已知风险：该库社区规模小、单维护者；升级前必须跑适配层与页面测试，并复核 SSR。

## 2. 主题与 Token

- `AppThemeProvider` 生成完整颜色角色，并映射为 CSS 自定义属性。
- 应用代码只允许引用语义变量：`--md-sys-color-*`、`--md-sys-typescale-*`、`--md-sys-shape-*`、`--itools-*`。
- 禁止散落硬编码品牌色、间距、圆角、阴影、动效时长；当前 Web CSS 中没有十六进制颜色（主题种子除外）。
- 形状：
  - 固定矩形圆角：`--itools-shape-corner-rectangle` = 32px。
  - Dialog 主表面：`--itools-shape-corner-dialog` = 48px。
  - 胶囊 / 圆形：`full`。IconButton 在适配层强制圆形，覆盖库的按压 shape morph。
- 字体：英文 Roboto、中文 Noto Sans SC、Material Symbols Rounded，均通过 `@fontsource*` 本地托管；文本只使用 MD3 Display/Headline/Title/Body/Label × Large/Medium/Small 十五个 typescale 角色。
- 动效：统一时长/缓动变量（`--itools-motion-*`），尊重 `prefers-reduced-motion: reduce`；适配层与页面都有关闭动画的处理。

## 3. 组件适配层

`@itools/design-system-adapter` 公开：

- 主题：`AppThemeProvider`、`APP_THEME_SEED`、颜色工具。
- 基础组件：Button、IconButton、Card、Chip、Dialog、NavigationDrawer、ListItem、List、SearchBar、TextField、Switch、Tabs、Snackbar 等（对 `m3-expressive-react` 的白名单转发）。
- 图标：`MaterialIcon`。
- 全局样式：`@itools/design-system-adapter/styles.css`，仅在 `entry-client.tsx` 引入一次。

约束：

1. **禁止裸 HTML 控件**：按钮、输入、选择、开关等必须使用适配层组件；链接（`<a>`）与纯展示元素不受此限。
2. 不覆盖组件库内部选择器；布局与间距通过外层容器、组件公开 props 或 `className` 调整。
3. 不复制基础组件；需要新能力时在适配层加包装并在 `index.ts` 导出。
4. 图标按钮统一圆形；独立图标底板使用等宽高 + `full` 圆角，并配对语义前景/容器色。
5. 交互目标至少 48px，键盘焦点可见。

当前实现示例：

- 顶栏品牌入口使用 `IconButton` + 品牌 SVG。
- 分类导航使用 `ListItem`（leading 图标、trailing chevron、`aria-expanded`/`aria-controls` 透传），不再使用裸 `<button>`。
- 预览工具使用共享 `PreviewBadge`（`components/page-chrome`），壳层、卡片、工具页、搜索结果共用同一实现与文案键 `common:availability.preview`。
- 卡片与状态标签使用 `MetadataChip`；预览徽标与分类/状态标签职责分开。

## 4. 响应式与壳层

- 断点：≥840px 桌面侧栏；<840px 紧凑布局 + 模态抽屉；599px 与 1199px 用于页面内部栅格调整。
- 桌面：品牌、搜索、最近任务、主题、语言、管理入口在顶栏；分类手风琴固定在侧栏，可同时展开多个分类。
- 紧凑：顶栏只保留品牌 + 搜索（菜单按钮在搜索栏 leading slot）；抽屉内提供分类、主题、语言、管理、最近任务。
- 分类手风琴只展开/收起，不直接跳分类页；工具行打开 `ToolInfoDialog`，由“前往”进入工具页。
- 搜索入口只读，点击或 `Ctrl/Cmd+K` 打开命令面板；方向键选择，Enter 进入。
- 语言切换保留当前路由，路径切换为另一语言。

## 5. 页面骨架

工具页固定顺序，不可改变语义：

1. 标题与简介（含预览徽标）。
2. 输入区（预览态只读、禁用）。
3. 主工作区（预览态只读示例）。
4. 任务区（预览态仅说明，不伪造进度）。
5. 结果区（预览态仅说明，不伪造输出）。
6. 规范/开源致谢（页面内最后一个板块）。

首页、分类页、任务页、管理页复用 `PageHeading`、`PreviewNotice`、`MetadataChip`、`ToolCard`、`CategoryCard` 等共享展示组件。

## 6. 验证与已知限制

- 适配层 9 项组件测试；Web 61 项测试覆盖壳层、页面、路由、SEO。
- 没有视觉回归工具（Playwright 截图对比属于阶段 11）；不要声称做过像素级验收。
- 不做独立无障碍专项；但不得破坏控件基本交互。已知取舍：`PreviewBadge` 使用 `aria-hidden` 以免改变按钮/对话框的可访问名称，导航中暂无等价屏幕阅读器文本。
- 主题偏好不持久化（刷新回到浅色）；持久化随阶段 5+ 的产品决定处理。
