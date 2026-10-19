# 00 · 架构总览与开发入口

> 状态：**已实现阶段 0–4**（Monorepo、设计系统、SSR 路由、i18n/SEO、三态工具注册表）。
> 目标站点：`itools.wataa.men`。
> 本文是新 Agent 的唯一入口：先读本文，再按需读 01–15。

## 1. 项目是什么

公开发布的多工具网站：首页、音频、图像、视频、文本、其他分类；工具尽量在浏览器本地处理，不上传用户文件。普通用户免登录；管理员后台、数据库与任务运行时尚未实现。

**当前可交付的真实能力**

- Fastify SSR + Vite 客户端水合，中英双语路由。
- 真实 HTTP 404、canonical/hreflang、动态 `sitemap.xml` 与 `robots.txt`。
- 三态工具注册表：`preview`（可见、只读、noindex）、`implemented`（可执行、可索引）、`disabled`（404）。
- 6 个可见样本工具是 `preview`，另有 1 个 `disabled` 样本（`csv-inspector`，用于 404 验收）；`implemented` 为 0，**没有任何真实工具可执行**。

**明确未实现**：数据库、API、管理员认证、任务队列/Worker、IndexedDB/文件资产、真实工具执行、PWA、CI、部署。

## 2. 工作区与依赖方向

| 路径 | 职责 | 依赖 |
| --- | --- | --- |
| `apps/web` | React 页面、URL 路由、i18n、SEO head、SSR 渲染函数、客户端水合 | app-core、adapter、contracts |
| `apps/server` | Fastify 宿主：SSR、静态资源、Sitemap/robots、真实 404 | 仅 contracts |
| `packages/app-core` | 三态工具注册表、分类、样本任务、i18n 资源与 `createI18n` | contracts |
| `packages/contracts` | 共享契约：locale、SSR 渲染、工具 manifest、注册表条目、API/任务/资产形状 | 无工作区依赖 |
| `packages/design-system-adapter` | MD3 组件、鸭青主题、字体与全局样式 | 无工作区依赖 |

依赖方向（由 `scripts/check-boundaries.mjs` 约束）：

```
apps/web  →  app-core / design-system-adapter / contracts
apps/server → contracts
app-core  → contracts
contracts → （仅 typebox）
```

`apps/server` 不导入 web/app-core 源码；生产模式通过文件路径加载 `apps/web/dist/server/entry-server.js`。

## 3. 运行与验证

环境：Node.js ≥ 22，pnpm 11.25.0。

```sh
pnpm install
pnpm dev                           # 构建 contracts/app-core/adapter 后启动 Fastify + Vite middleware
```

开发地址 `http://127.0.0.1:5173`；`/` 会 302 到 `/zh-CN`。生产构建与本地生产模式：

```sh
pnpm build
cd apps/server && NODE_ENV=production node dist/index.js
```

环境变量（服务端）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` 使用 Vite middleware；`production` 加载 dist |
| `HOST` / `PORT` | `127.0.0.1` / `5173` | 监听地址与端口 |
| `SITE_ORIGIN` | `http://localhost:5173` | canonical / Sitemap 绝对来源 |
| `WEB_ROOT` | `../web`（相对启动目录） | web 源码与产物根目录 |

质量门禁：

```sh
pnpm format:check
pnpm lint                  # ESLint 严格规则 + 清单/源码边界 + Token 检查
pnpm typecheck             # Turbo，依赖包先构建
pnpm test                  # Vitest
pnpm build
pnpm check:tools           # 注册表校验；需先构建 app-core
pnpm check:i18n            # i18n 键使用检查；需先构建 app-core
node scripts/verify-stage-4.mjs   # 生产产物 HTTP 验收；需先 build

pnpm verify                # 以上全链路总门禁
```

当前基线：测试 139 项（contracts 6、app-core 49、adapter 9、web 61、server 14），HTTP 验收 28 项通过。CI 尚未接入。

## 4. 代码地图

