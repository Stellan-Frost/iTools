# 02 · 路由、i18n 与 SEO

> 定位：说清 URL 如何映射到页面、何时返回真实 404、`<head>` 写什么、Sitemap/robots 与缓存头如何生成、文案如何进入 i18n；新增页面或文案时照此执行。
> 状态：已实现（阶段 3；阶段 4 追加三态可用性规则）。
> 代码入口：`apps/web/src/app/route.ts`、`apps/web/src/app/seo.ts`、`apps/web/src/app/navigation.tsx`、`apps/web/src/entry-server.tsx`、`packages/app-core/src/i18n/create-i18n.ts`、`packages/contracts/src/{locale.ts,ssr.ts}`、`apps/server/src/{app.ts,sitemap.ts,robots.ts}`、`scripts/check-i18n-keys.mjs`。

## 1. 当前事实

### 1.1 语言与页面矩阵

语言集合冻结为 `['zh-CN', 'en']`，默认 `zh-CN`（`packages/contracts/src/locale.ts`）。解析入口 `parseAppPath(pathname)` 只读 pathname，查询串与 `#` 在 `segmentsOf` 中被丢弃。

| URL | 页面 | 状态码 | Sitemap | 索引 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `/` | — | 302 | — | — | `Location: /zh-CN`，Fastify 层处理，不进 SSR |
| `/{locale}` | home | 200 | 包含 | index | 例如 `/zh-CN`、`/en` |
| `/{locale}/{category}` | category | 200 | 包含 | index | 分类固定 5 个：`audio/image/video/text/other` |
| `/{locale}/{category}/{toolId}`（implemented / preview） | tool | 200 | 前者包含、后者排除 | 前者 index、后者 `noindex` | 工具必须可见且分类匹配 |
| `/{locale}/tasks` | tasks | 200 | 排除 | `noindex` | 样本数据，未接真实任务 |
| `/{locale}/admin` | admin | 200 | 排除 | `noindex` | 未认证时展示登录区 |
| 其它 | not-found | 404 | — | `noindex` | 渲染 404 页面，不是 200 伪 404 |

### 1.2 404 判定表（`parseAppPath`，`apps/web/src/app/route.ts:29`）

| 输入特征 | 结果 | 说明 |
| --- | --- | --- |
| 第一段缺失或不是 `zh-CN`/`en`（含 `/zh-cn`、`/fr`） | 404 | 语言大小写敏感，渲染语言回落 `DEFAULT_LOCALE` |
| 段数 > 3 | 404 | 没有更深层路由 |
| 段数 = 2，第二段不是 `tasks`/`admin`/已知分类 | 404 | 例如 `/zh-CN/nope` |
| 段数 = 3，第二段不是已知分类 | 404 | 例如 `/zh-CN/nope/json-viewer` |
| 段数 = 3，工具不存在/`disabled`/分类不匹配 | 404 | `findVisibleTool` 过滤停用；`/zh-CN/image/json-viewer` 不重定向（D10） |

### 1.3 重定向与尾斜杠

- 根路径：`app.get('/')` → `reply.redirect('/' + renderer.defaultLocale, 302)`（`apps/server/src/app.ts:73`）。
- 尾斜杠：未匹配路由的 GET/HEAD 进入 `setNotFoundHandler`；pathname 以 `/` 结尾且去斜杠后非空则 308，**保留查询串**：`/zh-CN/?from=test` → `/zh-CN?from=test`（`app.ts:109-114`）。
- 非 GET/HEAD 的未匹配请求直接 404 纯文本，不调用渲染器；不做 `.html` 后缀、大小写、`www`、HTTP→HTTPS 归一化（后两者属反向代理职责，阶段 12）。

### 1.4 `<head>` 生成（`apps/web/src/app/seo.ts`）

`buildHeadHtml({ locale, route, siteOrigin, t })` 输出 `<title>`、`description`、`canonical`、3 条 `alternate`，`noindex` 页面追加 `robots`；文本与属性均转义，`siteOrigin` 去掉尾部 `/`。

