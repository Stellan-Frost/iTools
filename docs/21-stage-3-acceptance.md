# 21 · 阶段 3 验收记录

> **阶段 4 后口径变化**：本文中“Sitemap 含 json-viewer 等工具页”“停用工具 = 唯一不可用状态”的记录已被阶段 4 的三态可用性取代。当前 Sitemap 只含 implemented 工具（本阶段为 0 个），预览页 200 + noindex。`verify-stage-3.mjs` 已标注为历史脚本，当前门禁使用 `verify-stage-4.mjs`。本文保留为阶段 3 的原始证据。

> 记录日期：2026-10-19。范围、冻结接口与文件所有权见 [20 · 阶段 3 冻结](20-stage-3-routing-ssr-i18n-seo.md)。本记录只描述本轮实际执行的验证；未执行的项明确标注。

## 1. 阶段目标

Fastify 托管 React SSR；`/{locale}` 路由与双语页面；真实 HTTP 404；SSR SEO head；动态 Sitemap 与 robots。目录来源为 `@itools/app-core` 代码注册表。

## 2. 交付物

| 位置 | 内容 |
| --- | --- |
| `packages/contracts` | 新增 `locale.ts`（`LOCALES` / `DEFAULT_LOCALE` / `isLocale`）与 `ssr.ts`（`SsrRenderRequest` / `SsrRenderResult` / `SsrRenderer`） |
| `packages/app-core` | 新包：`catalog/**`（5 分类、7 工具含 1 停用、3 条样本任务、查询/搜索/Sitemap 路径）与 `i18n/**`（5 命名空间、中英资源、`createI18n`） |
| `apps/web` | SSR 入口 `entry-server.tsx`、水合入口 `entry-client.tsx`、URL 路由 `app/route.ts`、导航上下文 `app/navigation.tsx`、SEO `app/seo.ts`、页面改造、语言切换；删除 `main.tsx` 与 `data/sample-catalog.ts` |
| `apps/server` | 新包：Fastify 宿主、Vite dev middleware、生产 SSR 渲染器、静态资源、Sitemap/robots、模板注入、配置校验 |
| 根目录 | `pnpm-workspace.yaml` 允许 esbuild 构建脚本；`package.json` 的 `dev`/`build:workspace-deps`；`scripts/verify-stage-3.mjs` |

## 3. 实际执行命令与结果

| 命令 | 结果 |
| --- | --- |
| `pnpm install` | 通过；锁文件包含新增依赖（fastify 5.12.7、@fastify/static 10.1.6、@fastify/middie 9.3.5、i18next 26.5.2、react-i18next 17.1.0、tsx 4.23.15） |
| `pnpm format:check` | 通过（All matched files use Prettier code style） |
| `pnpm lint` | 通过（ESLint + workspace 依赖边界检查） |
| `pnpm typecheck` | 通过，8/8 Turbo 任务成功 |
| `pnpm test` | 通过，Turbo 8/8 任务成功；分包含计 **108 项**：contracts 5、app-core 28、design-system-adapter 9、web 52、server 14 |
| `pnpm build` | 通过，5/5 Turbo 任务成功；产出 `apps/web/dist/client`、`apps/web/dist/server`、`apps/server/dist` |
| `node scripts/verify-stage-3.mjs` | 生产产物真实 HTTP 验收 **31/31 通过** |
| `pnpm dev` + curl | `/zh-CN` 200、`/src/entry-client.tsx` 200、`/en` 200、停用工具 404、`/sitemap.xml` 200 |

未执行：`pnpm install --frozen-lockfile`（本轮用普通 install 更新锁文件）、Playwright 浏览器 E2E（阶段 11 才引入）。

## 4. 验收标准逐项

