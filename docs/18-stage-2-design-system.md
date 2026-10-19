# 18 · 阶段 2：应用壳与设计系统交接

> 当前代码交接指南，依据 `apps/web` 与 `packages/design-system-adapter`。阶段 2 的视觉和交互验收已完成；本轮文档更新没有重跑测试、构建或浏览器验收。阶段 3 尚未启动。所有页面和目录仍是前端预览，不代表真实工具执行、持久化、认证或后端服务已实现。

## 新 Agent 从哪里开始

1. 先读本指南和 [适配层说明](../packages/design-system-adapter/README.md)。
2. 应用入口在 `apps/web/src/main.tsx`，全局样式只从 `@itools/design-system-adapter/styles.css` 引入。
3. `App.tsx` 持有内存中的 `route`、`themeMode` 和搜索开关；`AppRoute` 是 `home`、`category`、`tool`、`tasks`、`admin` 五种联合类型。刷新会回到首页和浅色主题，没有 URL 路由或持久化。
4. `components/app-shell/` 管共享壳、紧凑视口检测、分类手风琴和工具详情 Dialog；`components/tool-search-entry/ToolSearchEntry.tsx` 是首页与顶部栏共用的 SearchBar；`components/command-palette/` 实现搜索对话框。
5. `data/sample-catalog.ts` 是唯一展示目录及任务样本来源。修改预览数据从此处开始；勿把静态样本描述成已执行结果。

## 当前壳层行为

- `AppShell` 在 840px 以下切换为紧凑布局，顶部栏只显示共享 SearchBar。leading 图标只打开分类抽屉；主题切换、管理预览、最近任务入口在抽屉中。840px 及以上显示品牌、SearchBar、最近任务面板、主题和管理预览，分类导航固定在侧栏。
- `ToolAccordionNavigation` 在桌面侧栏和移动抽屉复用。分类按钮只展开/收起该组，可同时展开多个分类；它本身不跳转到分类页。工具行打开 `ToolInfoDialog`，其中“关闭”留在当前页面，“前往”才进入对应工具页。进入分类或工具路由时，其分类会自动展开。
- 移动 SearchBar 的菜单位于 leading slot；抽屉内含主题、管理和最近任务（进入任务页）操作。桌面最近任务图标显示面板，面板可打开样本工具或进入任务页。
- 点击 SearchBar 或按 Enter 打开命令面板；Ctrl/Cmd+K 全局打开。面板支持名称、简介、分类检索，方向键选择，Enter 进入工具页并关闭命令面板；Escape 关闭 Dialog 并恢复焦点。搜索入口本身只读，不直接输入。分类手风琴中的工具行则打开 `ToolInfoDialog`，由用户选择“关闭”或“前往”。
- 主题状态是 `App` 中的 React state，初值浅色，点击后即时切换；没有用户偏好存储。`AppThemeProvider` 以 `#009688` 生成主题角色。
- 桌面品牌图标、图标按钮底板为圆形；品牌标记 32px，通用矩形角 32px，工具详情 Dialog 48px，SearchBar full 圆角 9999px。此处是当前实现约定；视觉细节以源码和下方最终截图为准。
- 源码支持系统 `prefers-reduced-motion: reduce`，会将适配层动效时长归零并关闭应用自有的部分动画。产品目前没有提供用户可切换的“减少动态效果”设置。

## 数据和页面边界

首页、分类页、工具页、任务页与管理页由 `App.tsx` 按内存路由选择。样本目录包含五个分类、六个工具和三条示例任务，定义在 `apps/web/src/data/sample-catalog.ts`。表单、任务状态和结果区用于展示布局与反馈；工具执行、目录保存、管理员认证都不在当前实现范围内。搜索、导航、主题和抽屉状态也都在浏览器内存中。

## 阶段 2 当前验收证据

以下四张为当前最终移动搜索导航验收截图，位于 `docs/assets/stage-2/`：

| 状态                | 截图                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| 桌面首页            | [search-desktop-home.png](assets/stage-2/search-desktop-home.png)             |
| 移动首页            | [search-mobile-home.png](assets/stage-2/search-mobile-home.png)               |
| 移动深色导航抽屉    | [search-mobile-drawer-dark.png](assets/stage-2/search-mobile-drawer-dark.png) |
| 移动工具详情 Dialog | [search-mobile-tool-dialog.png](assets/stage-2/search-mobile-tool-dialog.png) |

历史浏览器验收记录覆盖 1280×900 桌面、840×900 断点、390×844 移动及 320×844 窄屏；记录包含抽屉开合、搜索键盘交互和视口无横向溢出。历史测试汇总为 22 项（contracts 4、adapter 9、app 9），build、lint、typecheck、format、依赖边界检查及 `git diff --check` 曾通过。这些是先前阶段验收记录，不是本次文档修改后新执行的验证。目录中其余阶段 2 截图均为旧版本留档，不作为当前状态证据。
