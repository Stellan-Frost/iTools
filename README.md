# iTools

iTools 是一个本地运行的 Web 工具站项目。阶段 0–4 已完成：Monorepo、MD3 设计系统、Fastify SSR、`/zh-CN` 与 `/en` 路由、双语页面、真实 404、Sitemap/robots，以及三态工具注册表（`preview / implemented / disabled`）。

当前 6 个可见样本是 `preview`，另有 1 个 `disabled` 样本；`implemented` 为 0：**没有可执行工具**。数据库、任务运行时、认证、PWA、CI 与部署均未实现。

## 从这里开始

新 Agent 请按顺序读：

1. [00 · 架构总览与开发入口](docs/00-architecture-overview.md)：包结构、运行命令、代码地图、核心规则。
2. [14 · 路线图](docs/14-phase-implementation-roadmap.md) 与 [13 · 验收与决策](docs/13-acceptance-open-decisions.md)：当前阶段、未决事项、下一步门槛。
3. 按任务读对应模块文档（01–12）。
4. [15 · 强制代码要求](docs/15-mandatory-code-requirements.md)：所有改动必须满足。

## 本地运行

环境要求：Node.js ≥ 22；pnpm 11.25.0。

```sh
pnpm install
pnpm dev
```

`pnpm dev` 会先构建 `contracts`、`app-core`、`design-system-adapter`，再启动 Fastify + Vite middleware，默认 `http://127.0.0.1:5173`；`/` 会 302 到 `/zh-CN`。

生产模式：

```sh
pnpm build
cd apps/server && NODE_ENV=production node dist/index.js
```

## 验证

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:tools                  # 需先构建 app-core
node scripts/verify-stage-4.mjs   # 需先 build
```

当前基线：139 项测试通过，28 项 HTTP 验收通过。CI 与 Playwright 尚未接入。

## 文档

`docs/00`–`15` 是唯一的项目文档集，已按“新 Agent 可直接开工”重构；阶段过程稿与旧截图已删除。

- [01 设计系统](docs/01-design-system.md)
- [02 路由、i18n 与 SEO](docs/02-app-routing-i18n-seo.md)
- [03 工具注册契约与页面](docs/03-tool-contract.md)
- [04 任务运行时](docs/04-task-worker-runtime.md)
- [05 文件资产与 IndexedDB](docs/05-file-assets-local-storage.md)
- [06 后端、数据库与 API](docs/06-backend-database-api.md)
- [07 管理后台](docs/07-admin-console.md)
- [08 安全与隐私](docs/08-security-privacy.md)
- [09 PWA 与缓存](docs/09-pwa-cache-update.md)
- [10 测试与质量](docs/10-testing-ci-quality.md)
- [11 部署与恢复](docs/11-deployment-operations-recovery.md)
- [12 Agent 协作](docs/12-agent-collaboration.md)
