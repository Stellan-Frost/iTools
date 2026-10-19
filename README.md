# iTools

iTools 是一个本地运行的 Web 工具站项目。阶段 3 已交付 Fastify SSR、`/zh-CN` 与 `/en` 路由、双语页面、真实 404、动态 `sitemap.xml` 与 `robots.txt`。阶段 4 已交付全局框架：三态工具注册表（`preview / implemented / disabled`）、统一工具页骨架与注册表校验，6 个样本工具明确标记为“预览”，**尚无可执行工具**；没有数据库、任务运行时、认证、PWA 或 CI。

## 从这里开始

新 Agent 请先读 [Agent 交接说明](docs/19-agent-handoff.md)，再按其中的任务状态、边界和验收要求工作。当前阶段的权威文档：

- [阶段 4 冻结](docs/23-stage-4-freeze.md)：注册表、三态可用性、预览页规则与文件所有权。
- [阶段 4 验收](docs/24-stage-4-acceptance.md)：实际命令、139 项测试、28 项 HTTP 验收与已知限制。
- [阶段 3 冻结](docs/20-stage-3-routing-ssr-i18n-seo.md) 与 [阶段 3 验收](docs/21-stage-3-acceptance.md)：SSR、路由、i18n、SEO 的依据。
- [仓库现状审计](docs/16-stage-0-audit.md)、[工作区契约](docs/17-stage-1-workspace.md)、[阶段 2 设计与验收](docs/18-stage-2-design-system.md)：历史阶段证据。

## 本地运行

环境要求：Node.js 22 或更新版本；pnpm 11.25.0（仓库固定）。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` 会先构建 `@itools/contracts`、`@itools/app-core`、`@itools/design-system-adapter`，再启动 `@itools/server`（Fastify + Vite middleware）。打开终端输出的地址即可访问 SSR 页面，例如 `/zh-CN`、`/en/text/json-viewer`。

生产构建与本地生产模式：

```sh
pnpm build
cd apps/server && NODE_ENV=production node dist/index.js
```

`pnpm build` 生成 `apps/web/dist/client`（浏览器资源）与 `apps/web/dist/server`（SSR 渲染函数）。服务端从 `WEB_ROOT`（默认 `../web`）加载这两份产物。

## 验证命令

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:tools                  # 需先构建 app-core；当前 7 条注册表条目
node scripts/verify-stage-4.mjs   # 启动生产产物，做真实 HTTP 验收
```

这些是本地验证命令，不表示已配置 CI。`verify-stage-4.mjs` 需要先执行 `pnpm build`；阶段 3 的 `verify-stage-3.mjs` 已因预览口径变化而停用。

## 工作区

| 路径 | 职责 |
| --- | --- |
| `apps/web` | React 页面、URL 路由、i18n、SEO head、SSR 渲染入口 |
| `apps/server` | Fastify 宿主：SSR、静态资源、Sitemap/robots、真实 404 |
| `packages/app-core` | 三态工具注册表（预览/已实现/停用）、分类与样本任务、i18n 资源与 i18next 工厂 |
| `packages/contracts` | 共享契约：API、资产、任务、工具、语言、SSR 渲染接口 |
| `packages/design-system-adapter` | MD3 组件、鸭青主题、字体与全局样式 |

## 文档地图

`docs/00`–`15` 是项目原始模块规范，保留作目标、约束与设计参考；其中数据库、认证、任务运行时、持久化、PWA、部署等内容**不代表当前实现**。`docs/16`–`21` 记录实际仓库状态与阶段证据。

- [00 架构概览](docs/00-architecture-overview.md)
- [01 设计系统](docs/01-design-system.md)
- [02 路由、国际化与 SEO](docs/02-app-routing-i18n-seo.md)
- [03 工具契约](docs/03-tool-contract.md)
- [04 任务与 Worker 运行时](docs/04-task-worker-runtime.md)
- [05 文件资产与本地存储](docs/05-file-assets-local-storage.md)
- [06 后端、数据库与 API](docs/06-backend-database-api.md)
- [07 管理控制台](docs/07-admin-console.md)
- [08 安全与隐私](docs/08-security-privacy.md)
- [09 PWA 与缓存更新](docs/09-pwa-cache-update.md)
- [10 测试、CI 与质量](docs/10-testing-ci-quality.md)
- [11 部署、运维与恢复](docs/11-deployment-operations-recovery.md)
- [12 Agent 协作](docs/12-agent-collaboration.md)
- [13 验收与未决事项](docs/13-acceptance-open-decisions.md)
- [14 阶段路线图](docs/14-phase-implementation-roadmap.md)
- [15 强制代码要求](docs/15-mandatory-code-requirements.md)
- [16 当前仓库审计与实现边界](docs/16-stage-0-audit.md)
- [17 当前工作区与契约](docs/17-stage-1-workspace.md)
- [18 阶段 2 应用壳设计](docs/18-stage-2-design-system.md)
- [19 Agent 交接](docs/19-agent-handoff.md)
- [20 阶段 3 冻结](docs/20-stage-3-routing-ssr-i18n-seo.md)
- [21 阶段 3 验收](docs/21-stage-3-acceptance.md)
- [22 阶段 4 准备](docs/22-stage-4-preparation.md)
- [23 阶段 4 冻结](docs/23-stage-4-freeze.md)
- [24 阶段 4 验收](docs/24-stage-4-acceptance.md)
