# 18 · 阶段 2 设计系统与全局应用壳

> 状态：已通过阶段 2 验收。日期：2026-10-19。设计参考为用户指定的 `@material-3`；当前工具无法读取该私有插件内容，因此组件语义、配色和自适应设计以 [Material 3 官方规范](https://m3.material.io/)核对，待插件可访问时再对照复核。阶段 2 只实现可操作界面预览，不声称 SSR、数据库目录、工具计算或管理员认证已完成。

## 目标与页面结构

| 页面 | 主任务 | 阶段 2 预览内容 |
| --- | --- | --- |
| 首页 | 找到工具并了解分类 | 搜索入口、五类工具、最近任务入口、展示样本 |
| 分类页 | 浏览分类下的工具 | 分类标题、列表/卡片与空状态 |
| 工具页 | 理解统一处理流程 | 标题简介、输入区、主工作区、任务区、结果区、页面末尾的规范/开源致谢 |
| 管理后台 | 查看目录管理体验 | 单管理员的工具状态、元数据编辑表单与反馈样本；不执行写入 |

桌面（840 px 及以上）使用持久分类侧栏；窄屏（840 px 以下）在顶栏最右侧显示文字“展开”，打开复用同一内容的导航抽屉。侧栏和抽屉以手风琴同时展示多个已展开分类及其工具行。搜索命令面板需支持点击、键盘触发、方向键与 Enter；最近任务有轻量面板与“查看全部”预览入口。首页、搜索、最近任务、主题切换和后台入口跨断点保留。所有样本数据在 `apps/web` 中明确标为界面预览，不建立工具注册表或伪造真实处理结果。

## 主组件库与依赖选择

`m3-expressive-react@1.6.0` 作为主 React MD3 组件库，锁定精确版本并包在 `@itools/design-system-adapter` 后。它提供主题、按钮、输入、对话框、导航、反馈和进度组件。选择依据是其当前 MD3 组件覆盖与近期维护；低社区采用、单维护者和快速更新是已知依赖风险。阶段 2 必须通过实际构建、交互测试和桌面/移动视觉检查，不依赖版本声明推断质量。

`@material/material-color-utilities@0.4.0` 用于固定洋红主题来源；字体与 Material Symbols Rounded 从 Fontsource 包打包为站点本地资源，不引入运行时字体 CDN。库与字体版本见各包清单及 `pnpm-lock.yaml`。主应用不得直接依赖 `m3-expressive-react`。

## 已冻结的包接口与所有权

| 所有者 | 允许修改 | 必须提供的公开接口 |
| --- | --- | --- |
| 设计系统子任务 | `packages/design-system-adapter/src/**`，该包内测试与说明 | `AppThemeProvider`（`mode: 'light' | 'dark'`、`children`），`MaterialIcon`；从主库经单一入口转出实际使用的 `Button`、`IconButton`、`TextField`、`Dialog`、`Card`、`NavigationDrawer`、`NavigationDrawerItem`、`NavigationRail`、`NavigationRailItem`、`SnackbarProvider`、`useSnackbar`、`LinearProgressIndicator`、`CircularProgressIndicator`、`Switch`、`Chip` 等。`./styles.css` 为唯一全局样式入口。 |
| 应用壳子任务 | `apps/web/src/**`、`apps/web/index.html`、`apps/web/vite.config.ts`、该应用内测试 | 只通过 `@itools/design-system-adapter` 导入基础 UI；实现首页、分类、工具、后台及共享壳的预览，不添加真实后端或工具执行。 |
| 根 Agent | 根配置、包清单与锁文件、文档、集成、视觉验收 | 处理跨包接口、依赖冲突、测试与最终阶段验收。 |

子任务不得修改对方的目录、根清单或锁文件。包内 React 组件文件使用 `PascalCase.tsx`，其余文件和目录沿用 `kebab-case`；公开入口统一在 `src/index.ts`。

## 主题 Token 约束

- 固定种子色：`#E5007D`。浅色/深色语义色通过 Material Color Utilities 的 `SchemeVibrant`（2025 规范、对比度级别 0）生成；包括 primary/secondary/tertiary、surface 各层、outline、error、inverse、fixed 等角色。页面只引用语义变量，不散布色值。
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

### 导航视觉迭代记录

- 桌面侧栏宽度增至 `18.5rem`，使用持久手风琴层级。分类展开后以空间过渡显示工具列表；箭头同步旋转，工具行提供 state layer、键盘焦点和 48 px 触控高度。多分类可以同时展开。
- 840 px 以下，顶栏重排为品牌与最右侧“展开”按钮在首行，搜索、最近任务、主题与后台入口在第二行；抽屉复用同一手风琴。600 px 与 840 px 的适配继续使用共享断点。
- 工具详情通过主库 Dialog 展示分类、简介和元数据，并以“关闭”和“前往”作为对应操作。关闭由 Dialog 的标准行为负责，进入动效由内容层级变化表达。
- 页面组合只使用 `--md-sys-color-*`、`--md-sys-typescale-*`、现有形状/间距/动效 Token；新增导航宽度、行高、图标、焦点环、state-layer opacity 与按压/对话框进入 scale token 记录在适配层 README。分类和对话框动效遵循 `prefers-reduced-motion`；抽屉开合继续由主库 NavigationDrawer 负责。
- 阶段 2 原截图仍保留原版导航样式，作为原验收记录。集成版本已于 2026-10-19 完成当前导航迭代的视口复查：1280×720 桌面侧栏可同时展开两个分类；390×844 移动端首行最右显示“展开”，抽屉中也可同时展开两个分类。工具详情适配窄屏；关闭详情后首页保持不变，重开抽屉会保留分类展开状态。截图见下表。

## 阶段验收

| 验收项 | 状态 | 证据 |
| --- | --- | --- |
| Token、组件适配层与使用说明 | 通过 | `packages/design-system-adapter/README.md` 列出 53 个浅/深语义色角色、间距、断点、形状、动效、字体来源和组件示例；`src/index.ts` 为唯一公开入口，`src/styles.css` 为唯一全局样式入口。 |
| 四类页面的桌面与移动布局 | 通过 | 在 1280×720 桌面与 537×1039 窄屏浏览器中检查首页、分类、工具和后台；桌面侧栏可收起，窄屏抽屉可选分类。截图见下表。 |
| 关键控件交互与错误反馈测试 | 通过 | `pnpm test`：契约 4、适配层 6、应用 5 项通过。应用测试覆盖快捷搜索键盘选择、桌面与窄屏导航、最近任务入口、后台开关/表单/对话框反馈。 |
| 主题、导航、表单、对话框、任务和结果视觉检查 | 通过 | 浅/深主题、搜索和导航、工具页输入错误、任务进度/空结果、后台对话框及错误反馈均已浏览器检查；修正深色首页次要按钮对比度和收起侧栏横向滚动后复查。浏览器无 error/warn 日志。 |
| 格式、Lint、类型、测试、构建与依赖边界 | 通过 | 主工作区 `pnpm install --frozen-lockfile`、`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm peers check` 均通过；`lint` 包含 `check:boundaries`。 |
| 是否进入阶段 3 | 可以 | 阶段 2 硬性项已通过；下一阶段再实现真实路由、SSR、双语与 SEO。 |

### 视觉检查留档

| 视口与状态 | 截图 | 观察 |
| --- | --- | --- |
| 桌面首页 · 浅色 | [desktop-home-light.png](assets/stage-2/desktop-home-light.png) | 展开侧栏、主视觉、分类网格与工具卡片在 1280×720 下排列正常。 |
| 桌面后台 · 深色 | [desktop-admin-dark.png](assets/stage-2/desktop-admin-dark.png) | 收起侧栏、目录开关与元数据表单双栏正常，无横向滚动条。 |
| 窄屏首页 · 浅色与深色 | [mobile-home-light.png](assets/stage-2/mobile-home-light.png)、[mobile-home-dark.png](assets/stage-2/mobile-home-dark.png) | 导航折入抽屉、主视觉单栏、次要按钮可辨读。 |
| 窄屏工具页 · 浅色 | [mobile-tool-light.png](assets/stage-2/mobile-tool-light.png) | 输入、主工作区、任务、结果与致谢按约定顺序纵向排列。 |
| 窄屏后台对话框 · 浅色 | [mobile-admin-dialog-light.png](assets/stage-2/mobile-admin-dialog-light.png) | 对话框、表单与取消/校验操作正常；错误文案可见。 |
| 当前桌面手风琴导航 · 1280×720 | [desktop-accordion-navigation.png](assets/stage-2/desktop-accordion-navigation.png) | 两个分类可同时展开，工具行显示正常。 |
| 当前移动手风琴抽屉 · 390×844 | [mobile-accordion-drawer.png](assets/stage-2/mobile-accordion-drawer.png) | 首行最右为“展开”；抽屉内两个分类可同时展开，重开时保留展开状态。 |
| 当前移动工具详情 Dialog · 390×844 | [mobile-tool-detail-dialog.png](assets/stage-2/mobile-tool-detail-dialog.png) | 详情适配窄屏；关闭后首页保持不变。 |

浏览器检查还实际操作了分类选择、搜索面板开关、最近任务面板及“查看全部”、工具输入错误和后台表单错误。预览里的任务进度与结果状态均是明确标记的静态样本。当前构建输出包含打包的本地字体资源；字体体积和页面性能预算留到阶段 11 建立真实基线后再评估。

