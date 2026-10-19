# 20 · 阶段 3：路由、SSR、国际化与 SEO（冻结与派发）

> **阶段 4 已覆盖部分口径**：可用性由 `enabled: boolean` 改为 `preview / implemented / disabled` 三态；预览页 200 + noindex、不进 Sitemap；停用页仍 404。当前规则以 [23 · 阶段 4 冻结](23-stage-4-freeze.md) 为准。本文其余内容（路由、SSR、i18n、SEO 基础设施）仍是有效依据。

> 状态：2026-10-19 用户确认启动阶段 3、采纳 D06 顺序、范围取全量，并授权在限定文件边界内并行派发实施 Agent。本文是阶段 3 的接口冻结与验收口径；实施结果与证据见 [21 · 阶段 3 验收](21-stage-3-acceptance.md)。
>
> 本文只描述阶段 3 目标与冻结接口，**不代表已实现**。完成证据在阶段验收记录中单独给出。

## 1. 授权与范围

用户决定（2026-10-19）：

1. 启动阶段 3。
2. 采纳 D06 建议：可独立验证部分现在验收，依赖数据库/运行时的完整集成验收推迟到阶段 7 之后。
3. 范围取全量：SSR + 路由 + 国际化 + 真实 404 + Sitemap/robots。
4. 并行派发实施 Agent，但必须遵守本文的文件所有权边界。

阶段 3 交付：

- Fastify 宿主 React SSR，生产环境托管静态资源；开发环境通过 Vite middleware 提供 SSR。
- `/{locale}`、`/{locale}/{category}`、`/{locale}/{category}/{tool-id}`、`/{locale}/tasks`、`/{locale}/admin` 可直达。
- 中英文内容与文案，语言切换保留当前工具。
- 不存在/停用工具、未知分类、未知语言返回真实 HTTP 404。
- SSR 输出 `lang`、`title`、`description`、`canonical`、`hreflang`；动态 `sitemap.xml` 与 `robots.txt`。
- 路由解析、目录可用性、SEO 输出的自动化测试。

不在阶段 3 交付：数据库、管理员认证、真实工具执行、任务运行时、IndexedDB、PWA、CI、部署。这些仍按路线图后续阶段处理。

## 2. 决策记录

| 编号 | 决定 | 理由与边界 |
| --- | --- | --- |
| D06 | 采纳“可独立验证部分前置、完整集成验收移至阶段 7 后”。阶段 3 的目录来源是代码注册表；数据库启用状态、Seed 一致性、CDN 缓存行为不在阶段 3 验收。 | 用户 2026-10-19 确认；写回 `docs/14`、`docs/16`。 |
| D08 | 分类体系采用 `docs/02` 冻结值：`audio`、`image`、`video`、`text`、`other`。阶段 2 预览中的 `image/documents/data/developer/utilities` 仅作界面样本，自阶段 3 起退役。 | `docs/02` 是既定产品要求，`contracts` 的 `ToolManifest.category` 也已使用 `text`。 |
| D09 | 目录数据在阶段 3 由 `@itools/app-core` 的代码注册表提供；服务端与客户端使用同一份数据。DB 目录在阶段 7 接入，届时通过渲染器注入并保持同一 URL 规则。 | 避免阶段 3 依赖不存在的数据库；D06 已明确验收拆分。 |
| D10 | 工具路径必须包含其所属分类；分类与工具不匹配、工具停用或不存在，一律真实 404，不做重定向。 | 单一规范 URL，避免重复内容；重定向矩阵无产品依据，不擅自增加。 |
| D11 | `/` 返回 302 到 `/{DEFAULT_LOCALE}`；非根路径的尾斜杠以 308 去除。 | 默认语言无产品依据做内容协商，固定 `zh-CN`。 |
| D12 | 语言切换使用路由切换：同一工具在另一语言下路径结构一致，切换后停留在当前工具。 | `docs/02` 要求“切换语言时保留对应工具”。 |
| D13 | `/tasks`、`/admin` 页面输出 `noindex`，`robots.txt` 禁止抓取这两个路径；Sitemap 只含首页、分类页和已启用工具。 | 任务页是本地数据、管理页非公开内容。 |
| D14 | HTML 使用 `Cache-Control: public, max-age=0, must-revalidate`；404 使用 `no-store`；Sitemap/robots 使用 `public, max-age=300`；`/assets/*` 使用一年 immutable。 | D03 的 CDN TTL 未定，阶段 3 取保守值；CDN 策略留待部署阶段。 |
| D15 | SSR 必须把 `@itools/design-system-adapter`、`m3-expressive-react`、`@material/material-color-utilities` 放入 `ssr.noExternal`。 | 实测：不内联时 `@material/material-color-utilities` 的扩展名省略导入在 Node ESM 下无法解析，SSR 直接失败。 |
| D16 | 阶段 3 冻结目录、SSR 渲染与语言契约；任务、资产、数据库端口仍不冻结，待阶段 5–7 出现真实第二个实现时再定，避免无调用方的推测性抽象。 | `docs/15` 要求抽象必须有职责、调用方与测试。 |
| D17 | 首页 hero 保留全局搜索入口：`openSearch` 纳入 `AppNavigation` 上下文，页面与壳层共用同一入口；`docs/02` 要求首页首屏含全局搜索。 | 集成阶段发现页面改造丢失首屏搜索，按 `docs/02` 恢复并纳入单一上下文。 |
| D18 | 服务端开发脚本使用 `node --watch-path=./src --import tsx src/index.ts`，只监听 `apps/server/src`。 | 实测 `tsx watch` / 全仓库 `node --watch` 会被 Vite 写入 `node_modules/.vite` 触发无限重启，服务无法监听端口。 |

