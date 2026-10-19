# 02 · 路由、国际化与 SEO

> 状态：**已实现（阶段 3，阶段 4 调整可用性规则）**。
> 代码入口：`apps/web/src/app/{route.ts,seo.ts,navigation.tsx}`、`apps/web/src/entry-server.tsx`、`apps/server/src/app.ts`。

## 1. URL 规则

语言前缀固定为 `/zh-CN` 与 `/en`（`LOCALES`）。分类固定为 `audio`、`image`、`video`、`text`、`other`。

| 路径 | 页面 | 说明 |
| --- | --- | --- |
| `/` | — | 302 → `/zh-CN` |
| `/{locale}` | 首页 | 例如 `/zh-CN`、`/en` |
| `/{locale}/{category}` | 分类页 | 分类必须存在 |
| `/{locale}/{category}/{toolId}` | 工具页 | 工具必须可见且分类匹配 |
| `/{locale}/tasks` | 任务页 | 本地样本；`noindex` |
| `/{locale}/admin` | 管理预览 | 未认证；`noindex` |
| `/api/v1/**` | 只读 API | JSON；不参与 SSR 与 Sitemap，详见 [06](06-backend-database-api.md) |

补充规则：

- 非根路径尾斜杠 308 去除，保留查询串：`/zh-CN/?a=1` → `/zh-CN?a=1`。
- 大小写敏感：`/zh-cn` 不是合法语言，返回 404。
- 工具 URL 必须包含其所属分类；分类不匹配（如 `/zh-CN/image/json-viewer`）返回 404，不做重定向。
- 查询串只透传，不参与路由解析。

## 2. 可用性与状态码

| 工具可用性 | 路由解析 | HTTP | Sitemap | 导航/搜索 |
| --- | --- | --- | --- | --- |
| `implemented` | tool 路由 | 200 | 包含 | 展示 |
| `preview` | tool 路由 | 200 + `noindex` | 排除 | 展示 + “预览”徽标 |
| `disabled` | not-found | 404 | 排除 | 不展示 |

未知语言、未知分类、未知工具、超过三段的路径均为 404。真实状态码由 SSR 渲染结果决定，禁止 200 伪 404。

## 3. SSR 渲染契约

`@itools/contracts` 定义：

```ts
interface SsrRenderRequest { url: string; siteOrigin: string }
interface SsrRenderResult {
  statusCode: 200 | 404;
  lang: Locale;
  headHtml: string;
  appHtml: string;
}
interface SsrRenderer {
  supportedLocales: readonly Locale[];
  defaultLocale: Locale;
  render(request: SsrRenderRequest): Promise<SsrRenderResult>;
  listSitemapUrls(siteOrigin: string): Promise<readonly string[]>;
}
```

- 开发：Fastify 通过 Vite middleware + `ssrLoadModule('/src/entry-server.tsx')`。
- 生产：`vite build --ssr` 生成 `dist/server/entry-server.js`，Fastify 按路径加载。
- 模板：`apps/web/index.html` 必须保留 `<html lang>`、`<!--app-head-->`、`<!--app-html-->`；服务端替换前校验，缺失即报错。
- `headHtml` 由渲染器生成并负责转义；服务端只做占位符替换。

## 4. 国际化

- 库：`i18next` + `react-i18next`；服务端与客户端用同一份资源。
- 命名空间：`common`、`navigation`、`catalog`、`tasks`、`admin`（`NAMESPACES`）。未来工具包通过 `createI18n(locale, extraResources)` 注入 `tools/<id>`。
- 资源位置：`packages/app-core/src/i18n/resources/{zh-CN,en}/`，聚合入口 `resources/index.ts` 由根 Agent 维护。
- 文案规则：
  - 所有可见文案、aria-label、状态、空状态、错误提示必须走 i18n 或注册表双语字段。
  - 中英键集合必须一致、值非空；英文不得含 CJK。
  - 品牌名 `iTools`、技术值（文件名、`1600 px`、`content-type` 等）可保留原文。
- 语言切换：保持当前路由，切换到另一语言的同一路径；工具 id 跨语言一致。

## 5. SEO

- `headHtml` 至少包含：`<title>`、`<meta name="description">`、`<link rel="canonical">`、`hreflang="zh-CN"`、`hreflang="en"`、`hreflang="x-default"`（默认指向中文）。
- 标题：首页用 `common:meta.homeTitle`；分类 `分类名 · iTools`；工具用工具名；任务/管理/404 用对应 meta。
- 描述：分类描述、工具 `description`（SEO 字段）或页面 meta。
- `noindex`：预览工具页、任务页、管理页、404。
- `sitemap.xml`：只包含首页、5 个分类和 `implemented` 工具；当前 `implemented = 0`，因此只有 12 条 URL（2 语言 × 6）。
- `robots.txt`：允许抓取；禁止 `/zh-CN/tasks`、`/en/tasks`、`/zh-CN/admin`、`/en/admin`；指向绝对 Sitemap。
- Sitemap/robots 由 Fastify 动态生成，不需要重新构建前端。

## 6. 缓存头

| 响应 | Cache-Control |
| --- | --- |
| HTML 200 | `public, max-age=0, must-revalidate` |
| HTML 404 | `no-store` |
| sitemap.xml / robots.txt | `public, max-age=300` |
| `/assets/*` | `public, max-age=31536000, immutable` |
| `/brand-icon/*` | `public, max-age=86400` |

CDN 策略尚未实测；任何绕过服务端 404 校验的缓存方案都不可接受。

## 7. 测试与验收

- `apps/web/src/app/route.test.ts`：33 项，覆盖解析、404、路径生成、中英路径。
- `apps/web/src/app/seo.test.ts`：3 项，覆盖 noindex 与 canonical。
- `apps/server/src/app.test.ts`：14 项，覆盖 302/308/404/注入/Sitemap/robots/缓存头。
- `scripts/verify-stage-4.mjs`：28 项真实 HTTP 验收。
- 未覆盖：真实浏览器水合、CDN 行为、Playwright E2E（阶段 11）。
