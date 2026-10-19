# 19 · 新 Agent 快速接手

> 状态：截至 2026-10-19，阶段 0–3 均有验收记录；阶段 3（路由/SSR/i18n/SEO）已完成可独立验收部分。阶段 4 尚未开始，启动前须由用户确认范围与接口。本文用于恢复工作上下文，不构成启动新功能的授权。

## 阅读顺序

1. 根目录 [README.md](../README.md)：仓库索引与项目状态。
2. 本指南：现状、边界和接手规则。
3. [阶段 3 冻结](20-stage-3-routing-ssr-i18n-seo.md) 与 [阶段 3 验收](21-stage-3-acceptance.md)：当前架构、冻结接口、证据与已知限制。
4. 根据任务阅读 `docs/00`–`15` 的架构要求、产品决定和阶段计划；它们是规划基线，不是已实现能力。
5. 阅读对应包 README 与源码，再用 Git 历史追溯决策。

不要把规划文档中的目标能力当作当前功能。若权威决策来源或验收口径不清，记录为未决并交由根 Agent/用户裁定。

## 当前状态

- 工作区有五个包：`apps/web`、`apps/server`、`packages/app-core`、`packages/contracts`、`packages/design-system-adapter`。
- 已实现：Fastify SSR 与静态托管、`/{locale}` 路由、中英双语、真实 404、SSR SEO head、动态 `sitemap.xml` / `robots.txt`、语言切换。
- 目录仍来自 `@itools/app-core` 的代码注册表（5 分类、6 个启用工具 + 1 个停用样本）；没有数据库、真实工具执行、任务运行时、IndexedDB、认证、PWA、CI 或部署。
- 任务页与管理页仍是界面样本；刷新会重置内存状态。
- 最近一次全量验证：`format:check`、`lint`、`typecheck`、`test`（108 项）、`build` 通过；生产产物 HTTP 验收 31/31 通过。证据见 [阶段 3 验收](21-stage-3-acceptance.md)。

## 入口与职责

| 入口 | 职责 | 工作边界 |
| --- | --- | --- |
| `apps/server/src/index.ts` | 服务端启动、dev/prod 渲染器组装、优雅关闭。 | 不承载页面或目录逻辑。 |
| `apps/server/src/app.ts` | Fastify 路由、SSR 注入、静态资源、Sitemap/robots、缓存头。 | 只依赖 `SsrRenderer` 契约，不导入 web/app-core。 |
| `apps/server/src/renderer/dev.ts` | Vite middleware + `ssrLoadModule`。 | 开发专用。 |
| `apps/server/src/renderer/prod.ts` | 加载 `dist/server/entry-server.js` 与 `dist/client/index.html`。 | 生产专用。 |
| `apps/web/src/entry-server.tsx` | `render()`、`listSitemapUrls()` 与语言常量。 | SSR 唯一渲染入口。 |
| `apps/web/src/entry-client.tsx` | `hydrateRoot` 与初始 locale/route。 | 浏览器唯一入口。 |
| `apps/web/src/app/route.ts` | URL 解析与规范路径生成。 | 内存状态已移除，URL 是唯一来源。 |
| `apps/web/src/app/navigation.tsx` | `AppNavigation` 上下文（navigate / switchLocale / openSearch）。 | 页面不得直接操作 `history`。 |
| `apps/web/src/app/seo.ts` | title/description/canonical/hreflang/noindex。 | 渲染器负责转义。 |
| `packages/app-core/src/catalog/**` | 分类、工具、样本任务、查询/搜索/Sitemap 路径。 | 不依赖 React/DOM。 |
| `packages/app-core/src/i18n/**` | 5 个命名空间的中英资源与 `createI18n`。 | 资源聚合入口 `resources/index.ts` 由根 Agent 维护。 |
| `packages/contracts/src/{locale,ssr}.ts` | 语言集合与 SSR 渲染契约。 | 纯类型/守卫，不含运行时服务。 |
| `scripts/verify-stage-3.mjs` | 生产产物 HTTP 验收。 | 需先 `pnpm build`。 |

## 常用命令

从仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm dev                 # 先构建 contracts/app-core/adapter，再启动 Fastify + Vite middleware
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-stage-3.mjs
```

- `pnpm dev` 默认监听 `127.0.0.1:5173`；`/` 会 302 到 `/zh-CN`。
- 生产模式：`pnpm build` 后在 `apps/server` 目录运行 `NODE_ENV=production node dist/index.js`。环境变量：`HOST`、`PORT`、`SITE_ORIGIN`、`WEB_ROOT`。
- 服务端 dev 脚本使用 `node --watch-path=./src`；**不要把监听范围扩到全仓库**，Vite 写入 `node_modules/.vite` 会导致无限重启。
- 全新克隆先 `pnpm install`（`pnpm-workspace.yaml` 已允许 esbuild 构建脚本），再 `pnpm build`。

## 未决事项与下一阶段门槛

阶段 4（工具注册表与统一工具页）尚未启动。开始前：

1. 确认阶段 4 范围：代码注册表、能力声明、输入/输出 Schema、Worker adapter、错误映射与文案键。
2. 冻结工具注册表接口，并说明与 `@itools/app-core/catalog` 的关系（阶段 3 目录是展示元数据，阶段 4 需要能力与执行契约）。
3. 工具清单、汇率工具第 68/69 题仍未确定；不得在不相关工作中替用户决定。
4. D01（IndexedDB 清库与长期保留）仍须在阶段 6 前解决；D02/D03/D04/D05 按对应阶段处理。
5. 阶段 3 遗留：浏览器级水合测试（阶段 11 Playwright）、包体优化与性能预算（阶段 11）、CDN 缓存实测（部署阶段）。

## Agent 协作与文件所有权

- 根 Agent 负责规划、跨模块接口裁决、集成、验收和冲突处理；实施 Agent 只在明确派发的文件范围内工作。派发内容需写明目标、禁止事项、文件所有权、依赖/冻结接口和验收标准。
- 共享工作目录中不可假设自己独占代码库；先看 `git status` 和当前 diff，不覆盖或撤销他人修改。不同 Agent 不并行改同一契约，除非根 Agent 已协调。
- 当前协作约定由根 Agent（Deepseek-V4.1-Flash High）负责规划、接口裁决、集成和验收，实施 Agent（Deepseek-V4.1-Flash High）负责获派范围内的实现与对应检查。模型选择及推理强度按当前任务的明确指示或协作约定执行。
- Agent 可在获派范围内实现、修复、写文档并运行要求的检查；不得伪报未执行的验证。生产部署、生产迁移、破坏性数据操作和公网安全配置变更遵循 `docs/12`、`docs/15` 的审批边界。
- 契约、产品范围或阶段顺序若需变更，先记录原因、影响、迁移、验证和回滚方案，交根 Agent/用户审阅；未确认前不把提案写成决定。

## 接手后第一步

从用户当前任务开始，只做其明确范围内的工作。若任务要求进入阶段 4，先完成上文的确认与接口冻结，用户未确认前不新增真实工具或改动阶段 3 契约。