| 页面 | title | description | canonical |
| --- | --- | --- | --- |
| home | `common:meta.homeTitle` | `meta.homeDescription` | `/{locale}` |
| category | `分类名 · common:meta.titleSuffix` | 分类双语 `description` | `/{locale}/{category}` |
| tool | 工具 `metadata.name[locale]`（不加后缀） | 工具 `metadata.description[locale]` | 工具规范路径 |
| tasks / admin | `meta.tasksTitle` / `meta.adminTitle` | 对应 description | 各自页面路径 |
| not-found | `meta.notFoundTitle` | `meta.notFoundDescription` | **回落到 `/{locale}`**（`buildAppPath` default 分支） |

`hreflang` 固定三条：`zh-CN`、`en`、`x-default`（指向 `DEFAULT_LOCALE`）。canonical 丢弃查询串，`?from=search` 不产生重复 URL。

### 1.5 Sitemap 与 robots

- `listSitemapPaths(locale)`（`registry.ts:104`）= `/{locale}` + 5 个分类页 + 该语言下 `implemented` 工具；**只含 implemented**，preview/disabled/tasks/admin/404 一律不出现。`entry-server.tsx` 对 2 个语言各取一次并拼 `siteOrigin`，`buildSitemap` 用 `escapeXml` 包装，无 `lastmod`/`priority`。
- 当前 `implemented = 0` → 每语言 6 条，共 **12 条 URL**，每次请求实时生成。
- `robots.txt`：`Allow: /` + 4 条 `Disallow`（`LOCALES × ['tasks','admin']`）+ 绝对 `Sitemap:` 行，末尾换行。

### 1.6 缓存头矩阵（`apps/server/src/app.ts:41-45`）

| 响应 | Cache-Control | 来源 |
| --- | --- | --- |
| HTML 200 / 404 | `public, max-age=0, must-revalidate` / `no-store` | `HTML_CACHE_CONTROL`、`NOT_FOUND_CACHE_CONTROL` |
| `/sitemap.xml`、`/robots.txt` | `public, max-age=300` | `METADATA_CACHE_CONTROL` |
| `/assets/*`、`/brand-icon/*` | `public, max-age=31536000, immutable` / `public, max-age=86400` | `fastify-static` + `setHeaders` |
| `GET /api/v1/tools` | `public, max-age=60`；单工具、health、错误为 `no-store` | `api/routes.ts:12` |

安全头由 `onSend` 统一注入，覆盖 HTML/API/404/静态资源，详见 [08](08-security-privacy.md)。

### 1.7 i18n 资源现状

- 命名空间 5 个、顺序冻结：`common`、`navigation`、`catalog`、`tasks`、`admin`（`i18n/namespaces.ts`）；资源位置 `packages/app-core/src/i18n/resources/{zh-CN,en}/<namespace>.ts`，聚合入口 `resources/index.ts`（由根 Agent 维护）。
- 叶子键数：admin 90、catalog 49、common 37、navigation 16、tasks 8，共 200；中英键集合逐命名空间一致（已核对，自动断言只覆盖 `common`，见 §7）。
- `createI18n(locale, extraResources?)`：`fallbackLng: 'zh-CN'`、`defaultNS: 'common'`、`initAsync: false`（返回即初始化完成）、`interpolation.escapeValue: false`；`extraResources` 按语言浅合并注入 `tools/<id>`，不修改内置资源对象。
- 服务端用 `i18n.getFixedT(locale, 'common')` 生成 head 文案；客户端 `App.tsx` 用 `useMemo(() => createI18n(locale), [locale])` 重建实例并经 `I18nextProvider` 下发；`switchLocale(next)` → `buildAppPath(next, route)` 后 `pushState`，**保留当前路由**（D12），`popstate` 重新 `parseAppPath`。

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `apps/web/src/app/route.ts` | `parseAppPath` / `buildAppPath`；唯一 URL ↔ 路由映射实现 |
| `apps/web/src/app/seo.ts` | `buildHeadHtml`；title/description/canonical/hreflang/noindex 与转义 |
| `apps/web/src/app/navigation.tsx` | `AppNavigation` 上下文：`navigate` / `switchLocale` / `openSearch` |
| `apps/web/src/App.tsx` | 客户端路由与语言状态、`pushState`、`popstate` 接线 |
| `apps/web/src/entry-{server,client}.tsx` | SSR 入口（`render` / `listSitemapUrls`）与浏览器水合入口 |
| `apps/web/src/pages/**` | home / category / tool / tasks / admin / not-found 页面 |
| `packages/app-core/src/i18n/**` | `createI18n`、命名空间、双语文案资源（唯一来源） |
| `packages/app-core/src/registry/registry.ts` | `listSitemapPaths`、`findVisibleTool`、`searchVisible` |
| `packages/contracts/src/locale.ts` / `ssr.ts` | 语言集合与 SSR 渲染契约 |
| `apps/server/src/app.ts` | 302、Sitemap/robots、SSR 注入、尾斜杠 308、缓存头、静态资源 |
| `apps/server/src/sitemap.ts` / `robots.ts` | XML 包装 / robots 文本生成 |
| `scripts/check-i18n-keys.mjs` | 扫描 `apps/web/src`，断言每个资源叶子键都有引用 |