## 3. 冻结接口

### 3.1 `@itools/contracts`（已写入源码）

```ts
// locale.ts
export const LOCALES = ['zh-CN', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh-CN';
export function isLocale(value: string): value is Locale;

// ssr.ts
export interface SsrRenderRequest {
  url: string; // 路径 + 查询串
  siteOrigin: string; // 例如 https://itools.wataa.men
}
export interface SsrRenderResult {
  statusCode: 200 | 404;
  lang: Locale;
  headHtml: string; // 渲染器负责转义，服务端只替换占位符
  appHtml: string;
}
export interface SsrRenderer {
  readonly supportedLocales: readonly Locale[];
  readonly defaultLocale: Locale;
  render(request: SsrRenderRequest): Promise<SsrRenderResult>;
  listSitemapUrls(siteOrigin: string): Promise<readonly string[]>;
}
```

### 3.2 `@itools/app-core` — catalog

包路径 `packages/app-core/src/catalog/`。纯 TypeScript，不依赖 React 或浏览器 API。

```ts
export type LocalizedText = Record<Locale, string>;
export const CATEGORY_IDS = ['audio', 'image', 'video', 'text', 'other'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CatalogCategory {
  id: CategoryId;
  icon: string; // Material Symbols 名
  order: number;
  name: LocalizedText;
  shortName: LocalizedText;
  description: LocalizedText;
}
export interface ToolWorkspaceLine {
  label: LocalizedText;
  value: string;
}
export interface CatalogTool {
  id: string; // 稳定 kebab-case
  categoryId: CategoryId;
  icon: string;
  order: number;
  enabled: boolean; // 阶段 3 = 代码注册表；阶段 7 起由 DB 决定
  name: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText; // SEO 描述
  preview: {
    inputLabel: LocalizedText;
    sampleInput: LocalizedText;
    workspaceTitle: LocalizedText;
    workspaceLines: readonly ToolWorkspaceLine[];
  };
}
export interface SampleTask {
  id: string;
  toolId: string;
  status: LocalizedText;
  timeLabel: LocalizedText;
}

export const CATEGORIES: readonly CatalogCategory[];
export const TOOLS: readonly CatalogTool[];
export const SAMPLE_TASKS: readonly SampleTask[];

export function isCategoryId(value: string): value is CategoryId;
export function getCategory(categoryId: string): CatalogCategory | undefined;
export function listTools(): readonly CatalogTool[];
export function listEnabledTools(): readonly CatalogTool[];
export function findTool(toolId: string): CatalogTool | undefined;
export function findEnabledTool(toolId: string): CatalogTool | undefined;
export function listEnabledToolsByCategory(categoryId: CategoryId): readonly CatalogTool[];
export function searchEnabledTools(query: string, locale: Locale): readonly CatalogTool[];
/** 只返回首页、分类页和已启用工具；不含 tasks/admin。 */
export function listSitemapPaths(locale: Locale): readonly string[];
```

