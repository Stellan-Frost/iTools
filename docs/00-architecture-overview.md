# 00 · 架构总览与开发入口

> 定位：新 Agent 的唯一入口。读完本文你能：启动项目、知道每个包管什么、知道改动的标准流程与红线。
> 状态：**阶段 0–9 已完成**；阶段 10（PWA）、11（CI/Playwright/性能）、12（部署）、13（全局验收与部署批准）未开始。
> 目标站点：`itools.wataa.men`。强制阅读顺序：本文 → [14](14-phase-implementation-roadmap.md) → [15](15-mandatory-code-requirements.md) → 按任务读 01–12；决策一律查 [13](13-acceptance-open-decisions.md)。

## 1. 项目是什么

多工具网站：首页 + 5 个分类（`audio/image/video/text/other`，冻结）。工具尽量在浏览器本地处理，不上传用户文件。普通用户免登录。

**当前真实能力**（勿夸大）：Fastify SSR + Vite 水合、中英双语路由、真实 404、Sitemap/robots、三态工具注册表、任务运行时（未接线）、本地资产存储（未接线）、PostgreSQL + 只读/管理 API、管理后台（含界面）、CSP/限流/脱敏日志。
**当前没有**：任何可执行工具（`implemented = 0`，6 preview + 1 disabled）、真实 Worker、任务 UI、PWA、CI、Playwright、部署。

## 2. 五分钟启动

```sh
pnpm install
pnpm dev        # 先构建 contracts/app-core/adapter，再启动 Fastify + Vite middleware
pnpm verify     # 全量门禁（任何提交前必须通过）
```

- 地址：`http://127.0.0.1:$PORT`（`.env` 当前 `PORT=3000`）；`/` 302 → `/zh-CN`。
- 数据库：便携版 PostgreSQL 17.6（`C:/itools-pg`，仅 127.0.0.1:5432），启停与迁移见 [11](11-deployment-operations-recovery.md)。没有 `DATABASE_URL` 服务照常启动（目录回落注册表）。
- 生产模式：`pnpm build && cd apps/server && NODE_ENV=production node dist/index.js`。

## 3. 包结构与依赖方向

| 包 | 职责 | 允许依赖 |
| --- | --- | --- |
| `packages/contracts` | 全部跨包类型与 TypeBox Schema（纯共享层） | 仅 typebox |
| `packages/app-core` | 三态工具注册表、分类、样本任务、i18n 资源与 `createI18n` | contracts |
| `packages/design-system-adapter` | MD3 主题、组件白名单、字体、全局样式 | 无工作区依赖 |
| `packages/task-runtime` | 7 态任务状态机、调度器、Worker 池（不依赖 React/DOM/Node） | contracts |
| `packages/asset-store` | IndexedDB 资产仓储、对象 URL、保留清理、归档 | contracts |
| `packages/db` | Drizzle schema、迁移、pg 仓储、目录合并（M1） | contracts + app-core |
| `apps/web` | React 页面、URL 路由、SSR 渲染函数、SEO、类型安全 API client | contracts + app-core + adapter |
| `apps/server` | Fastify SSR 宿主、`/api/v1`、管理接口、安全头、日志 | contracts + db |

依赖方向由 `scripts/check-boundaries.mjs`（package.json 清单）与 `scripts/check-import-boundaries.mjs`（源码 import）双重强制；新增包必须先改两处白名单。

## 4. 命令速查

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 本地开发（先构建 workspace-deps） |
| `pnpm verify` | **总门禁**：format:check → lint → typecheck → test → build → check:external → check:tools → check:i18n → HTTP 28 项 |
| `pnpm lint` | ESLint 严格规则 + `check:boundaries` + `check:imports` + `check:tokens` + `check:privacy` |
| `pnpm test` | 全部 584 项（自动加载 `.env`；db 测试需 PostgreSQL） |
| `pnpm test:db` | 仅 db 包（真实 PostgreSQL） |
| `pnpm check:tools` / `check:i18n` | 注册表校验 / i18n 键引用（需先 `pnpm build`） |
| `pnpm check:external` / `check:audit` | 构建产物外部资源审计 / 依赖漏洞扫描 |
| `pnpm format` | Prettier 写入 |

## 5. 关键结构约定

