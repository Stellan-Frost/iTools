# 17 · 当前工作区、契约与边界

> 更新：2026-10-19（阶段 3 后）。本文描述当前仓库实际存在的工作区和共享契约。阶段门禁结果是已有记录，不代表本轮重跑；阶段 3 证据见 [21](21-stage-3-acceptance.md)。

## 工作区与命令

根目录以 `pnpm@11.25.0` 管理 workspace，要求 Node.js `>=22`。`pnpm-workspace.yaml` 纳入 `apps/*` 与 `packages/*`；当前有 `@itools/app-core`、`@itools/contracts`、`@itools/design-system-adapter`、`@itools/server`、`@itools/web` 五个包。

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 先构建 contracts/app-core/adapter，再启动 `@itools/server`（Fastify + Vite middleware），默认 `127.0.0.1:5173`。 |
| `pnpm build` | 经 `scripts/run-turbo.mjs` 执行 Turbo build；web 分别产出 `dist/client` 与 `dist/server`。 |
| `pnpm test` | 经 Turbo 执行包测试。 |
| `pnpm typecheck` | 经 Turbo 执行包类型检查。 |
| `pnpm lint` | ESLint 检查 `apps`、`packages`、`scripts`，随后运行依赖清单边界检查。 |
| `pnpm format:check` | Prettier 格式检查。 |
| `pnpm check:boundaries` | 单独检查工作区包依赖清单。 |
| `pnpm check:tools` | 校验注册表结构、翻译与样本任务引用（需先构建 app-core）。 |
| `node scripts/verify-stage-4.mjs` | 生产构建后的真实 HTTP 验收（需先 `pnpm build`）。 |

各 package manifest 中记录包级脚本。全新克隆后执行 `pnpm install`，再 `pnpm dev`：根 `dev` 会串行构建 contracts、app-core、adapter（它们的 exports 指向 `dist`），再启动服务端。`pnpm peers check` 是 pnpm 内建命令，不在 `package.json` scripts。阶段 3 本轮实际执行了 install、format、lint、typecheck、test、build，结果见 [21](21-stage-3-acceptance.md)。

`scripts/check-boundaries.mjs` 读取 `apps/*/package.json` 和 `packages/*/package.json` 的 `dependencies`、`devDependencies`、`peerDependencies`，按包名白名单验证 `@itools/*` 依赖方向。它不解析 TypeScript/JavaScript 源码 import，也不验证所有源码导入路径。`scripts/run-turbo.mjs` 用 Node 启动本地锁定的 Turbo，并设置 `TURBO_TELEMETRY_DISABLED=1`。

## 契约公开入口

`packages/contracts/src/index.ts` 是 contracts 唯一的包入口，公开导出以下模块：

| 源文件               | 内容                                                | 尚未提供                         |
| -------------------- | --------------------------------------------------- | -------------------------------- |
| `src/api.ts`         | `ApiErrorSchema`、`apiSuccessSchema`                | HTTP 路由、API client、OpenAPI。 |
| `src/asset.ts`       | 资产 ID、角色与任务引用 Schema                      | IndexedDB 或资产读写。           |
| `src/environment.ts` | `ServerEnvironmentSchema`、`parseServerEnvironment` | 服务进程和数据库连接。           |
| `src/locale.ts`      | `LOCALES`、`DEFAULT_LOCALE`、`isLocale`             | 语言内容与路由实现（在 app-core/web）。 |
| `src/ssr.ts`         | `SsrRenderRequest`、`SsrRenderResult`、`SsrRenderer` | SSR 实现（在 web/server）。      |
| `src/tool-registry.ts` | 三态可用性、`ToolCatalogMetadata`、`RegistryEntry` | 注册表实现（在 app-core）。     |
| `src/task.ts`        | 任务状态枚举、进度和记录形状                        | 状态机、队列、Worker、持久化。   |
| `src/tool.ts`        | Tool manifest、`ToolDefinition`、adapter 执行接口   | 注册表、真实工具和执行宿主。     |

工具契约版本目前为 `TOOL_CONTRACT_VERSION = 1`。Schema 只校验所描述的数据形状，不代表任何消费端已经实现。

## 当前模块职责

| 路径                             | 职责及边界                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/contracts`             | 纯共享契约，运行依赖 TypeBox；不依赖 UI、数据库实现或具体工具。                     |
| `packages/app-core`              | 三态工具注册表、分类与样本任务、i18n 资源与 `createI18n`；不依赖 React/DOM。 |
| `packages/design-system-adapter` | 对 MD3 库、固定主题及字体做应用适配；应用从此包导入基础 UI。                        |
| `apps/web`                       | React 页面、URL 路由、SSR 渲染函数与 SEO head；不直接访问数据库或文件系统。         |
| `apps/server`                    | Fastify SSR 宿主、静态资源、Sitemap/robots；只依赖 `SsrRenderer` 契约。             |
| `scripts/check-boundaries.mjs`   | 工作区 manifest 依赖方向检查，不是源码静态依赖分析器。                              |
| `scripts/run-turbo.mjs`          | 为根级 Turbo 命令提供跨平台 Node 启动包装。                                         |

`tsconfig.base.json` 配置严格 TypeScript 基础选项；根 ESLint、Prettier 配置统一工程检查。`.gitattributes` 固定仓库文本换行行为。真实配置以根配置文件和各包清单为准。

## 已有验收记录

阶段 1 的独立克隆记录曾报告 frozen-lockfile 安装、format、lint、typecheck、build、peer 检查通过，contracts 有 4 项测试，manifest 边界脚本的违规依赖负向检查也通过。阶段 2 记录为 22 项测试。阶段 3 实测 108 项；阶段 4 实测 139 项（contracts 6、app-core 49、adapter 9、web 61、server 14），format、lint、typecheck、build、`check:tools` 通过，生产 HTTP 验收 28 项通过。证据见 [阶段 4 验收](24-stage-4-acceptance.md)。

尚未实现的架构规划见 `docs/00`–`15`：其中 PostgreSQL/Drizzle、TypeBox 路由、TanStack Query、Worker、IndexedDB、身份认证、PWA、CI 与部署均不得据规划文档描述为现有能力。Fastify SSR、i18n、Sitemap 与三态注册表已分别在阶段 3/4 实现；真实工具执行与任务运行时仍未实现。
