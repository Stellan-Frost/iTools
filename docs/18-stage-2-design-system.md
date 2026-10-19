# 18 · 阶段 2 设计系统与全局应用壳

> 状态：阶段 2 基线、2026-10-19 鸭青主题、壳层视觉迭代与图标顶栏最终复查均已完成。阶段 3 尚未启动，等待用户下一步指示。设计参考为用户指定的 `@material-3`；当前工具无法读取该私有插件内容，因此组件语义、配色和自适应设计以 [Material 3 官方规范](https://m3.material.io/)核对，待插件可访问时再对照复核。阶段 2 只实现可操作界面预览，不声称 SSR、数据库目录、工具计算或管理员认证已完成。

## 目标与页面结构

| 页面 | 主任务 | 阶段 2 预览内容 |
| --- | --- | --- |
| 首页 | 找到工具并了解分类 | 搜索入口、五类工具、最近任务入口、展示样本 |
| 分类页 | 浏览分类下的工具 | 分类标题、列表/卡片与空状态 |
| 工具页 | 理解统一处理流程 | 标题简介、输入区、主工作区、任务区、结果区、页面末尾的规范/开源致谢 |
| 管理后台 | 查看目录管理体验 | 单管理员的工具状态、元数据编辑表单与反馈样本；不执行写入 |

桌面（840 px 及以上）使用持久分类侧栏；窄屏（840 px 以下）在顶栏最右侧显示菜单图标，打开复用同一内容的导航抽屉。顶栏品牌只显示品牌图标；搜索入口显示搜索图标与“搜索工具”文字，不显示快捷键提示；最近任务、主题切换、管理预览和窄屏导航均只显示图标，并提供准确的无障碍名称。窄至 420 px 以下时，搜索与菜单留在首行，最近任务、主题和管理图标在第二行靠右排列；420 px 及以上采用单行布局。所有顶栏控件目标尺寸为 48 px。侧栏和抽屉以手风琴同时展示多个已展开分类及其工具行。搜索命令面板需支持点击、Ctrl/Cmd+K 键盘触发、方向键与 Enter；最近任务有轻量面板与“查看全部”预览入口。首页、搜索、最近任务、主题切换和后台入口跨断点保留。所有样本数据在 `apps/web` 中明确标为界面预览，不建立工具注册表或伪造真实处理结果。

## 主组件库与依赖选择

`m3-expressive-react@1.6.0` 作为主 React MD3 组件库，锁定精确版本并包在 `@itools/design-system-adapter` 后。它提供主题、按钮、输入、对话框、导航、反馈和进度组件。选择依据是其当前 MD3 组件覆盖与近期维护；低社区采用、单维护者和快速更新是已知依赖风险。阶段 2 必须通过实际构建、交互测试和桌面/移动视觉检查，不依赖版本声明推断质量。

`@material/material-color-utilities@0.4.0` 用于固定鸭青主题来源；字体与 Material Symbols Rounded 从 Fontsource 包打包为站点本地资源，不引入运行时字体 CDN。库与字体版本见各包清单及 `pnpm-lock.yaml`。主应用不得直接依赖 `m3-expressive-react`。

## 已冻结的包接口与所有权

| 所有者 | 允许修改 | 必须提供的公开接口 |
| --- | --- | --- |
| 设计系统子任务 | `packages/design-system-adapter/src/**`，该包内测试与说明 | `AppThemeProvider`（`mode: 'light' | 'dark'`、`children`），`MaterialIcon`；从主库经单一入口转出实际使用的 `Button`、`IconButton`、`TextField`、`Dialog`、`Card`、`NavigationDrawer`、`NavigationDrawerItem`、`NavigationRail`、`NavigationRailItem`、`SnackbarProvider`、`useSnackbar`、`LinearProgressIndicator`、`CircularProgressIndicator`、`Switch`、`Chip` 等。`./styles.css` 为唯一全局样式入口。 |
| 应用壳子任务 | `apps/web/src/**`、`apps/web/index.html`、`apps/web/vite.config.ts`、该应用内测试 | 只通过 `@itools/design-system-adapter` 导入基础 UI；实现首页、分类、工具、后台及共享壳的预览，不添加真实后端或工具执行。 |
| 根 Agent | 根配置、包清单与锁文件、文档、集成、视觉验收 | 处理跨包接口、依赖冲突、测试与最终阶段验收。 |

子任务不得修改对方的目录、根清单或锁文件。包内 React 组件文件使用 `PascalCase.tsx`，其余文件和目录沿用 `kebab-case`；公开入口统一在 `src/index.ts`。

## 主题 Token 约束

- 固定种子色：`#009688`（鸭青）。浅色/深色采用 Material Color Utilities 的 `SchemeVibrant`（2025 规范、对比度级别 0）生成完整语义角色；每个模式均包含 primary/secondary/tertiary、surface 各层、outline、error、inverse、fixed/dim 等角色。浅深模式 role 值以 `packages/design-system-adapter/README.md` 的 MCU 输出表为准；页面只引用语义变量，不散布色值。
- 适配层应保留 `--md-sys-color-*` 的角色关系，并集中定义站点间距、断点、最大宽度、形状、字号与动效 Token。`prefers-reduced-motion` 禁用非必要动效。
- 英文使用 Roboto，中文使用 Noto Sans SC，图标使用本地 Material Symbols Rounded。通过 CSS 字体栈和本地资源加载，不请求第三方字体服务。
- 禁止局部 CSS 覆盖主库基础组件内部类；应用 CSS 只负责页面布局与组合。

### 布局 Token 接口

| 类别 | 公开变量 | 用途 |
| --- | --- | --- |
| 间距 | `--itools-space-{1,2,3,4,5,6,8,10,12,16}` | 分别为 0.25、0.5、0.75、1、1.25、1.5、2、2.5、3、4 rem；页面组合只用这些间距级别。 |
| 内容宽度 | `--itools-layout-content-max`、`--itools-layout-readable-max` | 分别为 80 rem、72 ch；宽屏内容与正文阅读宽度。 |
| 形状 | `--md-sys-shape-corner-{none,extra-small,small,medium,large,extra-large,full}` | 页面组合与主库遵守同一形状级别。 |
| 自适应 | compact 600 px、medium 840 px、expanded 1200 px、large 1600 px | CSS 媒体查询使用这些固定阈值；CSS 自定义属性不能直接用于媒体查询。 |

排版沿用 `--md-sys-typescale-*`，语义色沿用 `--md-sys-color-*`。适配层 README 是各 Token 的实际取值和示例的单一来源；此表冻结应用可用的命名接口。

壳层矩形轮廓统一使用 `--itools-shape-corner-rectangle`，当前项目映射为 32 px。此前鸭青主题验收截图展示的 48 px 外观属于历史版本，不代表当前 Token 值。胶囊和圆形按钮继续使用各自形态；短控件依照其实际尺寸自然限制圆角，避免为匹配较大圆角而增加无意义高度。壳层文字均引用 `--md-sys-typescale-*` 语义角色。

### 导航视觉迭代记录

- 桌面侧栏宽度增至 `18.5rem`，使用持久手风琴层级。分类展开后以空间过渡显示工具列表；箭头同步旋转，工具行提供 state layer、键盘焦点和 48 px 触控高度。多分类可以同时展开。
- 展开的分类组整体使用 `secondary-container` / `on-secondary-container` 成对角色；强调面从分类标题延续到内含工具列表，悬停、焦点、按压与工具图标仍使用同一语义前景角色。空间展开、列表渐显、逐行进入和箭头旋转保留；减少动态效果设置会关闭这些非必要动效。
- `page-chrome/MetadataChip` 用于首页目录摘要、分类/工具卡片、标题上下文、任务页、管理目录/元数据、工具页与详情中的静态元数据标签。标签仅用于适合压缩呈现的 metadata，不承诺所有元数据均显示为 chip；正文内容和样本输入继续用可读文本。
- Favicon 与品牌 Logo 沿用原稿资源（代理复核 SHA-256 与源文件匹配）；功能图标继续使用本地 Material Symbols Rounded 字体，不以品牌图替代功能符号。
- 顶栏以图标呈现品牌、最近任务、主题、管理预览和窄屏导航，搜索保留图标与“搜索工具”文字。搜索快捷键 Ctrl/Cmd+K 仍有效，但不在顶栏展示键位提示。窄屏菜单图标固定在顶栏右端并打开导航抽屉；抽屉复用同一手风琴。420 px 以下改为紧凑两行，420 px 及以上保持单行，所有控件目标为 48 px。功能入口不丢失。600 px 与 840 px 的适配继续使用共享断点。
- 工具详情通过主库 Dialog 展示分类、简介和元数据，并以“关闭”和“前往”作为对应操作。关闭由 Dialog 的标准行为负责，进入动效由内容层级变化表达。
- 页面组合只使用 `--md-sys-color-*`、`--md-sys-typescale-*`、现有形状/间距/动效 Token；新增导航宽度、行高、图标、焦点环、state-layer opacity 与按压/对话框进入 scale token 记录在适配层 README。分类和对话框动效遵循 `prefers-reduced-motion`；抽屉开合继续由主库 NavigationDrawer 负责。
- 阶段 2 原截图均保留原版顶栏样式，作为历史验收记录，不代表本轮图标式顶栏。图标顶栏已完成桌面、390 px 与 320 px 的浏览器复查，截图和实测结果见下方最终验收记录。窄屏菜单位于顶栏最右端并打开抽屉；工具详情可关闭，关闭后首页保持不变，重开抽屉会保留分类展开状态。

## 阶段验收

| 验收项 | 状态 | 证据 |
| --- | --- | --- |
| Token、组件适配层与使用说明 | 通过 | `packages/design-system-adapter/README.md` 列出 53 个浅/深语义色角色、间距、断点、形状、动效、字体来源和组件示例；`src/index.ts` 为唯一公开入口，`src/styles.css` 为唯一全局样式入口。 |
| 双端布局与响应式顶栏 | 通过 | 在 1280×900 桌面和 390×844 移动浏览器中复查首页、导航、搜索和工具详情；另在 320 px 与 420 px 宽度检查顶栏适配及横向溢出。截图见最终验收记录。 |
| 关键控件交互与错误反馈测试 | 通过 | 最终 `pnpm test`：契约 4、适配层 8、应用 8 项，共 20 项通过。应用测试覆盖快捷搜索键盘选择、桌面与窄屏导航、最近任务入口、后台开关/表单/对话框反馈。 |
| 主题、导航、表单、对话框、任务和结果视觉检查 | 通过 | 浅/深主题、搜索和导航、工具页输入错误、任务进度/空结果、后台对话框及错误反馈均已浏览器检查；修正深色首页次要按钮对比度和收起侧栏横向滚动后复查。浏览器无 error/warn 日志。 |
| 格式、Lint、类型、测试、构建与依赖边界 | 通过 | 阶段 2 初始基线门禁见原记录；鸭青主题本轮门禁摘要见下方最终验收。 |
| 是否进入阶段 3 | 等待用户下一步 | 阶段 2 验收已完成；本轮不启动阶段 3。 |

### 2026-10-19 鸭青主题与初始壳层验收（历史记录）

- **视口与布局：通过。** 在 1280×900 检查桌面浅/深主题；在 390×844 检查移动首页、模态导航抽屉和工具详情。600 px 与 840 px 断点无横向溢出；840–999 px 的 hero 使用单列布局。
- **导航与工具流程：通过。** 桌面侧栏和移动抽屉均能同时展开多个分类；移动展开按钮保留在顶栏最右。选择工具先显示 Dialog，选择“前往”后进入工具页，“关闭”后仍停留在首页。品牌 img 已加载，Favicon href 正确，品牌资源 SHA-256 与原稿一致。
- **圆角与元数据：历史状态。** 此轮浏览器记录的 hero 与手风琴 group 48 px 圆角已被后续 Token 调整替代；当前值和截图以图标顶栏最终复查为准。Chip 只呈现静态元数据，不伪装成按钮；正文和样本输入保留可读文本。
- **质量门禁：通过。** `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm peers check` 与 `git diff --check` 全部通过；18 项测试通过（契约 4、适配层 6、应用 8）。主题 19 组语义色对比组合均通过 AA；主按钮对比度为浅色 6.08:1、深色 6.06:1。

本轮视觉截图（历史版本，旧顶栏与 48 px 鸭青圆角）：

| 视口与状态 | 截图 |
| --- | --- |
| 桌面首页 · 浅色 · 1280×900 | [teal-desktop-home.png](assets/stage-2/teal-desktop-home.png) |
| 桌面首页 · 深色 · 1280×900 | [teal-desktop-dark.png](assets/stage-2/teal-desktop-dark.png) |
| 移动首页 · 390×844 | [teal-mobile-home.png](assets/stage-2/teal-mobile-home.png) |
| 移动导航抽屉 · 390×844 | [teal-mobile-drawer.png](assets/stage-2/teal-mobile-drawer.png) |
| 移动工具详情 Dialog · 390×844 | [teal-mobile-dialog.png](assets/stage-2/teal-mobile-dialog.png) |

### 图标顶栏与最终适配验收

- **布局与目标尺寸：通过。** 在 1280×900 桌面和 390×844 移动视口中，顶栏除带搜索图标的“搜索工具”外无其它可见文字。图标按钮和搜索控件目标为 48 px；420 px 起单行，≤419 px 两行。320 px 与 420 px 下均实测 `clientWidth == scrollWidth`，无横向溢出；840 px 起显示桌面导航。
- **形状：通过。** 全局 hero 与 group 圆角为 32 px；移动 NavigationDrawer 外侧两角为 32 px；ToolInfoDialog 与搜索 Dialog 为 48 px，内部 code 为 32 px。NavigationDrawer 外侧圆角已修正组件库内部固定的 16 px。
- **搜索与导航：通过。** 顶栏快捷键标记和搜索 Dialog 键盘说明均已移除；Ctrl/Cmd+K 仍可打开搜索。图标菜单仍打开抽屉，工具详情仍可关闭。
- **质量门禁：通过。** `pnpm build`、`pnpm test`、`pnpm lint`、`pnpm typecheck` 全部通过，共 20 项测试（契约 4、适配层 8、应用 8）；根 Agent 最终 `pnpm format:check`、`git diff --check` 和 `pnpm peers check` 均通过。
- **阶段状态：完成并等待用户下一步。** 本轮不启动阶段 3。

本轮图标顶栏截图：

| 视口与状态 | 截图 |
| --- | --- |
| 桌面图标顶栏 · 1280×900 | [topbar-icons-desktop.png](assets/stage-2/topbar-icons-desktop.png) |
| 移动图标顶栏 · 390×844 | [topbar-icons-mobile.png](assets/stage-2/topbar-icons-mobile.png) |
| 移动工具详情 Dialog · 390×844 | [topbar-dialog-mobile.png](assets/stage-2/topbar-dialog-mobile.png) |
| 移动导航抽屉 · 390×844 | [topbar-drawer-mobile.png](assets/stage-2/topbar-drawer-mobile.png) |

### 阶段 2 原版视觉检查留档（历史截图）

以下截图记录原洋红主题与此前文字式顶栏，仅用于回溯旧版本，不作为 2026-10-19 鸭青主题、壳层圆角、手风琴容器或本轮图标式顶栏的验收证据。当前顶栏视口截图见上表。

| 视口与状态 | 截图 | 观察 |
| --- | --- | --- |
| 桌面首页 · 浅色 | [desktop-home-light.png](assets/stage-2/desktop-home-light.png) | 展开侧栏、主视觉、分类网格与工具卡片在 1280×720 下排列正常。 |
| 桌面后台 · 深色 | [desktop-admin-dark.png](assets/stage-2/desktop-admin-dark.png) | 收起侧栏、目录开关与元数据表单双栏正常，无横向滚动条。 |
| 窄屏首页 · 浅色与深色 | [mobile-home-light.png](assets/stage-2/mobile-home-light.png)、[mobile-home-dark.png](assets/stage-2/mobile-home-dark.png) | 导航折入抽屉、主视觉单栏、次要按钮可辨读。 |
| 窄屏工具页 · 浅色 | [mobile-tool-light.png](assets/stage-2/mobile-tool-light.png) | 输入、主工作区、任务、结果与致谢按约定顺序纵向排列。 |
| 窄屏后台对话框 · 浅色 | [mobile-admin-dialog-light.png](assets/stage-2/mobile-admin-dialog-light.png) | 对话框、表单与取消/校验操作正常；错误文案可见。 |
| 当前桌面手风琴导航 · 1280×720 | [desktop-accordion-navigation.png](assets/stage-2/desktop-accordion-navigation.png) | 两个分类可同时展开，工具行显示正常。 |
| 历史移动手风琴抽屉 · 390×844 | [mobile-accordion-drawer.png](assets/stage-2/mobile-accordion-drawer.png) | 旧文字式顶栏截图；抽屉内两个分类可同时展开，重开时保留展开状态。 |
| 当前移动工具详情 Dialog · 390×844 | [mobile-tool-detail-dialog.png](assets/stage-2/mobile-tool-detail-dialog.png) | 详情适配窄屏；关闭后首页保持不变。 |

浏览器检查还实际操作了分类选择、搜索面板开关、最近任务面板及“查看全部”、工具输入错误和后台表单错误。预览里的任务进度与结果状态均是明确标记的静态样本。当前构建输出包含打包的本地字体资源；字体体积和页面性能预算留到阶段 11 建立真实基线后再评估。

