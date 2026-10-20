# 05 · 文件资产与本地存储

> 定位：定义用户文件在浏览器本地的落库、校验、引用、保留、归档与任务结果提交边界，确保文件不上传、升级不丢数据。
> 状态：部分实现（阶段 6 完成 `@itools/asset-store` 本体与 131 项测试；**未接线**：未接页面、未接任务运行时；IndexedDB 仅在 `fake-indexeddb` 下验证）。
> 代码入口：`packages/asset-store/src/create-asset-store.ts`、`packages/asset-store/src/index.ts`、`packages/asset-store/src/domain/**`、`packages/asset-store/src/application/**`、`packages/asset-store/src/infrastructure/indexeddb/**`。

## 1. 当前事实

| 项 | 当前事实 |
| --- | --- |
| 包依赖 | 只依赖 `@itools/contracts` 与 `typebox`；`tsconfig.json` 启用 DOM lib 以使用 `Blob` / IndexedDB；无 React、无服务端依赖 |
| 测试 | 131 项：领域校验/引用/保留/归档、应用服务、对象 URL、结果提交、归档服务、IndexedDB 仓储、组装 |
| 数据库 | `itools-assets`，`ASSET_DATABASE_VERSION = 1`；对象仓库 `assets`、`blobs`、`references`、`tasks`、`meta` |
| 写入原子性 | `writeAsset` 在**单个 readwrite 事务**内写元数据 + Blob + 引用；失败由 IndexedDB `abort` 回滚 |
| 校验 | `validateAssetDraft` 收集全部问题；`assertValidAssetDraft` 抛 `AssetValidationError`；不做修剪 |
| 保留 | 源文件默认保留 7 天（`DEFAULT_SOURCE_RETENTION_MS`）；只清理 `source` |
| 归档 | 单个 JSON，`formatVersion = 1`；可选把内容以 base64 内联到 `dataBase64` |
| 隐私 | `check:privacy` 扫描生产源码，asset-store 内禁止任何网络调用 |
| 接线 | `createAssetStore` / `openAssetDatabase` 只在测试中被调用；页面与任务运行时均未接线 |
| 浏览器验证 | 仅 `fake-indexeddb`（Node）验证；未做 Safari、多标签页、真实配额验证 |

**三类资产角色**（`contracts/asset.ts`）：

| role | 创建 API | `taskId` 要求 | 自动清理 |
| --- | --- | --- | --- |
| `source` | `service.createSource(input)` | 可选；空白字符串归一为 `undefined` | 超过保留期且未被引用、不属活动任务时可删 |
| `intermediate` | `service.createIntermediate(input)` | 可选；有值则写引用 | 永不由保留策略删除 |
| `result` | `service.createResult(input & { taskId: string })` | **必填且去空白后非空** | 永不由保留策略删除 |

**IndexedDB 结构**：

| store | keyPath | 索引 | 内容 |
| --- | --- | --- | --- |
| `assets` | `assetId` | `by-task(taskId)`、`by-created(createdAt)` | `AssetRecord` 元数据 |
| `blobs` | `assetId` | 无 | `{ assetId, blob }` |
| `references` | `[assetId, taskId]` | `by-asset(assetId)`、`by-task(taskId)` | `AssetReference` |
| `tasks` | `taskId` | 无 | `TaskRecord` |
| `meta` | `key` | 无 | 键值表；当前无公开 API 读写 |

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `packages/asset-store/src/create-asset-store.ts` | 组装入口：IndexedDB 仓储 + 资产服务 + 归档服务 + 对象 URL 工厂 + 配额适配 |
| `packages/asset-store/src/index.ts` | 公开导出：服务、端口、领域函数、IndexedDB 工具 |
| `packages/asset-store/src/application/ports.ts` | 冻结端口：`AssetRepository`、`AssetService`、`ObjectUrlFactory`、`StorageQuota`、`ArchiveService` 与输入/输出类型 |
| `packages/asset-store/src/application/asset-service.ts` | `createAssetService`：创建三类资产、读取、对象 URL、任务记录、清理、配额、重置 |
| `packages/asset-store/src/application/object-url.ts` | `createObjectUrlRegistry`：按 Blob 引用计数、幂等释放、`releaseAll` 失效旧句柄 |
| `packages/asset-store/src/application/result-committer.ts` | `createAssetResultCommitter`：把任务输出转为结果资产，结构兼容 `commitResult` |
| `packages/asset-store/src/application/archive-service.ts` | `exportToJson` / `importFromJson`：快照、写入、失败补偿 |
| `packages/asset-store/src/domain/asset-validation.ts` | 文件名 / MIME / 大小 / role 校验；只报告不修剪 |
| `packages/asset-store/src/domain/reference-integrity.ts` | 悬空引用、role 不匹配、空 taskId |
| `packages/asset-store/src/domain/retention.ts` | `planRetention`：纯函数，注入 `now`，输出 `keep/remove/skipped` |
| `packages/asset-store/src/domain/archive-format.ts` | 内置 base64 编解码、`buildArchive`、`parseArchive`、`validateArchiveContent` |
| `packages/asset-store/src/infrastructure/indexeddb/database.ts` | `openAssetDatabase`、`MIGRATIONS`、`onblocked` 立即失败、15s 看门狗 |
| `packages/asset-store/src/infrastructure/indexeddb/asset-repository.ts` | `createIndexedDbAssetRepository`：所有写操作单事务；`clearAll` 仅在显式流程 |
| `packages/asset-store/src/infrastructure/indexeddb/quota.ts` | `createBrowserStorageQuota`：`navigator.storage` 缺失/失败时降级 |
| `packages/asset-store/src/test-support/**` | `InMemoryAssetRepository`、`FakeObjectUrlFactory`、`FakeStorageQuota`；被 `tsconfig.build.json` 排除 |

