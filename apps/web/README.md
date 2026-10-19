# Web 应用（SSR + 客户端水合）

`apps/web` 是 React 19 + Vite 的 iTools 前端，负责人 React 组件、URL 路由、双语页面、SEO head 与 SSR 渲染函数。它由 `apps/server` 通过 Fastify 托管；不再有独立的内存路由入口。

## 入口

- `index.html`：SSR 模板，包含 `<!--app-head-->`、`<!--app-html-->` 与开发入口 `/src/entry-client.tsx`。
- `src/entry-client.tsx`：浏览器入口，读取 `<html lang>` 与 `location.pathname`，用 `hydrateRoot` 挂载 `<App>`，并引入一次适配层全局样式。
- `src/entry-server.tsx`：SSR 入口，导出 `render()`、`listSitemapUrls()`、`supportedLocales`、`defaultLocale`，供 `apps/server` 加载（开发经 Vite `ssrLoadModule`，生产加载 `dist/server/entry-server.js`）。
- `src/App.tsx`：应用壳组合；持有 locale/route/theme/search 状态，提供 `AppNavigationProvider` 与 `I18nextProvider`。

## 路由与数据

- 路由规则在 `src/app/route.ts`：`/{locale}`、`/{locale}/{category}`、`/{locale}/{category}/{toolId}`、`/{locale}/tasks`、`/{locale}/admin`。未知语言、未知分类、停用工具和分类不匹配都解析为 `not-found`（HTTP 404）。
- 客户端导航使用 `history.pushState`，并监听 `popstate`；没有引入额外路由库。
- 目录数据与 i18n 资源来自工作区包 `@itools/app-core`：分类、工具、示例任务、`createI18n` 和资源都在该包内，Web 不维护副本。
- SEO 由 `src/app/seo.ts` 生成：`title`、`description`、`canonical`、`zh-CN`/`en`/`x-default` 链接；404、任务页和管理页输出 `robots noindex`。

## 构建与运行

```sh
# 仓库根目录；会先构建 contracts / app-core / adapter，再启动 Fastify + Vite middleware
pnpm dev

# 生产构建：dist/client（浏览器）与 dist/server（SSR）
pnpm --filter @itools/web build

# 包级检查
pnpm --filter @itools/web typecheck
pnpm --filter @itools/web test
```

`vite.config.ts` 的 `ssr.noExternal` 必须包含 `@itools/app-core`、`@itools/design-system-adapter`、`m3-expressive-react`、`@material/material-color-utilities`；否则 Vite SSR 无法解析 `@material/material-color-utilities` 的扩展名省略导入。

## 修改边界

- 页面与展示组件在 `src/pages` 与 `src/components/{catalog,page-chrome,app-icon}`；壳层、搜索、最近任务与导航在 `src/components/{app-shell,command-palette,recent-tasks,tool-search-entry}`。
- 页面的导航与搜索统一走 `src/app/navigation.tsx` 的 `useAppNavigation()`；不要在页面里直接操作 `history`。
- 基础 UI 组件、主题与字体属于 `packages/design-system-adapter`；分类、工具、示例任务与 i18n 文案属于 `packages/app-core`。Web 不复制这两层。
- 所有可见文案必须来自 i18next 或目录双语字段；新增文案时中英同时补齐。英文页面不得出现中文字符。
- 当前仍没有真实工具执行、数据库、认证、IndexedDB、任务运行时或 PWA；不要把这些能力写成已实现。