## 3. 必须遵守的规则

1. 新增页面先扩展 `AppRoute`，再在 `parseAppPath` 与 `buildAppPath` **同时**处理；只加渲染分支会造成直达 404 或导航错路径。检查：`pnpm --filter @itools/web test -- route`。
2. 未知/停用/分类不匹配一律真实 404，禁止重定向到分类页或首页兜底。检查：HTTP 验收中的 3 条 404 用例。
3. canonical/hreflang 必须由 `buildAppPath` 生成；`siteOrigin` 来自 `SITE_ORIGIN`，不得写死域名。
4. Sitemap 只允许 `listSitemapPaths` 的输出。检查：`curl -s .../sitemap.xml | grep -c '<loc>'` 等于 `2 × (1 + 5 + implemented 数)`。
5. `preview` 必须 `200 + noindex`，`implemented` 才可索引。检查：状态码 + HTML 中 `name="robots" content="noindex"`。
6. 所有用户可见文案（含 aria-label、空状态、错误提示）必须走 i18n 或注册表双语字段；品牌名 `iTools`、技术值（文件名、`1600 px`、`content-type`）可保留原文。
7. 改文案必须同键改 `zh-CN` 与 `en`，值非空、英文不含 CJK；资源键必须被 `apps/web/src` 以完整点路径引用（`t('actions.close')` 或 `t('common:actions.close')`）。检查：`pnpm check:i18n` + 页面测试。
8. `apps/web/index.html` 必须保留 `<html lang>`、`<!--app-head-->`、`<!--app-html-->`；`injectHtml` 缺失即抛错，改模板后必须重跑 HTTP 验收。
9. 缓存头只改 `app.ts` 顶部常量；确认 404 仍为 `no-store`，避免 404 被 CDN 缓存（D03/D14）。
10. 语言切换只调用 `switchLocale`，禁止 `location.reload()` 或丢失路径的跳转。

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| 页面里手写 `/zh-CN/text/json-viewer` | `buildAppPath(locale, { page: 'tool', toolId })`，分类从注册表取 |
| 未知工具 302 到分类页“提升体验” | 真实 404（`statusCode: 404` + `no-store`） |
| `seo.ts` 写死 `https://itools.wataa.men` | 使用传入的 `siteOrigin`（由 `SITE_ORIGIN` 注入） |
| 新增 preview 工具后手改 Sitemap | 不改；`listSitemapPaths` 只收 `implemented` |
| 把 `tasks`/`admin` 加进 Sitemap“方便收录” | 保持排除并保留 robots `Disallow`（D13） |
| 组件里写 `title="关闭"` 或中文空状态 | 新增 `common:*` 键，中英同时补齐 |
| 只改 `zh-CN/common.ts` 就提交，或用 `t('close')` 引用嵌套键 | 同键改 `en/common.ts`，用完整点路径 `t('actions.close')` |
| SSR 渲染期读 `window.location` | 路由来自 `parseAppPath(request.url)`；浏览器 API 只在 effect/事件中 |

## 5. 如何验证