- **工具元数据唯一来源**是 `app-core/src/registry`；分类在 `app-core/src/catalog`；文案在 `app-core/src/i18n/resources`；视觉 Token 在 `design-system-adapter/src`。任何副本都是违规（`check:tools`/`check:i18n` 部分阻断，其余靠评审）。
- **工具 URL** 恒为 `/{locale}/{category}/{toolId}`；不存在/停用/分类不匹配 → 真实 404（D10）。
- **三态可用性**：`preview` 可见只读 + 200 + noindex + 不进 Sitemap；`implemented` 可执行可索引；`disabled` 404（D19/D20）。
- **M1 目录语义**（D27）：注册表权威，数据库只存覆盖且只能「下架」，不能启用。
- **SSR 约束**：`apps/web/vite.config.ts` 的 `ssr.noExternal` 必须含 `@itools/app-core`、`@itools/design-system-adapter`、`m3-expressive-react`、`@material/material-color-utilities`（D15）；SSR 期禁止 `window/document`。
- **server dev 脚本**用 `node --watch-path=./src`，不得监听全仓库（D18，Vite 写 `.vite` 会无限重启）。
- 生产加载 web 产物 `dist/server/entry-server.js`；server 不 import web/app-core 源码。

## 6. 常见任务的标准流程

| 任务 | 步骤 |
| --- | --- |
| 加界面文案 | `app-core/src/i18n/resources/{zh-CN,en}/<ns>.ts` 同键同改 → `t('a.b')` 完整点路径 → `pnpm check:i18n`（见 [02](02-app-routing-i18n-seo.md) §6.1） |
| 加页面 | 扩展 `AppRoute` → `parseAppPath`/`buildAppPath`/`seo.ts` 同步 → 测试 + HTTP 断言（见 [02](02-app-routing-i18n-seo.md) §6.2） |
| 加 UI 组件 | 只用适配层 + 语义 Token；缺能力先包装 adapter（见 [01](01-design-system.md) §6） |
| 接入首个真实工具 | **先建注册表注入点** `apps/web/src/app/registry.ts`，再注册 manifest/adapter/文案，`adapter.execute` 必须走 `task-runtime`（见 [03](03-tool-contract.md) §6） |
| 加任务/资产能力 | 复用 `task-runtime` / `asset-store` 端口，禁止旁路（见 [04](04-task-worker-runtime.md)、[05](05-file-assets-local-storage.md)） |
| 加表/迁移 | `tables.ts`（冻结，需确认）→ `0003_*.sql` 只 CREATE → `pnpm test:db`（见 [06](06-backend-database-api.md) §6.1） |
| 加 API | contracts 加 Schema → 路由 + `schema.response` → 限流/缓存头 → 测试（见 [06](06-backend-database-api.md) §6.2） |
| 加管理能力 | `contracts/src/admin.ts` → `admin/writes/routes.ts`（必须挂 `guard`）→ 401/403/404/409 测试（见 [07](07-admin-console.md)） |

## 7. 红线（全表见 [15](15-mandatory-code-requirements.md)）

1. 禁止 `any` / `@ts-ignore` / `eslint-disable` / 生产 `console.log` / 裸 HTML 控件 / 硬编码颜色。
2. 禁止绕过：调度器、资产仓储、注册表、i18n、适配层。
3. 用户文件与结果只在浏览器本地处理；`check:privacy` 阻断本地包网络调用。
4. 本地数据升级只走增量迁移，**永不自动清库**（D01）；清库只能用户显式触发。
5. 未执行的验证不得声称已通过；生产部署、迁移、破坏性操作须用户批准。
6. 偏离规范必须先提交变更提案，不得自行选方便方案。

## 8. 代码地图

| 路径 | 内容 |
| --- | --- |
| `apps/web/src/{app,pages,components,api}` | 路由与 SEO、页面、组件、API client |
| `apps/server/src/{api,admin,security,logging,renderer,cli}` | 公开 API、管理、安全头、日志、SSR 渲染接入、运维命令 |
| `packages/contracts/src/*.ts` | `locale/ssr/tool/tool-registry/task/asset/catalog/admin/api/environment` |
| `packages/app-core/src/{registry,catalog,i18n}` | 注册表与校验、分类与样本任务、i18n |
| `packages/task-runtime/src/{domain,application,infrastructure}` | 状态机与预算、调度器与外观、Worker 池与协议 |
| `packages/asset-store/src/{domain,application,infrastructure}` | 校验与保留、服务与归档、IndexedDB 与配额 |
| `packages/db/src/{schema,catalog,infrastructure,cli}` | 表定义、目录合并与 Seed、pg 仓储与探测、迁移/Seed CLI |
| `scripts/*.mjs` | 边界/Token/隐私/i18n/注册表/外部资源检查与 HTTP 验收 |
