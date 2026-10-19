# 17 · 阶段 1 工作区与共享契约

> 日期：2026-10-19。本文件记录已创建的基础工程；后续应用与包需按相同边界规则接入。

## 当前目录职责

| 路径 | 职责 | 公开入口与允许依赖 |
| --- | --- | --- |
| `packages/contracts` | API 错误/成功响应、资产引用、任务状态/进度、工具清单和执行适配器、服务端环境配置 Schema | 仅通过 `src/index.ts` 导出；运行依赖 `typebox`，不得依赖 UI、数据库或具体工具 |
| `scripts/check-boundaries.mjs` | 检查工作区包清单的 `@itools/*` 依赖方向 | Node.js 内置模块 |
| `scripts/run-turbo.mjs` | 跨平台运行 Turborepo，并禁用其匿名遥测 | 本地锁定的 Turbo 包 |
| `tsconfig.base.json` | 全局 TypeScript strict 与统一编译基础设置 | 各包继承 |
| `eslint.config.mjs`、`prettier.config.mjs` | 代码检查与格式 | 根级统一配置 |

工作区扫描 `apps/*` 与 `packages/*`。`apps` 暂无实现，不创建空应用包。未来包的允许依赖由 `scripts/check-boundaries.mjs` 约束；跨包导入只使用各包公开入口。`packages/contracts` 下的 `api.ts`、`asset.ts`、`environment.ts`、`task.ts`、`tool.ts` 分别承担单一契约职责。共享契约版本从 `TOOL_CONTRACT_VERSION = 1` 开始；后续不兼容变更必须升级版本并添加兼容性测试。

## 安装与验证

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm peers check
```

`pnpm-lock.yaml` 固定直接及传递依赖。`pnpm format` 只格式化代码和配置；历史架构文档保留原有格式。`pnpm lint` 还会运行依赖边界检查。构建产物、缓存和环境文件不提交。

## 契约边界

- `ToolManifestSchema` 验证稳定 ID、分类、路由键、依赖、翻译命名空间、必要浏览器 API、支持格式及资源声明；`ToolDefinition` 关联输入/输出 Schema 和执行适配器。取消接口使用平台无关的 `CancellationSignal`，由后续 Worker 运行时适配。
- `TaskStatusSchema`、`TaskProgressSchema` 和 `TaskRecordSchema` 定义消息与记录形状；状态转换规则、调度与 Worker 池留待阶段 5 实现。
- `AssetReferenceSchema` 定义资产 ID/角色/任务引用；IndexedDB 持久化留待阶段 6 实现。
- `ServerEnvironmentSchema` 与 `parseServerEnvironment` 校验服务端关键配置，异常不回显连接串；具体服务器启动留待阶段 7 实现。
- `ApiErrorSchema` 要求稳定代码、消息与 request ID；服务端路由、OpenAPI 和 API client 留待阶段 7 实现。

## 阶段 1 验收记录

| 项目 | 当前结果 |
| --- | --- |
| 目标 | 可重复安装、构建、测试的工作区；基础共享契约与模块边界。 |
| 修改文件 | 根级工作区、配置、锁文件、`scripts/*`、`packages/contracts/*`、`README.md`、本文件。 |
| 版本选择 | Node.js `>=22`；本地 pnpm 11.25.0；依赖精确版本见 `package.json`、`packages/contracts/package.json` 与锁文件。 |
| 安装与测试 | 从 Git `main` 提交 `096ea09` 独立克隆后，锁文件安装、格式、Lint、类型、契约测试、构建和 peer 检查全部通过。 |
| 已知范围 | 阶段 0 D-06 仍需在阶段 3/4 前调整集成验收顺序；设计、应用、数据库、CI 均未实现。 |
| 是否进入阶段 2 | 阶段 1 验收通过，可进入阶段 2；阶段 0 的 D-06 应在阶段 3/4 的集成验收前处理。 |

### 实际检查结果

- `git clone --no-hardlinks --no-local --branch main`：独立克隆提交 `096ea09` 成功；`git ls-files --eol` 证实文本文件工作区换行符为 LF。
- 克隆内 `pnpm install --frozen-lockfile`：通过，从锁文件安装 132 个依赖包，无 peer 依赖问题。
- 克隆内 `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm peers check`：均通过。
- 克隆内 `pnpm test`：1 个测试文件、4 个测试通过，覆盖状态枚举、工具清单、API 响应与环境配置。
- `node scripts/check-boundaries.mjs`：通过。临时加入工具包到工具包的违规依赖后，脚本按预期拒绝；测试夹具已移除。
- 本地 Git 仓库已初始化为 `main`。第一次独立克隆的格式检查因 Windows 自动转换 CRLF 而失败；新增 `.gitattributes` 固定 LF 后，第二次独立克隆的全部检查通过。
- 两个仅用于验证的克隆目录位于 `D:\桌面\iTools-MD3-stage1-verify` 和 `D:\桌面\iTools-MD3-stage1-verify-2`，均在主工作目录之外。自动审批以 `blocked by policy` 拒绝了已核对路径的递归清理命令，因此目录暂时保留；不影响阶段 1 的安装与质量验收。
- GitHub Actions CI 由阶段 11 负责，本阶段没有远程 CI 运行证据。