```sh
pnpm --filter @itools/web test -- app/route app/seo   # 33 + 3 项通过
pnpm --filter @itools/web test -- pages               # 15 项通过
pnpm --filter @itools/server test -- app              # 14 项通过
pnpm --filter @itools/app-core build
pnpm check:i18n    # 期望：i18n 检查通过：所有资源键都有引用。
pnpm check:tools   # 期望：共 7 条（preview 6、implemented 0、disabled 1）
pnpm build && node scripts/verify-stage-4.mjs         # 期望：全部 28 项通过
# 端口以 PORT 为准：默认 5173，本仓库 .env 设为 3000（下列 curl 按 5173 示例）
curl -sI http://127.0.0.1:5173/                       # 302，Location: /zh-CN
curl -sI "http://127.0.0.1:5173/zh-CN/?a=1"           # 308，Location: /zh-CN?a=1
curl -sI http://127.0.0.1:5173/zh-CN                  # 200 + max-age=0, must-revalidate
curl -s  http://127.0.0.1:5173/en | grep -o '<html lang="[^"]*"'   # <html lang="en"
curl -s  http://127.0.0.1:5173/sitemap.xml | grep -c '<loc>'      # 12
curl -sI http://127.0.0.1:5173/zh-CN/text/csv-inspector           # 404 + no-store
```

## 6. 常见任务（step-by-step）

### 6.1 新增一条界面文案

1. 在 `resources/zh-CN/<ns>.ts` 与 `resources/en/<ns>.ts` 同一路径加键。
2. 组件中 `const { t } = useTranslation('<ns>')`，以完整点路径 `t('a.b')` 引用。
3. 跑 `pnpm --filter @itools/app-core test -- i18n` 与 `pnpm check:i18n`；文案出现在页面时纳入 `pages.test.tsx` 的英文无 CJK 断言范围。

### 6.2 新增一种页面类型

1. `route.ts`：扩展 `AppRoute`，在 `parseAppPath` 分支判定，未知走 `NOT_FOUND_ROUTE`。
2. 同文件 `buildAppPath` 加分支；`seo.ts` 的 `pageMeta` 加 title/description/noindex。
3. `App.tsx` 的 `CurrentPage` 加渲染分支，决定是否进 `listSitemapPaths` 与 `robots.ts`；补 `route.test.ts`、`seo.test.ts` 与 `verify-stage-4.mjs` 的 HTTP 断言。

### 6.3 首个工具变成 implemented 后

1. 注册表注入 `implemented` 条目（见 [03](03-tool-contract.md)），`pnpm check:tools` 应显示 `implemented 1`。
2. `pnpm build` 后 `curl -s .../sitemap.xml | grep -c '<loc>'` 应从 12 变 14，并确认工具页不再输出 `robots noindex`。

### 6.4 调整缓存策略

1. 只改 `apps/server/src/app.ts` 顶部 `*_CACHE_CONTROL` 常量，同步本文件 §1.6。
2. 更新 `app.test.ts` 的缓存头断言，跑 `pnpm --filter @itools/server test -- app` 与 `verify-stage-4.mjs`。

## 7. 已知限制与相关决策

- 重复斜杠被 `segmentsOf` 折叠（`/zh-CN//text` 与 `/zh-CN/text` 同为 200），未做 301 归一化；canonical 仍指规范路径。
- 404 页也输出 canonical 与 hreflang，canonical 落到 `/{locale}`，并非“404 无 canonical”的严格实现。
- `check:i18n` 只验证“键有引用”，不验证键集合；`i18n.test.ts` 的键集/非空断言只覆盖 `common`，其余命名空间依赖评审，属已知缺口。
- Sitemap 无 `lastmod`/`changefreq`、未分片；`implemented` 到数千条前不需要改。CDN 长缓存与停用工具 404 的一致性未实测（D03），绕过服务端 404 校验的缓存不可接受。
- 无浏览器 E2E：head 注入、水合后的 `<html lang>`、语言切换只有 jsdom 与 HTTP 断言，真实浏览器验证属阶段 11。
- 相关决策：D08、D10、D11、D12、D13、D14、D19/D20/D21、D34，全文见 [13](13-acceptance-open-decisions.md)。
