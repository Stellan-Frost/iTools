# 04 · 任务状态机、调度器与 Worker

> 状态：**已实现（阶段 5）**。代码入口：`packages/task-runtime`。
> 阶段 5 只交付运行时本身：**没有接入任何真实工具，也没有任务 UI**；任务区仍是预览说明。接入首个工具时按 03 §5 补注入点。

## 1. 包与分层

`@itools/task-runtime` 只依赖 `@itools/contracts`，不依赖 React、DOM 或 Node 内置模块，因此可在 node 环境下用测试替身完整验收。

| 目录 | 职责 |
| --- | --- |
| `src/domain/` | 纯规则：状态机、资源预算、错误码。无 I/O、无时间依赖 |
| `src/application/` | 调度器、运行时外观、执行器契约、预算默认值 |
| `src/infrastructure/` | Worker 池、消息协议校验、Worker 执行器、定时器接缝 |
| `src/test-support/` | 测试替身（Worker / 执行器 / 定时器），**不进入构建产物** |

关键接缝：调度器只认识 `TaskRunner`，因此 Worker、WASM 或同线程实现都可以替换；`TimerApi` 与 `now` / `createTaskId` 均为注入项，测试不依赖真实定时器与系统时钟。

## 2. 状态机（唯一实现：`domain/task-state.ts`）

7 个状态：`queued`、`preparing`、`running`、`cancelling`、`completed`、`failed`、`cancelled`。

| 事件 | 合法起始状态 → 目标状态 |
| --- | --- |
| `prepare` | `queued` → `preparing` |
| `start` | `preparing` → `running` |
| `complete` | `running` → `completed` |
| `fail` | `queued` / `preparing` / `running` / `cancelling` → `failed` |
| `request-cancel` | `queued` → `cancelled`；`preparing` / `running` → `cancelling` |
| `confirm-cancel` | `cancelling` → `cancelled` |

规则：

- 未列出的组合一律抛 `TaskStateError`（`code = invalid-task-transition`），不提供“猜测式”转换。
- 终态不接受任何后续事件。
- 取消分两步：先请求，再确认。排队任务没有执行体，因此直接进入 `cancelled`。
- **只有结果提交成功后才标记 `completed`**（见 §4）。

## 3. 调度策略（`application/task-scheduler.ts`）

- 全局 FIFO；在队首放不下时**跳过**该任务，尝试执行后续更轻的任务，其余顺序不变。
- 三重准入限制，集中配置在 `application/scheduler-policy.ts`：

| 预算项 | 默认值 | 说明 |
| --- | --- | --- |
| `maxConcurrentTasks` | 4 | 全局同时运行任务数 |
| `maxTotalMemoryBytes` | 1536 MiB | 运行中任务的内存预留总和 |
| `perToolConcurrency` | 1 | 单工具并发上限 |
| `maxQueueLength` | 50 | 排队上限，超出直接失败 `queue-full` |
| `cancelTimeoutMs` | 2000 | 协作取消等待上限 |

- 任务在提交时声明 `resources.estimatedMemoryBytes` 与 `computeClass`；预算以保守预留为准，结束（成功、失败、取消）即释放。
- 预算数值是阶段 5 的初始值，**不是性能结论**；阶段 11 测基线后由用户确认调整。
- 队列上限只统计排队任务；运行时销毁后提交会抛 `RuntimeDisposedError`。

## 4. 结果提交与取消

- `commitResult(taskId, output)` 由宿主注入；成功返回资产 ID 列表，失败则任务 `failed`（`result-commit-failed`）。
- 提交期间用户取消：结果丢弃，任务按取消处理，**不写资产、不标记完成**。
- 取消确认后迟到的 `complete` 同样被丢弃，这条规则有测试固定。
- 取消是协作式的：先发 `cancel` 消息等确认；超时则终止 Worker 并重建（`discard`），任务仍记为 `cancelled`。

## 5. Worker

- `EngineWorkerPool` 按引擎分组，复用空闲 Worker；超过 `maxWorkersPerEngine` 时排队等待租约。
- `discard` 表示 Worker 已不可信（崩溃、协议违规、强杀），必须终止而不是回收。
- 消息协议的唯一形状来源是 `contracts/task.ts`：入站 `start` / `cancel`，出站 `progress` / `complete` / `error` / `cancelled`；解码经 TypeBox 校验，`additionalProperties: false` 防止协议漂移。
- 非法消息视为任务失败（`protocol-violation`）并丢弃 Worker；`error` 事件视为 `worker-crashed`。
- Worker 只计算，不持久化、不接触调度器。

## 6. 生命周期与页面关系

- 运行时是全局实例，任务不绑定 React 组件；订阅者退订（页面卸载、路由切换）不会取消任务。测试固定了这一点。
- 刷新/关闭页面时未完成任务不承诺继续执行；跨会话持久化属于阶段 6（IndexedDB）。
- 默认任务 ID 为进程内自增（`task-<n>`）；阶段 6 接入持久化时改为可注入 UUID，避免跨会话撞号。

## 7. 错误

- 稳定错误码：`queue-full`、`worker-start-failed`、`worker-crashed`、`protocol-violation`、`result-commit-failed`、`execution-failed`、`runtime-disposed`、`task-not-found`。
- 面向用户的字段是 `code` / `messageKey` / `retryable`；`detail` 只放非敏感说明，禁止堆栈、内部路径与用户数据。
- 任务区 UI（Snackbar / 就地错误 / 重试）尚未实现，随首个真实工具落地。

## 8. 验收与已知限制

- 66 项运行时测试：状态机 10、资源预算 6、调度器 18、运行时 8、协议 7、Worker 池 7、Worker 执行器 10。
- 契约测试新增 2 项（协议双向校验、资源请求与预算校验）。
- 全仓 `pnpm verify` 通过（207 项测试、28 项 HTTP 验收）。
- 已知限制：没有真实工具与真实 Worker 脚本；没有任务持久化；没有 UI；并发与内存预算未经性能基线校准；浏览器内真实 Worker 行为（如 `terminate()` 时机）尚无 E2E 覆盖，属阶段 11。