## 3. 必须遵守的规则

| # | 规则 | 可检查点 |
| --- | --- | --- |
| 1 | `AssetRecord.sizeBytes` 只能取 `blob.size`；不得接受调用方传入的大小 | `asset-service.ts:62-69`；`asset-service.test.ts` 的“使用 blob.size” |
| 2 | 资产、内容、引用必须在同一事务写入；不得先写 `assets` 再写 `blobs` | `ports.ts:30-33`；`asset-repository.ts:78-121`；仓储测试“事务失败时不留任何部分记录” |
| 3 | 校验只报告、不修剪：空名用 `trim()` 判空，但长度检查针对原始值；不得静默截断文件名或 MIME | `asset-validation.ts:37-56`、`asset-validation.ts:93-104` |
| 4 | `result` 必须绑定非空 `taskId`；缺失或空白分别抛 `missing-task-id` / `result-requires-task`；`source`/`intermediate` 的空白 `taskId` 归一为 `undefined` | `asset-service.ts:94-123`；`asset-service.test.ts` 的 taskId 用例 |
| 5 | 引用必须与资产 role 一致且指向存在的资产；空 `taskId` 不允许 | `reference-integrity.ts:9-37`；归档导入复用 `validateArchiveContent` |
| 6 | 保留策略只处理 `source`；跳过优先级固定为 `not-source` > `referenced` > `active-task`；`createdAt` 不可解析时保留且不产生 `skipped` | `retention.ts:41-73`；`retention.test.ts` 的优先级与坏时间用例 |
| 7 | 对象 URL 必须成对 `acquire`/`release`；重复释放幂等；`releaseAll()` 后的旧句柄不得再撤销新 URL | `object-url.ts:37-66`；`object-url.test.ts` |
| 8 | 数据库升级只走版本化增量迁移：只允许 `createObjectStore` / `createIndex`；**永不自动清库**；缺迁移步骤直接 `abort` | `database.ts:30-52`、`database.ts:99-133`；D01 |
| 9 | `clearAll()` 只能由用户显式 `reset()` 或用户确认的 `replaceExisting` 导入调用；不得在升级路径调用 | `asset-service.ts:183-185`；`archive-service.ts:112-137`；全仓 grep `clearAll` 调用点 |
| 10 | 归档导入必须先完成全部校验再写入；`replaceExisting: true` 必须先快照，失败按快照恢复 | `archive-service.ts:76-137`；`archive-service.test.ts` 的“校验失败不写入”“写入失败按快照恢复” |
| 11 | `createAssetResultCommitter` 不得 import `@itools/task-runtime`；返回值结构满足 `(taskId, output) => Promise<readonly string[]>` | `result-committer.ts:1-39`；`check:imports` 的 asset-store 白名单只有 contracts |
| 12 | 包内不得出现 `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `sendBeacon`；不得引入 React/UI 层 | `check:privacy`；`packages/asset-store/package.json` 无 React 依赖；`check:boundaries` 限制工作区依赖 |
| 13 | `deleteAssets` 必须在单事务内删除资产、Blob 与相关引用；不存在的 ID 视为成功；删除失败必须冒泡 | `asset-repository.ts:182-221`；`asset-service.ts:172-176` |

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| 让调用方传 `sizeBytes`，或使用 `File.size` 之外的声明值 | 一律取 `blob.size`，再进入 `validateAssetDraft` |
| 先写元数据、再单独写 Blob 和引用 | 统一调用 `repository.writeAsset({ record, blob, references })`，单事务提交 |
| 在 asset-store 里 `fetch` 上传文件、发遥测或拉取 MIME 表 | 所有处理本地完成；网络调用会被 `check:privacy` 阻断 |
| 升级时 `deleteObjectStore` / `store.clear()` 来“修复结构” | 追加 `MIGRATIONS[N]`，只建仓库/索引；失败 `abort` 并拒绝启动 |
| 校验时把非法文件名 `trim()` / 截断后再写入 | 保留原值并抛出全部 issue；由 UI 让用户修改 |
| 直接 `URL.revokeObjectURL(url)`，或 `acquire` 后不 `release` | 通过 `createObjectUrlRegistry` 成对释放；`releaseAll` 只在 `dispose` 使用 |
| 创建 `result` 时省略 `taskId`，或把 `result` 当普通中间产物 | `createResult` 必须传非空 `taskId`；结果资产与任务引用同时写入 |
| 归档导入时边解析边写，或 `replaceExisting` 前不备份 | 先 `parseArchive` + `validateArchiveContent`，再写入；true 时先快照 |
| 为了复用 `commitResult` 类型而 import `@itools/task-runtime` | 保持结构兼容；由宿主把 `createAssetResultCommitter` 传给运行时 |
| 清理时删除所有未被引用的资产 | 只删过期 `source`；`intermediate` / `result` 永远保留（除非未来有明确决策） |

## 5. 如何验证

```sh
pnpm --filter @itools/asset-store test
# 期望：Tests 131 passed

