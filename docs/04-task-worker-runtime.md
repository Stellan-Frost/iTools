# 04 · 任务运行时与 Worker

> 定位：定义任务从提交、排队、执行、取消到结果提交的唯一合法路径，防止页面或工具绕过调度与状态机。
> 状态：部分实现（阶段 5 完成运行时包本体与 66 项测试；**未接线**：无真实 Worker 脚本、无任务 UI、无持久化、无应用级运行时实例）。
> 代码入口：`packages/task-runtime/src/domain/{task-state,resource-budget,task-error}.ts`、`packages/task-runtime/src/application/{task-scheduler,task-runtime,task-runner,scheduler-policy}.ts`、`packages/task-runtime/src/infrastructure/worker/**`。

## 1. 当前事实

| 项 | 当前事实 |
| --- | --- |
| 包依赖 | `@itools/task-runtime` 只依赖 `@itools/contracts` 与 `typebox`；不依赖 React、DOM 或 Node 内置模块 |
| 测试 | 66 项：状态机 10、资源预算 6、调度器 18、运行时 8、协议 7、Worker 池 7、Worker 执行器 10 |
| 未接线 | **没有真实 Worker 脚本、没有任务 UI、没有持久化**；任务记录只在 `TaskScheduler` 的 `Map` 中，刷新即丢失 |
| 应用级实例 | **没有**。`createTaskRuntime` 只在测试中被调用；仓库没有 `createTaskRuntime(...)` 的生产单例 |
| 测试替身 | `src/test-support/{fake-task-runner,fake-worker,fake-timer}.ts`，被 `tsconfig.build.json` 排除，不进入 `dist` |
| 隐私 | `check:privacy` 扫描生产源码，禁止 `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `sendBeacon` |

**调度策略**：全局 FIFO；`pump()` 从队首扫描，队首放不下时跳过，允许后续更轻任务先运行，其余顺序不变（`task-scheduler.ts:140-171`）。

| 预算项 | 默认值 | 预算项 | 默认值 |
| --- | --- | --- | --- |
| `maxConcurrentTasks` | 4 | `maxTotalMemoryBytes` | 1536 MiB |
| `perToolConcurrency` | 1 | `maxQueueLength` | 50 |

**消息协议**（`contracts/task.ts`）：主 → Worker 为 `start{taskId,input}` / `cancel{taskId}`；Worker → 主为 `progress{progress}` / `complete{taskId,output}` / `error{taskId,error}` / `cancelled{taskId}`。主线程只对出站消息调用 `decodeOutboundMessage`（TypeBox + `additionalProperties: false`）；入站 Schema 已定义，但主线程发送端尚未校验。

**7 态状态机**（`domain/task-state.ts` 是唯一转换表）：

| 事件 | 合法起始状态 → 目标状态 | 说明 |
| --- | --- | --- |
| `prepare` | `queued` → `preparing` | 调度器已准入，准备启动执行器 |
| `start` | `preparing` → `running` | 执行器已创建 |
| `complete` | `running` → `completed` | 仅在 `commitResult` 成功后 |
| `fail` | `queued` / `preparing` / `running` / `cancelling` → `failed` | 任一阶段可失败 |
| `request-cancel` | `queued` → `cancelled`；`preparing` / `running` → `cancelling` | 排队任务无执行体，直接取消 |
| `confirm-cancel` | `cancelling` → `cancelled` | 协作确认或超时强杀后 |

终态集合：`completed`、`failed`、`cancelled`。未列出的组合抛 `TaskStateError`，`code = invalid-task-transition`，并携带 `from` 与 `event`。

**稳定错误码**（`domain/task-error.ts`）：

| code | 触发场景 | `retryable` |
| --- | --- | --- |
| `queue-full` | 排队数已达 `maxQueueLength` | true |
| `worker-start-failed` | Worker 池获取租约失败 / 执行器启动抛错 | true |
| `worker-crashed` | Worker 触发 `error` 事件 | true |
| `protocol-violation` | Worker 消息未通过 TypeBox 校验 | false |
| `result-commit-failed` | `commitResult` 抛错 | false |
| `execution-failed` | 未知异常被 `toTaskError` 收敛 | true |
| `runtime-disposed` | 运行时销毁后继续提交 | false |
| `task-not-found` | 查询/取消不存在的任务 | false |

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `packages/task-runtime/src/domain/task-state.ts` | 7 态、转换表、`transitionStatus`、`nextStatus`、`isTerminalStatus`、`TERMINAL_TASK_STATUSES` |
| `packages/task-runtime/src/domain/resource-budget.ts` | `reserve`、`release`、`findBudgetConflict`、`isAdmissible`；纯函数，不持状态 |
| `packages/task-runtime/src/domain/task-error.ts` | `TASK_ERROR_CODES`、`createTaskError`、`toTaskError`、`TaskNotFoundError`、`RuntimeDisposedError` |
| `packages/task-runtime/src/application/scheduler-policy.ts` | `DEFAULT_SCHEDULER_BUDGET`、`DEFAULT_MAX_QUEUE_LENGTH`、`DEFAULT_CANCEL_TIMEOUT_MS` |
| `packages/task-runtime/src/application/task-runner.ts` | `TaskRunner`、`TaskExecution`、`TaskExecutionResult`、`TaskStartRequest`、`TaskProgressReporter` |
| `packages/task-runtime/src/application/task-scheduler.ts` | 准入、队列、状态流转、预算占用/释放、进度、取消、结果提交 |
| `packages/task-runtime/src/application/task-runtime.ts` | 全局外观：`createTaskRuntime`、订阅/退订、默认预算与任务 ID |
| `packages/task-runtime/src/application/task-types.ts` | `TaskSnapshot`、`TaskSubmitInput`、`TaskRuntimeEvent` |
| `packages/task-runtime/src/infrastructure/worker/worker-pool.ts` | `EngineWorkerPool`、`WorkerLease`、按引擎复用与上限 |
| `packages/task-runtime/src/infrastructure/worker/worker-runner.ts` | `createWorkerRunner`：租约 → start → 进度/完成/错误/取消；超时强杀 |
| `packages/task-runtime/src/infrastructure/worker/worker-messages.ts` | `decodeOutboundMessage`、`WorkerProtocolError`；只校验 Worker → 主线程 |
| `packages/task-runtime/src/infrastructure/timer.ts` | `TimerApi` 接缝，运行时不自带 `setTimeout` |
| `packages/task-runtime/src/test-support/**` | `FakeTaskRunner`、`FakeExecution`、`FakeWorker`、`createFakeWorkerFactory`、`flushMicrotasks` |

## 3. 必须遵守的规则

| # | 规则 | 可检查点 |
| --- | --- | --- |
| 1 | 除创建初始 `queued` 快照外，`status` 只能由 `transitionStatus` 计算；`TaskScheduler.applyTransition` 是唯一写入口 | `task-scheduler.ts:72-79` 仅初始化；`task-scheduler.ts:308-326` 统一转换 |
| 2 | 终态不接受任何事件；取消终态任务是无操作，重复取消是幂等 | `task-scheduler.ts:94-109`；`task-state.ts:65-67` |
| 3 | 取消必须两步：运行中先 `request-cancel` 进入 `cancelling`，收到 `cancelled` 或超时后才 `confirm-cancel` | `task-scheduler.ts:196-203`；`task-scheduler.test.ts` 的“运行中取消先进入 cancelling” |
| 4 | Worker 取消先发 `cancel` 消息；超过 `cancelTimeoutMs`（默认 2000ms）未确认，终止 Worker 并 `discard` 重建，任务仍记 `cancelled` | `worker-runner.ts:168-177`；`scheduler-policy.ts:18`；`worker-runner.test.ts` 的超时用例 |
| 5 | 只有 `commitResult(taskId, output)` 成功返回资产 ID 后，才允许 `completed`；失败必须 `failed` + `result-commit-failed` | `task-scheduler.ts:257-276`；`task-scheduler.test.ts` 的结果提交用例 |
| 6 | 取消确认后到达的结果一律丢弃：不写资产、不标完成；提交期间取消同样不得标完成 | `task-scheduler.ts:234-243`、`task-scheduler.ts:268-273`；`task-scheduler.test.ts` 的“迟到的完成结果被丢弃” |
| 7 | 预算只在 `startTask` 预留、在成功/失败/取消/销毁时释放一次；不得手工改 `usage` 或按工具覆盖预算 | `task-scheduler.ts:178-185`、`task-scheduler.ts:328-339`；`scheduler-policy.ts` 只导出集中常量 |
| 8 | 队列上限在入队前检查；超限直接 `failed` + `queue-full`，不得无限排队或丢弃旧任务 | `task-scheduler.ts:84-88`；`task-scheduler.test.ts` 的“队列超过上限” |
| 9 | `TaskRunner.start` 必须同步返回 `TaskExecution`；`done` 只能结算一次；`requestCancel` 只请求协作；`dispose` 必须幂等 | `task-runner.ts:23-37`；`fake-task-runner.ts` 的 `isSettled` |
| 10 | Worker → 主线程消息必须经 `decodeOutboundMessage`；禁止 `event.data as WorkerOutboundMessage` 跳过校验 | `worker-runner.ts:75-91`；`worker-messages.ts:23-28` |
| 11 | `WorkerLease.release` 必须成对；崩溃、协议违规、取消超时必须 `{ discard: true }`，不得把不可信 Worker 放回空闲池 | `worker-pool.ts:93-122`；`worker-pool.test.ts` 的 discard 用例 |
| 12 | 订阅者退订只移除监听器，不取消任务；监听器抛错不得中断调度或其他监听器 | `task-runtime.ts:64-73`、`task-runtime.ts:81-86`；`task-runtime.test.ts` 的“页面卸载退订不会取消任务” |
| 13 | 运行时与 Worker 不得持久化、不得发网络请求；持久化只能由宿主在 `commitResult` / 事件回调中完成 | `check:privacy`；`packages/task-runtime/package.json` 无存储/网络依赖 |

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| 页面/组件直接 `new Worker(...)` 或直接调用 `adapter.execute` | 提交 `TaskRuntime.submit({ toolId, engine, input, resources })`，由调度器选择 `TaskRunner` |
| 直接写 `task.status = 'completed'`、自造 `'done'` / `'success'` 状态 | 只调 `transitionStatus(from, event)`；状态值来自 `TaskStatusSchema` |
| 取消时立即 `worker.terminate()` 并把任务标 `cancelled` | 先发 `cancel`；等 `cancelled` 或 2000ms 超时后再确认并 `discard` |
| 收到 `complete` 就先标 `completed`，再异步写资产 | 先 `await commitResult`；失败改走 `failed` + `result-commit-failed` |
| 主线程把 `event.data` 强转为协议类型 | 调用 `decodeOutboundMessage(event.data)`；失败按 `protocol-violation` 丢弃 Worker |
| Worker 崩溃后 `release()` 回空闲池继续复用 | `release({ discard: true })` 终止并让池新建 Worker |
| 用 `unsubscribe()` 或页面卸载来“取消任务” | 退订只停止收事件；需要停止时显式 `runtime.cancel(taskId)` |
| 在 Worker 内写 IndexedDB / 调 `fetch` / 发遥测 | Worker 只计算；结果回主线程后由宿主的 `commitResult` 写入本地资产 |
| 给每个工具自定义并发/内存预算，或忽略 `estimatedMemoryBytes` 传 1 | 使用 `DEFAULT_SCHEDULER_BUDGET`，提交时传 manifest 的真实估算值 |
| 队列满时静默丢弃最旧任务或让它一直排队 | 返回 `failed` + `queue-full`，`retryable: true`，由 UI 提示重试 |

## 5. 如何验证

```sh
pnpm --filter @itools/task-runtime test
# 期望：Tests 66 passed

pnpm --filter @itools/task-runtime exec vitest run src/domain/task-state.test.ts
# 期望：Tests 10 passed（合法转换、非法转换、终态、取消两步）

pnpm --filter @itools/task-runtime exec vitest run src/infrastructure/worker/worker-runner.test.ts
# 期望：Tests 10 passed（start/complete、进度、error、取消复用、超时强杀、协议违规）

pnpm --filter @itools/task-runtime build
test ! -d packages/task-runtime/dist/test-support && echo "test-support 未进入 dist"
# 期望：输出 test-support 未进入 dist

pnpm check:privacy
# 期望：隐私边界检查通过：2 个本地包无网络调用。

pnpm --filter @itools/task-runtime typecheck
# 期望：退出码 0

pnpm verify
# 期望：全链路通过；当前基线 593 项测试、HTTP 验收 28/28、PWA 验收 99/99
```

## 6. 常见任务（step-by-step）

### 6.1 新增一个 Worker 引擎

1. 确定引擎 id（例如 `image`）。它必须同时作为 `TaskSubmitInput.engine` 与 `EngineWorkerPool.acquire(engine)` 的键；当前没有集中式引擎注册表，宿主必须自己保证映射一致。
2. 在工具包内新建 Worker 脚本（例如 `packages/tool-<id>/src/worker/<engine>.worker.ts`）。工具包只能依赖 `contracts/app-core/adapter`，**不能 import `@itools/task-runtime`**；用 `WorkerInboundMessageSchema` 与 `WorkerOutboundMessageSchema` 校验消息形状。
3. Worker 收到 `start` 后调用 `definition.adapter.execute(input, context)`；`context.reportProgress` 发送 `{ type: 'progress', progress: { taskId, completed, total?, messageKey? } }`；成功发送 `complete`，失败发送 `error`，取消发送 `cancelled`。
4. 宿主创建池：`new EngineWorkerPool({ createWorker: () => new Worker(new URL(...), { type: 'module' }), maxWorkersPerEngine })`；同一引擎复用空闲 Worker，超过上限时排队。
5. 创建执行器：`createWorkerRunner({ pool, timer, cancelTimeoutMs: DEFAULT_CANCEL_TIMEOUT_MS })`；`timer` 必须注入 `setTimeout/clearTimeout` 适配，运行时不自带。
6. 创建运行时：`createTaskRuntime({ runner, commitResult })`；`commitResult` 由宿主提供（资产包场景用 `createAssetResultCommitter`）。
7. 提交任务时把 `manifest.estimatedMemoryBytes` 放进 `resources.estimatedMemoryBytes`；不要用占位 1，否则预算失去意义。
8. 用 `FakeWorker` 补测试：正常完成、进度错配 taskId、error、取消复用、2000ms 超时强杀、非法消息；再跑 §5 的命令。

### 6.2 新增一个非 Worker 的 `TaskRunner`

1. 实现 `TaskRunner.start(request, reporter): TaskExecution`；`done` 只能 resolve 一次，内部异常必须收敛为 `{ status: 'failed', error }`，不得让 Promise 永久挂起。
2. `requestCancel()` 只设置协作标志；实现应在安全点检查并尽快结算 `{ status: 'cancelled' }`。
3. `dispose()` 必须幂等，并释放底层资源；调度器在完成、失败、取消、销毁时都会调用。
4. `reporter.reportProgress` 只上报 `progress.taskId === request.taskId` 的进度；错配进度必须忽略。
5. 用 `FakeTaskRunner` 的模式补测试，至少覆盖：成功、失败、取消、启动抛错、进度、`dispose` 幂等。

### 6.3 接入任务 UI 与持久化

1. 在应用装配层创建**单例**运行时（不要在组件 render 中创建）；把 `runner`、`commitResult`、预算注入一次。注意 `apps/web` 当前依赖白名单不含 `@itools/task-runtime`，接线前必须先扩展 `scripts/check-boundaries.mjs` 与 `scripts/check-import-boundaries.mjs`。
2. 组件在 `useEffect` 中 `runtime.subscribe(listener)`，清理函数只退订；路由切换/页面卸载不得调用 `cancel`。
3. 用户触发执行时调用 `runtime.submit(...)`；渲染 `TaskSnapshot.status` 与 `progress`，不得伪造进度；取消按钮调用 `runtime.cancel(taskId)`。
4. 任务记录持久化不属于运行时：宿主在事件回调中把 `TaskSnapshot` 映射为 `TaskRecord` 并 `writeTaskRecord`；`snapshot.error?.code` 映射到 `TaskRecord.errorCode`。
5. 刷新恢复策略尚未定义：不得把持久化的 `running` 直接当仍在运行；需要“标记中断/重新排队”的明确决策后再实现。

## 7. 已知限制与相关决策

- **未接线**：没有真实 Worker 脚本、没有任务 UI、没有任务持久化、没有应用级运行时单例；`src/test-support/**` 被 `tsconfig.build.json` 排除，不能当生产依赖。
- 调度器不校验 `TaskSubmitInput` 的运行时形状；`TaskResourceRequestSchema` / `TaskSchedulerBudgetSchema` 目前只在契约测试中使用。宿主必须自己保证 `estimatedMemoryBytes >= 1` 且 `computeClass` 合法。
- 入站消息 `start` / `cancel` 有 TypeBox Schema，但主线程发送时未校验；Worker 端接入时必须自行 `Value.Check(WorkerInboundMessageSchema, event.data)`。
- 单个任务的 `estimatedMemoryBytes` 若大于 `maxTotalMemoryBytes`，会永久停在队列（当前没有拒绝或超时）；接入工具时必须保证估算值不超过 1536 MiB。
- `finish` 在 `commitResult` 期间被取消时不会回滚已写入的结果资产，只保证任务不标 `completed`；残留资产需由保留策略或调用方处理。
- `TaskScheduler.dispose()` 对处于 `cancelling` 的任务会再次发 `request-cancel`，该转换不在转换表中，会抛 `TaskStateError`；现有测试只覆盖 `queued` / `running`，接 UI 前需补处理。
- 默认任务 ID 是进程内自增 `task-<n>`，刷新/多标签页会撞号；虽然 `createTaskId` 可注入，但产品尚未替换为 UUID。
- 预算数值是阶段 5 初始值，不是性能结论；并发、内存、进度节流与浏览器 `terminate()` 时机均未做性能基线或 E2E 验证（阶段 11）。
- 相关决策：D25（阶段 5 只交付运行时本体，用测试替身验收）、D23（执行 UI 留到首个真实工具）、D06（阶段 3/4 只验收不依赖数据库与任务运行时的部分）、D16（任务与资产端口仍只有单一实现，暂不冻结）。
