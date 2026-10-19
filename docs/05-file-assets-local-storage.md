# 05 · 文件资产与浏览器本地存储

> 状态：**已实现（阶段 6）**。代码入口：`packages/asset-store`。
> 阶段 6 交付存储能力本身：**不接收文件、没有任务 UI**；工具页仍是预览只读。首个真实工具接入时再接线。

## 1. 包与分层

`@itools/asset-store` 只依赖 `@itools/contracts`，不依赖 React / 服务端框架。

| 目录 | 职责 |
| --- | --- |
| `src/domain/` | 纯规则：草稿校验、引用完整性、保留策略、归档编解码 |
| `src/application/` | 端口定义（`ports.ts`，冻结）、资产服务、对象 URL 注册表、结果提交通道、归档服务 |
| `src/infrastructure/indexeddb/` | 数据库打开与版本迁移、资产仓储实现、浏览器配额适配 |
| `src/test-support/` | 内存仓储、伪对象 URL、伪配额（`tsconfig.build.json` 排除） |

组装入口 `createAssetStore({ database, objectUrls?, quota?, now?, createAssetId? })` 返回 `{ service, archive, repository, dispose }`。

## 2. 资产模型

三类角色（`contracts/asset.ts`）：`source`（源文件）、`intermediate`（中间文件）、`result`（结果）。

`AssetRecord`：`assetId`、`role`、`name`、`mimeType`、`sizeBytes`、`createdAt`、可选 `taskId`。规则：

- `sizeBytes` 一律取 `blob.size`，不信任调用方传值。
- 文件名、MIME、大小在写入前经 `validateAssetDraft` 校验；非法输入**拒绝写入**，不做静默修剪。
- 引用关系 `AssetReference { assetId, role, taskId }` 与资产在同一事务写入，杜绝“有资产没引用”的中间态。
- 结果资产必须带非空 `taskId`（`result-requires-task`）。

## 3. 存储与原子性

IndexedDB 数据库 `itools-assets`（当前版本 1），对象仓库：`assets`、`blobs`、`references`、`tasks`、`meta`。

- `writeAsset` 在**单个 readwrite 事务**内写元数据 + 内容 + 引用；任一失败即 `abort`，不留部分记录。
- `readAsset` 元数据与内容不一致时返回 `undefined`，且**不静默删除**。
- `deleteAssets` 在单事务内删除资产、内容与全部相关引用。
- `clearAll` 只由显式重置流程调用。

### D01 的处理（已决，2026-10-19）

原冲突：结构变化时“清库”与“任务/结果长期保留 + 完整导出导入”互斥。当前实现：

1. **升级走版本化增量迁移**（`MIGRATIONS` 逐版本执行，只允许 `createObjectStore` / `createIndex`，禁止 `deleteObjectStore` 与 `clear`）。
2. **永不自动清库**；迁移步骤缺失直接 `abort` 并 reject，宁可启动失败也不静默丢数据。
3. 确需重置时由用户显式触发 `service.reset()`，且可先导出归档。
4. 迁移失败不得部分生效：IndexedDB 自身回滚结构变更，有测试验证失败后仍能以原版本正常打开。

结论：**保留数据是默认行为，清库是需要用户确认的例外**。

## 4. 对象 URL 生命周期

- `createObjectUrlRegistry(factory)` 按 Blob 实例引用计数；同一 Blob 共享一个 URL，计数归零才 `revoke`。
- 句柄重复 `release()` 幂等；`releaseAll()` 后旧句柄失效，不会误撤销新 URL。
- 工厂可注入，测试不依赖真实 `URL.createObjectURL`。

## 5. 保留与清理

- 源文件默认保留 7 天（`DEFAULT_SOURCE_RETENTION_MS`），用户可传自定义 `retentionMs`。
- 只有 `source` 可被清理；`result` / `intermediate` 长期保留。
- 跳过规则优先级：`not-source` > `referenced` > `active-task`；被引用或属于活动任务的源文件绝不删除。
- `createdAt` 无法解析时保守保留，**不误删**。
- `cleanup()` 返回 `{ removedAssetIds, skipped, plan }`，可核对每个资产的处置理由。

## 6. 配额与持久化

- `estimate()` 返回 `{ usageBytes, quotaBytes? }`；浏览器未提供配额时**不产生 `quotaBytes` 键**。
- `requestPersistence()` 被拒绝或不可用时返回 `false`，不抛错；调用方继续可用并提示回收风险。
- `navigator.storage` 缺失时降级为 `{ usageBytes: 0 }`。

## 7. 归档导出与导入

- 格式：`AssetArchive { formatVersion, createdAt, assets[], tasks[] }`，资产条目可带 `dataBase64`。
- `includeSourceData: false` 时只导出元数据（不写 `dataBase64` 键）。
- base64 由内置编码表实现，不依赖 `btoa` / `Buffer`，浏览器与 Node 行为一致。
- 导入顺序：解析 → Schema 校验 → 版本校验 → 重复 ID → 引用完整性，**全部通过后才写入**。
- 缺少内容的条目整条跳过并记入 `metadataOnlyAssetIds`，指向它的引用一并丢弃。
- `replaceExisting: true` 先做内存快照再清空，失败按快照恢复；`false` 失败时只回滚本次新增。
- 归档只落本地，不上传。

## 8. 与任务运行时的关系

`createAssetResultCommitter` 把运行时输出转成结果资产，返回 `(taskId, output) => Promise<assetIds>`，结构上兼容 `@itools/task-runtime` 的 `commitResult`，但**不导入该包**，避免应用层之间反向依赖。任一写入失败直接抛出，由运行时把任务标记为 `failed`。

## 9. 隐私边界（自动化）

`scripts/check-no-network.mjs` 扫描 `asset-store` 与 `task-runtime` 的生产源码，禁止 `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `sendBeacon`，已纳入 `pnpm lint` 与 `pnpm verify`。

## 10. 验收与已知限制

- 131 项资产测试：领域 33、应用 35、IndexedDB 24、归档 33、组装 6。
- 契约测试 +1（资产记录 / 归档外壳 Schema）。
- 全仓 `pnpm verify` 通过：339 项测试、28 项 HTTP 验收、`check:privacy` 通过。
- IndexedDB 测试运行在 `fake-indexeddb`（Node），**未在真实浏览器验证** Safari 的事务活跃窗口、多标签页 `blocked` 行为与配额真实数值。
- `blocked` 采用立即失败而非排队等待，多标签页场景需提示用户关闭旧页面。
- 归档为单 JSON 文件，base64 使体积约增 33%；未做分片或流式导出。
