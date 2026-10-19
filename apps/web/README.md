# Web 界面预览

`apps/web` 是 React 19 与 Vite 构建的客户端界面样本，使用工作区包 `@itools/design-system-adapter`。它展示阶段 2 的应用壳与样本页面，不是已接入后端的完整产品。

## 入口与状态

- `index.html` 加载 `/src/main.tsx`；`main.tsx` 引入适配包样式并挂载 React。
- `App.tsx` 保存当前页面、浅/深色主题和搜索面板开关。页面种类定义在 `src/app/route.ts`：首页、分类、工具、任务和管理预览。导航只更新 React state，不改变浏览器 URL；刷新会回到首页，主题也不会保存。
- `src/data/sample-catalog.ts` 提供样本分类、工具目录和任务信息。搜索、任务状态、管理表单及开关均为界面演示数据，没有真实工具执行或服务端存储。

## 页面和交互

- 首页、分类和工具详情位于 `src/pages/home`、`src/pages/category`、`src/pages/tool`；任务样本页位于 `src/pages/tasks`，管理界面样本位于 `src/pages/admin`。
- `src/components/app-shell` 提供共享顶部栏、桌面分类侧栏和窄屏导航抽屉。窄屏时，顶部搜索栏中的菜单按钮打开分类抽屉；抽屉还提供主题切换、最近任务入口和管理预览入口。桌面顶部栏提供最近任务样本面板、主题切换和管理预览入口。
- `src/components/tool-search-entry/ToolSearchEntry.tsx` 在首页与应用壳复用适配包的 `SearchBar`。点击搜索栏或按 `Ctrl+K` / `Cmd+K` 会打开 `src/components/command-palette` 中的命令面板；方向键选择结果，Enter 打开工具。这里不是独立搜索按钮。
- 工具详情页展示输入区、工作区、任务状态、结果和说明等样本内容。最近任务面板和任务页展示静态任务样本。管理预览提供表单校验、状态开关和新建工具对话框；这些操作不会写入目录或数据库。

## 本地命令

从仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm --filter @itools/design-system-adapter build
pnpm dev
```

适配包的 `dist` 由单独的 build 命令生成，Web 的 `dev` 脚本只启动 Vite。验证 Web 包可运行：

```sh
pnpm --filter @itools/web typecheck
pnpm --filter @itools/web test
pnpm --filter @itools/web build
```

## 修改边界

- 页面内容与编排在 `src/pages`；应用壳与导航行为在 `src/components/app-shell`；样本目录在 `src/data/sample-catalog.ts`。
- 搜索入口在 `src/components/tool-search-entry`，命令面板在 `src/components/command-palette`。底层 `SearchBar`、主题、组件样式与通用组件属于 `packages/design-system-adapter`；需要改适配包时应在该包实现，不要在 Web 中复制一套基础组件。
- Web 自有样式放在相邻 CSS Module。检查现有包边界与架构要求后再引入依赖或跨包接口；阶段 2 预览不应被描述成已经具备真实执行、持久化或认证能力。

## 回归建议

改动应用壳、路由或搜索时，检查首页到分类/工具的导航、`Ctrl+K` / `Cmd+K` 搜索和键盘选择、最近任务到工具或全部任务的跳转，以及窄屏抽屉打开/关闭和菜单操作。改动页面或样本目录时，检查无效工具/分类的空状态、工具页各样本区块和管理表单校验。涉及响应式样式时，同时查看桌面与窄屏布局。根据改动范围运行上面的包级 typecheck、test、build 命令。