数据要求：沿用阶段 2 的六个工具（迁移到新分类），另加一个 `enabled: false` 的隐藏工具用于 404 验收；`audio`/`video` 分类允许为空。所有 `LocalizedText` 必须有中英双语，不允许中文回退占位。

### 3.3 `@itools/app-core` — i18n

包路径 `packages/app-core/src/i18n/`。

```ts
export const NAMESPACES = ['common', 'navigation', 'catalog', 'tasks', 'admin'] as const;
export type Namespace = (typeof NAMESPACES)[number];
export function createI18n(locale: Locale): i18next.i18n; // 资源随包内置，initImmediate: false
export { resources } from './resources/index.js';
```

`resources/index.ts` 由根 Agent 冻结，结构：

```ts
export const resources = {
  'zh-CN': { common, navigation, catalog, tasks, admin },
  en: { common, navigation, catalog, tasks, admin },
};
```

### 3.4 `apps/web` 路由与导航

```ts
// app/route.ts
export type AppRoute =
  | { page: 'home' }
  | { page: 'category'; categoryId: CategoryId }
  | { page: 'tool'; toolId: string }
  | { page: 'tasks' }
  | { page: 'admin' }
  | { page: 'not-found' };

export function parseAppPath(pathname: string): { locale: Locale; route: AppRoute };
export function buildAppPath(locale: Locale, route: AppRoute): string;

// app/navigation.tsx
export interface AppNavigation {
  locale: Locale;
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  switchLocale: (locale: Locale) => void;
  openSearch: () => void;
}
export const AppNavigationContext: React.Context<AppNavigation | null>;
export function AppNavigationProvider(props: { value: AppNavigation; children: ReactNode }): ReactNode;
export function useAppNavigation(): AppNavigation;
```

`parseAppPath` 永不抛错：未知语言回到 `DEFAULT_LOCALE` + `not-found`；分类不存在、工具不存在/停用/分类不匹配均为 `not-found`。

### 3.5 `apps/web` SSR 模块

```ts
// src/entry-server.tsx
export const supportedLocales: readonly Locale[];
export const defaultLocale: Locale;
export function render(request: SsrRenderRequest): Promise<SsrRenderResult>;
export function listSitemapUrls(siteOrigin: string): Promise<readonly string[]>;
```

`headHtml` 至少包含 `title`、`description`、`canonical`、`zh-CN`/`en`/`x-default` 三个 `hreflang`，404 额外 `robots noindex`。所有属性值必须转义。

### 3.5.1 App 与页面签名（壳层与页面的边界）

```tsx
// src/App.tsx
export function App(props: {
  initialLocale: Locale;
  initialRoute: AppRoute;
}): ReactNode;

// 页面组件均自行通过 useAppNavigation / useTranslation 取依赖
export function HomePage(): ReactNode;
export function CategoryPage(props: { categoryId: CategoryId }): ReactNode;
export function ToolPage(props: { toolId: string }): ReactNode;
export function TasksPage(): ReactNode;
export function AdminPage(): ReactNode;
export function NotFoundPage(): ReactNode;
```

### 3.6 HTML 模板占位符（服务端与 web 的构建契约）

`apps/web/index.html` 必须保留：

- `<html lang="zh-CN">`：服务端替换 `lang` 属性值；
- `<head>` 内 `<!--app-head-->`；
- `<div id="root"><!--app-html--></div>`；
- 开发入口 `<script type="module" src="/src/entry-client.tsx"></script>`。

服务端替换前校验占位符存在，缺失即启动失败。

### 3.7 服务端配置与运行约定

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `NODE_ENV` | `development` | 选择 dev/prod 渲染器 |
| `HOST` | `127.0.0.1` | 监听地址 |
| `PORT` | `5173` | 端口 |
| `SITE_ORIGIN` | `http://localhost:5173` | canonical / sitemap 绝对来源 |
| `WEB_ROOT` | `../web`（相对 server 工作目录） | web 源码与产物根目录 |

