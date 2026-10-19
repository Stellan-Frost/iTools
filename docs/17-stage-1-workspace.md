# 17 · 当前工作区、契约与边界

> 更新：2026-10-19。本文描述当前仓库实际存在的工作区和共享契约。阶段门禁结果是已有记录，不代表本轮重跑。

## 工作区与命令

根目录以 `pnpm@11.25.0` 管理 workspace，要求 Node.js `>=22`。`pnpm-workspace.yaml` 纳入 `apps/*` 与 `packages/*`；当前只有 `@itools/contracts`、`@itools/design-system-adapter`、`@itools/web` 三个包。

| 命令                                                | 作用                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm --filter @itools/design-system-adapter build` | 构建 adapter 的 `dist` 入口，供 Web 解析 workspace package exports。首次执行 `pnpm dev` 前必须运行。 |
| `pnpm dev`                                          | 启动 Vite 浏览器预览；根脚本直接运行 Vite，不会先构建 adapter。                                      |
| `pnpm build`                                        | 经 `scripts/run-turbo.mjs` 执行 Turbo build。                                                        |
| `pnpm test`                                         | 经 Turbo 执行包测试。                                                                                |
| `pnpm typecheck`                                    | 经 Turbo 执行包类型检查。                                                                            |
| `pnpm lint`                                         | ESLint 检查 `apps`、`packages`、`scripts`，随后运行依赖清单边界检查。                                |
| `pnpm format:check`                                 | Prettier 格式检查。                                                                                  |
| `pnpm check:boundaries`                             | 单独检查工作区包依赖清单。                                                                           |

各 package manifest 中记录包级脚本。全新克隆后，先运行 `pnpm install --frozen-lockfile`，再运行上表中的 adapter build，之后才能启动 `pnpm dev`：adapter 的 package exports 指向 `dist`，而根 `dev` 脚本不会通过 Turbo 自动构建依赖。`pnpm peers check` 是 pnpm 内建命令，不在 `package.json` scripts；既有记录曾通过。本轮没有运行安装或构建检查。

`scripts/check-boundaries.mjs` 读取 `apps/*/package.json` 和 `packages/*/package.json` 的 `dependencies`、`devDependencies`、`peerDependencies`，按包名白名单验证 `@itools/*` 依赖方向。它不解析 TypeScript/JavaScript 源码 import，也不验证所有源码导入路径。`scripts/run-turbo.mjs` 用 Node 启动本地锁定的 Turbo，并设置 `TURBO_TELEMETRY_DISABLED=1`。

## 契约公开入口

`packages/contracts/src/index.ts` 是 contracts 唯一的包入口，公开导出以下模块：

| 源文件               | 内容                                                | 尚未提供                         |
| -------------------- | --------------------------------------------------- | -------------------------------- |
| `src/api.ts`         | `ApiErrorSchema`、`apiSuccessSchema`                | HTTP 路由、API client、OpenAPI。 |
| `src/asset.ts`       | 资产 ID、角色与任务引用 Schema                      | IndexedDB 或资产读写。           |
| `src/environment.ts` | `ServerEnvironmentSchema`、`parseServerEnvironment` | 服务进程和数据库连接。           |
| `src/task.ts`        | 任务状态枚举、进度和记录形状                        | 状态机、队列、Worker、持久化。   |
| `src/tool.ts`        | Tool manifest、`ToolDefinition`、adapter 执行接口   | 注册表、真实工具和执行宿主。     |

工具契约版本目前为 `TOOL_CONTRACT_VERSION = 1`。Schema 只校验所描述的数据形状，不代表任何消费端已经实现。

## 当前模块职责

| 路径                             | 职责及边界                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/contracts`             | 纯共享契约，运行依赖 TypeBox；不依赖 UI、数据库实现或具体工具。                     |
| `packages/design-system-adapter` | 对 MD3 库、固定主题及字体做应用适配；应用从此包导入基础 UI。                        |
| `apps/web`                       | Vite/React 阶段 2 展示预览；样例目录与任务均在内存中，不调用 contracts 执行或存储。 |
| `scripts/check-boundaries.mjs`   | 工作区 manifest 依赖方向检查，不是源码静态依赖分析器。                              |
| `scripts/run-turbo.mjs`          | 为根级 Turbo 命令提供跨平台 Node 启动包装。                                         |

`tsconfig.base.json` 配置严格 TypeScript 基础选项；根 ESLint、Prettier 配置统一工程检查。`.gitattributes` 固定仓库文本换行行为。真实配置以根配置文件和各包清单为准。

## 已有验收记录

阶段 1 的独立克隆记录曾报告 frozen-lockfile 安装、format、lint、typecheck、build、peer 检查通过，contracts 有 4 项测试，manifest 边界脚本的违规依赖负向检查也通过。阶段 2 后续记录为 22 项测试：contracts 4、adapter 9、web 9；并记录 build、lint、typecheck、format、peer 检查通过。以上均为历史验收证据，本次文档改写未重跑。

尚未实现的架构规划见 `docs/00`–`15`：其中 Fastify/SSR、PostgreSQL/Drizzle、TypeBox 路由、TanStack Query、i18next、Worker、IndexedDB、身份认证、PWA、CI 与部署均不得据规划文档描述为现有能力。阶段推进与冲突状态见 [当前审计](16-stage-0-audit.md) 和 [接手指南](19-agent-handoff.md)。