| 阶段 3 验收项 | 状态 | 证据 |
| --- | --- | --- |
| 中英文首页、分类页和工具页可直达访问 | ✅ | HTTP 验收：`/zh-CN`、`/en`、`/zh-CN/text/json-viewer` 均 200；`route.test.ts` 覆盖解析 |
| 不存在或停用的工具 URL 返回 HTTP 404 | ✅ | `/zh-CN/text/csv-inspector` 404 且 `Cache-Control: no-store`；未知分类、未知语言同样 404 |
| 全局搜索、分类页、首页和 Sitemap 仅展示实现存在且启用的工具 | ✅ | `searchEnabledTools` / `listEnabledTools` 单源；web 测试断言停用工具不出现在导航与搜索；Sitemap 不含 `csv-inspector` |
| SSR 的 language、title、description、canonical 和语言关联链接正确 | ✅ | HTTP 验收检查 `<html lang>`、`<title>`、canonical、`hreflang`（zh-CN/en/x-default） |
| 路由、目录状态和 SEO 相关集成测试通过 | ✅ | server 14 项（重定向/308/404/Sitemap/robots/缓存头）+ web 52 项 |
| 语言切换保留当前工具 | ✅ | `App.test.tsx` 断言切换后路径进入 `/en/...` 且标题变英文 |
| 英文页面无中文 | ✅ | 页面测试与 HTTP 验收均断言 en 输出不含 CJK |

### D06：推迟到阶段 7 之后的验收

- 数据库启用状态与直达路由的实时校验。
- 代码注册表、Seed、数据库一致性检查。
- CDN 缓存与停用状态的端到端一致性（D03）。

## 5. 关键实现事实

- SSR 渲染器契约由 `@itools/contracts` 定义；服务端只依赖该契约，不导入 `@itools/web` 或 `@itools/app-core` 源码。生产模式通过文件路径加载构建后的 `entry-server.js`。
- 分类体系按 `docs/02` 冻结为 `audio`、`image`、`video`、`text`、`other`（D08）；阶段 2 的预览分类退役。
- 工具 URL 必须包含所属分类；分类不匹配、停用或不存在统一 404（D10）。
- `/` 302 到 `/zh-CN`；非根尾斜杠 308 去除并保留查询串（D11）。
- `/tasks`、`/admin` 输出 `noindex`，robots 禁止抓取，Sitemap 不包含（D13）。
- HTML `public, max-age=0, must-revalidate`；404 `no-store`；Sitemap/robots `max-age=300`；`/assets/*` 一年 immutable（D14）。
- SSR 必需 `ssr.noExternal` 内联 MD3 相关包（D15），已实测无此配置会启动失败。

## 6. 已知限制与未决项

1. **未在真实浏览器验证水合**：已验证 SSR HTML、客户端入口资源与路由，但没有 Playwright，因此水合期 DOM 差异与客户端交互只在 jsdom 中覆盖。浏览器级 E2E 属于阶段 11。
2. **包体未优化**：客户端 bundle 约 607 kB（gzip 178 kB），SSR bundle 约 707 kB；未做代码分割，性能预算与阈值属于阶段 11。
3. **开发监听范围**：`apps/server` 的 dev 脚本使用 `node --watch-path=./src`。若改为监听全仓库，Vite 写入 `node_modules/.vite` 会触发无限重启（本轮实际排查）。
4. **工具清单仍是样本**：6 个启用工具 + 1 个停用样本；`audio`/`video` 分类为空。真实工具清单与能力声明属于阶段 4。
5. **管理页与任务页仍是界面样本**：无认证、无数据库写入、无真实任务。
6. **构建供应链**：`pnpm-workspace.yaml` 的 `allowBuilds.esbuild` 从占位字符串改为 `true`，否则 pnpm 11 在每次 `pnpm run` 前的依赖校验会失败。
7. **阶段 2 截图与说明已过时**：分类、URL 与导航行为已改变，旧截图不再作为当前证据。
8. **CDN 行为未验证**：D03/D14 的缓存策略只落地了响应头，未做 CDN 实测。

## 7. 结论

阶段 3 可独立验收的部分全部通过；按 D06 约定，数据库/Seed/CDN 相关完整集成验收留待阶段 7 之后。阶段 4（工具注册表与统一工具页）可以在本阶段结论上继续，但必须遵守 `docs/20` 的接口与所有权约定。