pnpm --filter @itools/asset-store exec vitest run src/infrastructure/indexeddb/asset-repository.test.ts
# 期望：Tests 10 passed（原子写入、重复 ID、删除引用、缺内容不静默清理、clearAll）

pnpm --filter @itools/asset-store exec vitest run src/application/archive-service.test.ts
# 期望：Tests 10 passed（导出、导入、metadataOnly、校验失败、快照回滚、合并补偿）

pnpm --filter @itools/asset-store exec vitest run src/domain/retention.test.ts
# 期望：Tests 12 passed（7 天边界、优先级、坏时间、稳定排序）

pnpm --filter @itools/asset-store build
test ! -d packages/asset-store/dist/test-support && echo "test-support 未进入 dist"
# 期望：输出 test-support 未进入 dist

pnpm check:privacy
# 期望：隐私边界检查通过：2 个本地包无网络调用。

pnpm check:boundaries && pnpm check:imports
# 期望：两条命令退出码均为 0

pnpm verify
# 期望：全链路通过；当前基线 593 项测试、HTTP 验收 28/28、PWA 验收 99/99
```

## 6. 常见任务（step-by-step）

### 6.1 新增一种资产角色

1. 在 `packages/contracts/src/asset.ts` 的 `AssetRoleSchema` 增加字面量，并同步 `AssetRole` 类型；这是跨包契约变更，需先确认是否提升 `ASSET_ARCHIVE_FORMAT_VERSION`（旧读取方会拒绝未知 role）。
2. 在 `packages/asset-store/src/domain/asset-validation.ts` 的 `KNOWN_ROLES` 加入新 role，否则 `validateAssetDraft` 报 `unknown-role`。
3. 在 `application/ports.ts` 的 `AssetService` 增加 `create<Role>` 方法，并在 `asset-service.ts` 用统一的 `persist(input, role, taskId)` 实现；在 `src/index.ts` 导出新类型。
4. 决定保留语义：`planRetention` 目前把所有 `role !== 'source'` 归为 `not-source` 并永久保留；若新角色需要过期，必须改 `retention.ts` 并补 `skipped` 原因与测试。
5. 归档无需改 Schema（`AssetArchiveEntrySchema` 复用 `AssetRoleSchema`），但必须补 round-trip 测试；若旧版本不能读新 role，提升 `ASSET_ARCHIVE_FORMAT_VERSION`。
6. 补测试：校验、创建、引用、保留、归档；执行 §5 的命令。

### 6.2 新增一个 IndexedDB 版本

1. 在 `database.ts` 提升 `ASSET_DATABASE_VERSION`，并向 `MIGRATIONS` 追加目标版本键；历史步骤保持原样，老用户可能从任意旧版本升级。
2. 新步骤只调用 `createObjectStore` / `createIndex`；不得 `deleteObjectStore`、不得 `clear`、不得删除已有索引。
3. 补迁移测试：用旧版本打开、写入数据、关闭，再用新版本打开，确认数据仍在；缺失迁移步骤时 `open` 必须 reject。
4. 运行 `pnpm --filter @itools/asset-store test` 与 `pnpm verify`；不要用 `reset()` 作为升级手段。

### 6.3 接入任务运行时

1. 打开数据库：浏览器用 `openAssetDatabase({ factory: indexedDB })`；测试用 `new IDBFactory()`（`fake-indexeddb`）。注意 `apps/web` 当前依赖白名单不含 `@itools/asset-store`，接线前必须先扩展 `scripts/check-boundaries.mjs` 与 `scripts/check-import-boundaries.mjs`。
2. 创建 `const store = createAssetStore({ database })`；在应用卸载时调用 `store.dispose()`，释放对象 URL 并关闭数据库。
3. 创建提交通道：`const commitResult = createAssetResultCommitter({ service: store.service, resolveArtifacts: (output) => [...] })`；`resolveArtifacts` 返回 `{ name, mimeType, blob }[]`。
4. 把 `commitResult` 传给 `createTaskRuntime({ runner, commitResult })`；任一资产写入失败会抛出，运行时据此把任务标为 `failed` + `result-commit-failed`。
5. 运行时不会自动持久化 `TaskRecord`：在事件回调中把 `TaskSnapshot` 映射为 `TaskRecord`（`error?.code` → `errorCode`）并 `service.writeTaskRecord`；清理时把非终态任务 ID 作为 `activeTaskIds`。

### 6.4 接入页面导入、导出与清理

1. 导入文件：`File` → `arrayBuffer()` → `new Blob([bytes], { type: file.type })` → `service.createSource({ name, mimeType, blob })`；捕获 `AssetValidationError` 并展示 `issues`。
2. 导出：`archive.exportToJson({ includeSourceData: true })` 得到字符串，再用 Blob 下载；注意该开关控制**所有资产条目**是否带 `dataBase64`，不是只控制 `source`。
3. 恢复：`archive.importFromJson(json, { replaceExisting: false })` 为合并；`true` 会清空现有数据，必须在 UI 二次确认后调用；捕获 `ArchiveValidationError.issues`。
4. 清理：`service.cleanup({ now, retentionMs: DEFAULT_SOURCE_RETENTION_MS, activeTaskIds })`；展示 `removedAssetIds` 与 `skipped` 原因，删除前必须用户确认。

## 7. 已知限制与相关决策

- **未接线**：没有页面、没有任务运行时接线、没有自动清理任务；`createAssetStore` 只在测试中创建。所有“用户文件已本地保存”的说法在接线前都不成立。
- IndexedDB 只在 `fake-indexeddb` 下验证；Safari 的事务活跃窗口、多标签页 `blocked`（当前立即失败而非排队）、真实配额数值均未验证。
- 归档是单个 JSON + 内联 base64，体积约增 33%；未分片、未流式导出。大文件归档可能一次性占用大量内存。
- 导入**不是单事务**：`replaceExisting` 采用“全量内存快照 → `clearAll` → 逐条写入 → 失败恢复”；恢复是尽力而为，单条恢复失败会被吞掉以保留原始错误。`replaceExisting: false` 失败时删除本次新增资产，但任务记录恢复依赖快照。
- `createAssetResultCommitter` 顺序写入多个结果；中途失败时，之前已写入的资产不会回滚，也不会出现在返回的 ID 列表中，需由保留策略或调用方处理残留。
- `reset()` 内部没有二次确认，只执行 `repository.clearAll()`；确认责任在调用方。D01 要求保留是默认、清库是例外。
- `meta` 仓库已创建但当前无公开 API 读写；不要在其中存放与任务/资产重复的事实来源。
- 相关决策：D01（版本化增量迁移、永不自动清库、`reset()` 显式调用）、D26（阶段 6 只交付 asset-store 本体，不接页面与任务运行时，结果提交用结构兼容）、D16（任务与资产端口仍只有单一实现，暂不冻结）、D36（PWA 更新清空版本化 Cache Storage；IndexedDB 用户数据按 docs/15 的边界不得用缓存清理逻辑处理）。