阶段 3 不读取 `DATABASE_URL`；完整 `ServerEnvironmentSchema`（含数据库）在阶段 7 接入。

开发：`tsx watch` + Vite middleware（`ssrLoadModule('/src/entry-server.tsx')`，`ssr.noExternal` 见 D15）。
生产：`vite build` 客户端到 `dist/client`、SSR 到 `dist/server`，服务端从 `WEB_ROOT/dist` 加载。

## 4. 文件所有权（并行派发边界）

| Agent | 负责文件 | 禁止修改 |
| --- | --- | --- |
| A catalog | `packages/app-core/src/catalog/**` | 其它任何目录 |
| B i18n | `packages/app-core/src/i18n/create-i18n.ts`、`namespaces.ts`、`index.ts`、`resources/**`（`navigation/**` 与 `catalog|tasks|admin/**` 除外）、`i18n.test.ts` | `catalog/**`、`apps/**`、根配置 |
| C web-shell | `apps/web/index.html`、`vite.config.ts`、`src/entry-client.tsx`、`src/entry-server.tsx`、`src/app/**`、`src/components/app-shell/**`、`command-palette/**`、`recent-tasks/**`、`tool-search-entry/**`、`src/App.test.tsx`；删除 `src/main.tsx` | `src/pages/**`、`src/components/catalog|page-chrome|app-icon/**`、`data/**`、`packages/**` |
| D web-pages | `apps/web/src/pages/**`、`src/components/catalog/**`、`src/components/page-chrome/**`、`src/components/app-icon/**`、`packages/app-core/src/i18n/resources/{zh-CN,en}/{catalog,tasks,admin}.ts` | shell/入口/app/**、`common|navigation` 资源、`packages/app-core/src/catalog/**` |
| E server | `apps/server/src/**` | `apps/web/**`、`packages/**`、根配置 |

约束：

- 不得修改 `packages/contracts/**`、根 `package.json`、锁文件、`turbo.json`、`scripts/**`；需要变更时报告根 Agent。
- 不得伪报验证结果；每个 Agent 结束前必须运行自己包的类型检查与测试，并报告实际输出。
- 缺失 i18n 键时不得硬编码文案，报告根 Agent；页面级键由 D 在自己的资源文件中补齐。
- 严禁把阶段 2 的 `data/sample-catalog.ts` 继续作为数据源；该文件由根 Agent 在集成时删除。

## 5. 验收矩阵

| 验收项 | 现在可验证 | 依赖后续阶段 |
| --- | --- | --- |
| 中英文首页、分类页、工具页可直达 | ✅ 代码目录 + HTTP 200 | — |
| 不存在/停用工具、未知分类/语言返回真实 404 | ✅ | — |
| 首页、搜索、分类导航、Sitemap 只展示启用工具 | ✅ | — |
| SSR 输出 lang/title/description/canonical/hreflang | ✅ | — |
| 路由、目录状态、SEO 集成测试 | ✅ | — |
| 数据库启用状态 / Seed 一致性 | — | 阶段 7 |
| CDN 缓存与停用状态一致性（D03） | 部分（响应头） | 部署阶段实测 |
| 语言切换保留当前工具 | ✅ | — |

## 6. 验证命令

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev          # http://127.0.0.1:5173
```

集成验收还需实际 HTTP 检查：`/` 302、`/zh-CN` 200、`/en` 200、未知路径 404、停用工具 404、`/sitemap.xml` 条目只含启用工具、`/robots.txt` 指向 Sitemap、`lang` 与 `hreflang` 正确。

## 7. 风险

- `m3-expressive-react` 只有单维护者且社区小；SSR 已实测可用，但任何内部依赖变化都可能破坏 `ssr.noExternal` 假设。
- 阶段 2 的组件测试断言中文字符串，i18n 改造后需同步更新；不得为过测试而弱化断言。
- 客户端目录数据仍随包发布；阶段 7 接入数据库后需改为渲染器注入的快照，届时保持 URL 与可用性规则不变。
- `apps/web/src/data/sample-catalog.ts` 在集成阶段删除，删除前需确认无残留引用。
