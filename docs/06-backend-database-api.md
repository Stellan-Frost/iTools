# 06 · 后端、数据库与 API

> 状态：**已实现（阶段 7，S2 范围 + M1 语义）**。代码入口：`packages/db`、`apps/server/src/api/**`、`apps/web/src/api/**`。
> 已实现：PostgreSQL + Drizzle schema、版本化迁移、Seed、只读 `/api/v1`、健康检查、OpenAPI、前端类型安全客户端。
> 未实现：管理员认证与写接口（阶段 8）、CSP 与限流（阶段 9）、CI（阶段 11）。

## 1. 关键决策

**M1：注册表权威 + 数据库覆盖层。** 工具身份、分类、可用性默认值仍来自 `packages/app-core` 注册表；数据库只保存运营覆盖：

- `display_order`（可空）
- `availability_override`（只允许 `'disabled'`，即**只能下架、不能启用**）
- 每个 locale 的 `name` / `summary` / `description`（可空）

因此「数据库不能启用不存在的实现」天然成立，数据库故障时页面仍可回落到注册表，与 D22（注册表是唯一来源）保持一致。

## 2. 包与分层

`@itools/db` 依赖 `@itools/contracts` 与 `@itools/app-core`（后者只用于读取注册表默认值）。

| 目录 | 职责 |
| --- | --- |
| `src/schema/tables.ts` | Drizzle 表定义（冻结） |
| `migrations/*.sql` | 显式版本化 SQL 迁移 |
| `src/migrate.ts` | 迁移执行器（事务 + checksum） |
| `src/infrastructure/` | pg 连接池、目录仓储、Seed 写入器、健康探测 |
| `src/catalog/` | 注册表与覆盖合并、Seed 逻辑 |
| `src/cli/` | `migrate` / `seed` 命令行入口 |

`apps/server` 只依赖 `@itools/contracts` 与 `@itools/db`，不直接接触 pg。

## 3. 数据模型

| 表 | 内容 |
| --- | --- |
| `tools` | `tool_id` PK、`display_order`、`availability_override`、时间戳 |
| `tool_localizations` | `(tool_id, locale)` 复合 PK；`name/summary/description` 可空；`on delete cascade` |
| `tool_metadata_versions` | 元数据快照（`jsonb`）+ 创建时间/创建者，供阶段 8 预览与回滚 |
| `admin_sessions` | 会话 ID、token 哈希（唯一）、创建/最近使用/过期/撤销时间 |

`_migrations` 由迁移执行器创建，记录文件名、sha256 与执行时间。

## 4. 迁移与 Seed

```sh
DATABASE_URL=postgresql://... node packages/db/dist/cli/migrate.js
DATABASE_URL=postgresql://... node packages/db/dist/cli/seed.js
```

- 迁移：按文件名升序，**每个文件一个事务**；已执行文件跳过；内容被改写（checksum 不符）直接拒绝。
- 只允许 `CREATE`，迁移文件不得包含 `DROP TABLE` / `TRUNCATE` / `DELETE`。
- Seed：把注册表全部条目（含 preview / disabled）以「不存在则插入」方式写入，**绝不覆盖**已有的 order 与文案，因此可重复执行。
- 服务启动**不自动迁移**：迁移是显式动作，失败不影响现有数据。

## 5. API（`/api/v1`）

| 方法 | 路径 | 成功 | 失败 |
| --- | --- | --- | --- |
| GET | `/tools` | 200 `{ data: ToolCatalogItem[] }`，`public, max-age=60` | 503 `CATALOG_UNAVAILABLE` |
| GET | `/tools/:toolId` | 200 `{ data }` | 404 `TOOL_NOT_FOUND`、503 |
| GET | `/health/live` | 200 `{ status:'ok', checks:{ database:'skipped' } }` | — |
| GET | `/health/ready` | 200 `checks.database = ok/skipped` | 503 `degraded` + `unavailable` |
| GET | `/openapi.json` | OpenAPI 3.1 文档 | — |

- 错误统一 `{ code, message, requestId }`；`message` 为固定文案，不含堆栈、SQL、连接串或内部路径。
- 目录条目：`{ id, category, availability, name, summary, description, order, source }`；`source` 只在**实际覆盖**时为 `override`（Seed 预填等于默认值，仍记 `registry`）。
- `disabled` 工具不出现在列表，单条查询返回 404。
- 未配置 `DATABASE_URL` 时目录完全来自注册表，`/health/ready` 报 `skipped`；服务照常启动。

## 6. 连接与运行

- 连接池：`max=10`、`connectionTimeoutMillis=5000`、`idleTimeoutMillis=10000`、`statement_timeout=10s`。
- 健康探测有 1 秒硬超时，失败返回 `unavailable`，**从不抛错**，避免拖死请求。
- 优雅关闭：进程退出时先关 Fastify，再关目录运行时（`pool.end()`）。

## 7. 前端客户端

`apps/web/src/api/{client.ts,queries.ts}`：

- `createToolApiClient({ baseUrl, fetchImpl? })`：`listTools` / `getTool` / `healthReady`。
- 错误映射：网络失败 `NETWORK_ERROR`（status 0）、错误信封透传 `code` 与 `requestId`、结构非法 `INVALID_RESPONSE`。
- `healthReady` 的 503 表示 degraded，正常返回而不抛错。
- `toolCatalogQueryOptions` 提供稳定 query key 与 `staleTime = 60_000`（与服务端缓存对齐）。
- 尚未接入任何页面（页面仍走 SSR 渲染的注册表数据）。

## 8. 验收与已知限制

- 44 项数据库测试：迁移 8、连接池 2、探测 4、pg 仓储 9、目录合并 12、Seed 9。
- 服务端 31 项：原有 14 项 + API 13 项 + 端到端 4 项（真实 PostgreSQL：迁移 → Seed → 合并 → HTTP）。
- 前端 9 项客户端测试。
- 全仓 `pnpm verify` 通过：409 项测试、28 项 HTTP 验收。
- 限制：`upsertOverride` 只按 locale upsert，不删除输入中缺失的 locale 行；多进程并发迁移无 advisory lock；`db:generate` 未生成 drizzle meta，结构权威仍是 `tables.ts`；写入接口、认证、限流属阶段 8/9。