| 位置 | 内容 |
| --- | --- |
| `apps/web/src/entry-client.tsx` | 浏览器入口：读取 `<html lang>` 与 `location.pathname`，`hydrateRoot` |
| `apps/web/src/entry-server.tsx` | SSR 入口：`render()`、`listSitemapUrls()` |
| `apps/web/src/app/route.ts` | URL 解析与规范路径 |
| `apps/web/src/app/navigation.tsx` | `AppNavigation` 上下文（navigate / switchLocale / openSearch） |
| `apps/web/src/app/seo.ts` | title/description/canonical/hreflang/noindex |
| `apps/web/src/pages/**` | 首页、分类、工具、任务、管理、404 |
| `apps/web/src/components/app-shell/**` | 顶部栏、抽屉、手风琴导航、工具详情 Dialog |
| `apps/web/src/components/page-chrome/**` | 标题、通知、徽标等展示组件 |
| `apps/server/src/app.ts` | Fastify 路由、SSR 注入、静态资源、缓存头 |
| `apps/server/src/renderer/{dev,prod}.ts` | Vite middleware / 构建产物加载 |
| `packages/app-core/src/registry/**` | 注册表条目、查询、校验、Sitemap 路径 |
| `packages/app-core/src/catalog/**` | 分类与样本任务 |
| `packages/app-core/src/i18n/**` | 5 个命名空间的中英资源、`createI18n` |
| `packages/contracts/src/**` | 所有跨包类型与 Schema |

## 5. 核心规则（开发前必读）

1. **单一来源**：工具身份、可用性、展示元数据只在 `app-core/registry`；分类只在 `app-core/catalog`；文案只在 i18n 资源或注册表双语字段。
2. **可用性三态**：`preview` 可见但只读、200 + `noindex`、不进 Sitemap；`implemented` 可执行、可索引、进 Sitemap；`disabled` 返回 404。详见 03。
3. **路由**：`/{locale}/{category}/{toolId}`；未知语言/分类/工具、停用工具、分类不匹配均为真实 404。详见 02。
4. **UI**：只用 `@itools/design-system-adapter` 组件，不写裸 HTML 控件；颜色/间距/圆角/动效一律用 Token；不覆盖组件库内部选择器。详见 01、15。
5. **SSR 安全**：渲染期不访问 `window`/`document`；浏览器 API 只能在 effect 或事件中。`vite.config.ts` 的 `ssr.noExternal` 必须内联 app-core、adapter、`m3-expressive-react`、`@material/material-color-utilities`。
6. **隐私**：用户文件、结果、任务数据默认只在浏览器本地处理；不得上传或接入未审核的第三方。
7. **不伪报**：不得把规划写成已实现；未执行的验证必须标注。生产部署、迁移、破坏性操作、公网安全配置变更须用户批准。

## 6. 文档地图

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| 00 | 本文：架构、运行、代码地图、核心规则 | — |
| 01 | 设计系统：主题、字体、Token、组件与 UI 约束 | 已实现 |
| 02 | 路由、i18n 与 SEO | 已实现 |
| 03 | 工具注册契约与统一页面 | 契约/注册表/页面骨架已实现，执行 UI 未实现 |
| 04 | 任务运行时与 Worker | 未实现（阶段 5） |
| 05 | 文件资产与 IndexedDB | 未实现（阶段 6） |
| 06 | 后端、数据库与 API | 未实现（阶段 7） |
| 07 | 管理后台 | 仅预览（阶段 8） |
| 08 | 安全与隐私 | 部分（本地边界已遵守，CSP/认证未实现） |
| 09 | PWA、离线与缓存 | 未实现（阶段 10） |
| 10 | 测试、CI 与质量 | 本地测试已实现，CI/Playwright 未实现（阶段 11） |
| 11 | 部署、运维与恢复 | 未实现（阶段 12） |
| 12 | Agent 协作与文件所有权 | 生效中 |
| 13 | 验收、未决事项与决策记录 | 生效中 |
| 14 | 分阶段路线图 | 生效中 |
| 15 | 强制代码要求与审查清单 | 生效中 |

## 7. 下一步

按 [14](14-phase-implementation-roadmap.md) 与 [13](13-acceptance-open-decisions.md)：

- 若先做真实工具：按 03 的“新增工具流程”接入 manifest、Schema、adapter、元数据与 `tools/<id>` 文案，并在 web 端建立 `createToolRegistry([...implemented])` 注入点。
- 若先做任务运行时：按 04 冻结状态机、队列、资源预算与取消协议。
- 两者都必须先由用户确认范围；工具清单与汇率工具第 68/69 题仍未决定。
