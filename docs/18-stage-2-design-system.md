# 18 · 阶段 2 设计系统与全局应用壳

> 状态：实施中。日期：2026-10-19。设计参考为用户指定的 `@material-3`；当前工具无法读取该私有插件内容，因此组件语义、配色和自适应设计以 Material 3 官方规范核对。阶段 2 只实现可操作界面预览，不声称 SSR、数据库目录、工具计算或管理员认证已完成。

## 目标与页面结构

| 页面 | 主任务 | 阶段 2 预览内容 |
| --- | --- | --- |
| 首页 | 找到工具并了解分类 | 搜索入口、五类工具、最近任务入口、展示样本 |
| 分类页 | 浏览分类下的工具 | 分类标题、列表/卡片与空状态 |
| 工具页 | 理解统一处理流程 | 标题简介、输入区、主工作区、任务区、结果区、页面末尾的规范/开源致谢 |
| 管理后台 | 查看目录管理体验 | 单管理员的工具状态、元数据编辑表单与反馈样本；不执行写入 |

桌面使用可展开分类侧栏，窄屏使用抽屉。搜索命令面板需支持点击、键盘触发、方向键与 Enter；最近任务有轻量面板与“查看全部”预览入口。所有样本数据在 `apps/web` 中明确标为界面预览，不建立工具注册表或伪造真实处理结果。

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

## 阶段验收

| 验收项 | 状态 | 证据 |
| --- | --- | --- |
| Token、组件适配层与使用说明 | 待验收 | 待填写 |
| 四类页面的桌面与移动布局 | 待验收 | 待填写 |
| 关键控件交互与错误反馈测试 | 待验收 | 待填写 |
| 主题、导航、表单、对话框、任务和结果视觉检查 | 待验收 | 待填写 |
| 格式、Lint、类型、测试、构建与依赖边界 | 待验收 | 待填写 |
| 是否进入阶段 3 | 尚未决定 | 阶段 2 所有硬性项通过后填写 |

