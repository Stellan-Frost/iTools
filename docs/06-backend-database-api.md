# 06 · 后端、数据库与 API

> 定位：定义 `packages/db` 与 `apps/server` 的职责、数据模型、迁移纪律和 `/api/v1` 契约，让新 Agent 能安全加表、加接口而不破坏「注册表权威」。
> 状态：已实现（阶段 7 只读 API；阶段 8 管理写接口的存储层）。阶段 10 PWA、11 CI、12 部署、13 验收未开始。
> 代码入口：`packages/db/src/index.ts`、`packages/db/src/migrate.ts`、`packages/db/src/catalog/tool-catalog-service.ts`、`apps/server/src/api/routes.ts`、`apps/server/src/catalog-runtime.ts`、`apps/server/src/app.ts`。

## 1. 当前事实

| 项 | 事实 |
| --- | --- |
| 数据库 | 本机便携 PostgreSQL 17.6，`C:/itools-pg`，仅监听 `127.0.0.1:5432` |
| 库 | `itools`（开发）、`itools_test`（测试；库名必须以 `_test` 结尾，否则测试支持层拒绝运行） |
| 迁移 | `0001_initial.sql`、`0002_admin_credentials.sql` 已在真实库执行；服务启动不自动迁移 |
| 表 | 4 张目录/会话表 + 1 张管理员凭据表 + 执行器自建 `_migrations` |
| 测试 | db 65 项、server 159 项；全仓 584 项、HTTP 验收 28/28 |

| 表 | 关键列 | 语义 |
| --- | --- | --- |
| `tools` | `tool_id` PK、`display_order`、`availability_override`、时间戳 | 只存运营覆盖；没有 category、没有 enabled |
| `tool_localizations` | `(tool_id, locale)` PK；`name/summary/description` 可空 | 缺失或 NULL = 回落注册表；`on delete cascade` |
| `tool_metadata_versions` | `version_id` bigserial、`tool_id`、`locale`、`snapshot` jsonb、`created_at`、`created_by` | 管理端快照；`created_by` 当前恒为 NULL |
| `admin_sessions` | `session_id` PK、`token_hash` 唯一、`created_at/last_seen_at/expires_at/revoked_at` | 只存 token 的 sha256 |
| `admin_credentials` | `id` 固定 1、`password_hash` | `check (id = 1)` 保证唯一管理员（D05） |
| `_migrations` | `name` PK、`checksum`、`applied_at` | `migrate.ts` 用 `create table if not exists` 建立 |

公开 API（`apps/server/src/api/routes.ts`）：

| 方法 | 路径 | 成功 | 缓存 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/tools` | 200 `{data: ToolCatalogItem[]}` | `public, max-age=60` | 503 `CATALOG_UNAVAILABLE`、429 |
| GET | `/api/v1/tools/:toolId` | 200 `{data}` | `no-store` | 404 `TOOL_NOT_FOUND`、503、429 |
| GET | `/api/v1/health/live` | 200 `{status:'ok',checks:{database:'skipped'}}` | `no-store` | 429 |
| GET | `/api/v1/health/ready` | 200 `{status:'ok'}` | `no-store` | 503 `{status:'degraded'}`、429 |
| GET | `/api/v1/openapi.json` | 200 OpenAPI 3.1.0 | `no-store` | — |

- 成功信封 `{data, meta?}`；错误信封 `{code,message,requestId}`，`message` 是固定英文文案，不含 SQL、堆栈、连接串或内部路径。`ApiErrorSchema` 另允许可选 `details`，当前路由不产出。
- `checks.database` 三态：`ok` / `unavailable` / `skipped`。`live` 永不触碰数据库；`ready` 在没有探测函数时为 `skipped`；探测抛错按 `unavailable` 处理且不回显错误。
- 公开 API 每 IP 120 次/分钟（进程内固定窗口，D35），第 121 次返回 429 + `retry-after` + `no-store`。
- 未注入目录（无 `DATABASE_URL`）：目录完全来自注册表，`ready` 为 `skipped`，`/api/v1/admin/**` 整体 404。
- **运行期数据库故障不回落到注册表**：`listItems()` 抛错 → `/tools` 503，`ready` 503 `degraded`；回落只由「环境变量缺失」触发（`catalog-runtime.ts:37`）。
- 迁移执行器按文件名升序、每个文件一个事务；失败只带 PG 错误码，不带 SQL 片段；`_migrations` 在事务外先建。
- 优雅关闭：`SIGINT`/`SIGTERM` → `app.close()` → 关闭渲染器 → `pool.end()`，重复信号被 `shuttingDown` 挡住（`index.ts:94-112`）。

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `packages/db/src/schema/tables.ts` | Drizzle 表定义（冻结文件，字段改动需根 Agent 确认） |
| `packages/db/migrations/*.sql` | 手写版本化 SQL，一个文件一个事务，只允许 `CREATE` |
| `packages/db/src/migrate.ts` | 排序、sha256 checksum、逐文件事务、`_migrations` 登记 |
| `packages/db/src/catalog/tool-catalog-service.ts` | 注册表 × 覆盖逐字段合并、排序、过滤 disabled、降级目录 |
| `packages/db/src/catalog/seed-catalog.ts` | 只补缺失行的 Seed 投影（含 preview / disabled） |
| `packages/db/src/catalog/registry-info.ts` | `findRegistryItem` / `listRegistryToolIds` 只读视图，供写接口判存在 |
| `packages/db/src/infrastructure/pool.ts` | 连接池与超时参数唯一入口 |
| `packages/db/src/infrastructure/pg-catalog-repository.ts` | `CatalogRepository` 的 pg 实现：一次 join 读、单事务 upsert |
| `packages/db/src/infrastructure/pg-seed-writer.ts` | `on conflict do nothing`，绝不覆盖已有行 |
| `packages/db/src/infrastructure/pg-admin-*.ts` | 凭据 / 会话 / 版本仓储 |
| `packages/db/src/infrastructure/probe.ts` | `select 1` + 1 秒硬超时，永不抛错 |
| `packages/db/src/cli/{migrate,seed}.ts` | 显式运维入口，缺 `DATABASE_URL` 以非零码退出 |
| `apps/server/src/api/{routes,schemas,openapi,options}.ts` | 路由、响应 schema、OpenAPI、可选依赖 |
| `apps/server/src/catalog-runtime.ts` | 按 `DATABASE_URL` 装配 pg 仓储 + 管理依赖 + `pool.end` |
| `apps/server/src/config.ts` | 环境变量校验（连接串前缀、`ADMIN_SETUP_TOKEN` ≥24 字符） |
| `apps/server/src/app.ts` | 安全头/日志钩子、API 与 admin 注册顺序、SSR 404 兜底 |
| `apps/server/src/index.ts` | 启动与优雅关闭 |
| `apps/web/src/api/{client,queries}.ts` | 类型安全公开 API 客户端（页面仍走 SSR 数据，尚未接入） |

## 3. 必须遵守的规则

| 规则 | 可检查点 |
| --- | --- |
| 注册表是身份、分类、可用性的唯一来源 | `tables.ts` 无 `category`/`enabled`；`tool-catalog-service.ts:97` 的 category 只取 `entry.metadata.category` |
| 数据库只存覆盖，`availability_override` 只能是 `'disabled'` | `contracts/src/catalog.ts:84` 类型；`AdminAvailabilityPatchSchema` 只接受 `'disabled'`/`'registry'` |
| 覆盖逐字段、逐语言合并 | `pickOverride` / `mergeText`（`tool-catalog-service.ts:38-70`）；空串与 undefined 视为未覆盖 |
| `source` 只在「与注册表不同」时为 `override` | `orderOverridden` / `textOverridden`（`:87-106`）；Seed 写入默认值仍记 `registry` |
| 列表只查一次覆盖，禁止 N+1 | `listItems` 只调用一次 `repository.listOverrides()`（`:157`） |
| 迁移文件只允许 `CREATE` | 文件内只能有 `CREATE` / `ALTER TABLE ... ADD CONSTRAINT`，不得出现 `DROP`、`TRUNCATE`、`DELETE FROM`；§5 的 grep 必须无输出 |
| 已执行迁移不得改写 | `migrate.ts:122-127` checksum 不符直接抛错；0001/0002 不得改字段 |
| 迁移单文件单事务 | `applyMigration` 的 `begin/commit/rollback`（`migrate.ts:85-104`） |
| 启动不自动迁移 | `apps/server/src/index.ts` 无 `migrate(` 调用；只经 `packages/db/dist/cli/migrate.js` |
| 连接池参数不得旁路 | 只经 `createPool`（`pool.ts:18-32`）：max 10、connect 5s、idle 10s、statement_timeout 10s |
| 错误响应固定文案 | `routes.ts:14-19` 常量；不得回显 `error.message` 或 SQL |
| 依赖方向 | `pnpm check:imports`：`@itools/server` 白名单只有 `contracts` + `db`（D28） |
| 测试库安全闸门 | `assertTestDatabase`（`test-support/test-database.ts:44`）要求 `_test` 后缀 |

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| 给 `tools` 加 `category` 或 `enabled` 列 | 分类与可用性留在注册表；DB 只加展示覆盖（D27） |
| 迁移里写 `DROP TABLE` / `TRUNCATE` / 批量 `DELETE` | 新增 `0003_*.sql` 只 `CREATE`；数据修复走独立审批 |
| 修改已执行的 0001/0002 补字段 | 新建迁移文件；旧文件改动会被 checksum 拒绝 |
| 在 `/tools` 循环里对每个工具 `getOverride` | 一次 `listOverrides()` 后在内存分组（禁止 N+1） |
| `apps/server` 直接 `import { Pool } from 'pg'` 或 `@itools/app-core` | 经 `@itools/db` 暴露的工厂；app-core 只允许 db 依赖 |
| 未注入目录时返回 200 空数组 | 返回 503 `CATALOG_UNAVAILABLE`，让调用方区分「空」与「不可用」 |
| 把 SQL 错误或连接串拼进 `message` | 固定文案 + `requestId`，细节只留服务端 |
| 启动时顺手执行迁移「图省事」 | 迁移是显式运维动作，失败不影响已启动进程 |

## 5. 如何验证

```sh
# 1) 数据库与仓储（test:db 会加载 .env，库名必须以 _test 结尾）
pnpm test:db
# 期望：65 passed（迁移 8、基础设施 36、目录 21）

# 2) 全仓（含 server 159：API 13、健康/缓存头、真实库集成 4 等）
pnpm test
# 期望：584 passed

# 3) 依赖方向
pnpm check:imports
# 期望：源码依赖边界检查通过：8 个包

# 4) 迁移文件不得含破坏性语句（0001 的 on delete cascade 不会命中）
grep -Ein 'drop|truncate|delete[[:space:]]+from' packages/db/migrations/*.sql
# 期望：无输出

# 5) 迁移与 Seed（先 build；已执行过时迁移应全部跳过）
pnpm --filter @itools/db build
node --env-file=.env packages/db/dist/cli/migrate.js
# 期望：迁移完成：应用 0 个，跳过 2 个。
node --env-file=.env packages/db/dist/cli/seed.js
# 期望：Seed 完成：新建工具 0 个，新增文案 0 条，已存在 7 个。
```

`7` = 注册表 7 条（preview 6、implemented 0、disabled 1）。测试库名闸门可反向验证：把 `TEST_DATABASE_URL` 指向 `itools` 时测试直接报「拒绝在数据库 itools 上执行测试重置」。

```sh
# 5) 真实 HTTP（端口取 .env 的 PORT，当前 3000）
curl -s http://127.0.0.1:3000/api/v1/health/ready
# 有库：{"status":"ok","checks":{"database":"ok"}}
# 无 DATABASE_URL：{"status":"ok","checks":{"database":"skipped"}}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/v1/tools/not-a-tool
# 404
curl -sD - -o /dev/null http://127.0.0.1:3000/api/v1/tools | grep -i '^cache-control'
# cache-control: public, max-age=60
```

## 6. 常见任务（step-by-step）

### 6.1 新增一张表与迁移

1. 在 `packages/db/src/schema/tables.ts` 加 `pgTable`（冻结文件，先与根 Agent 确认字段；仍不得加 category/enabled）。
2. 新建 `packages/db/migrations/0003_<snake_case>.sql`。只写 `CREATE TABLE/INDEX` 与 `ALTER TABLE ... ADD CONSTRAINT`；执行器按文件名字符串升序执行，前缀决定顺序。
3. 读模型需要新仓储时，在 `packages/db/src/infrastructure/` 实现，并在 `packages/db/src/index.ts` 导出工厂与类型；端口放 `packages/contracts/src/`。
4. 测试用 `withTestDatabase()` 或 `withIsolatedSchema()`（`packages/db/src/test-support/test-database.ts`），断言结构、约束与幂等：连跑两次，第二次 `applied` 为空。
5. 执行 `pnpm --filter @itools/db build && node --env-file=.env packages/db/dist/cli/migrate.js`，再跑一次确认「应用 0 个，跳过 3 个」。
6. 交付说明写清：是否破坏兼容、是否需要数据回填、回填为何不能放进迁移（迁移只允许 CREATE）。

### 6.2 新增一条公开只读 API

1. 契约：在 `packages/contracts/src/` 加 TypeBox schema 与类型，响应对象必须 `additionalProperties: false`。
2. 路由：在 `apps/server/src/api/routes.ts` 的 `registerApi` 内注册，并声明 `schema.response`，否则 OpenAPI 不完整。
3. 复用 `preHandler: async (request, reply) => { isRateLimited(request, reply); }`；成功路径显式设 `cache-control`（列表 60 秒，单条与错误 `no-store`）。
4. 失败只用固定 code/message：`503 CATALOG_UNAVAILABLE`、`404 TOOL_NOT_FOUND`；不要新造会泄露内部状态的码。
5. 在 `apps/server/src/api/api.test.ts` 补 200/404/503/429 与缓存头断言；`/api/v1/openapi.json` 会自动收录带 schema 的新路径。

### 6.3 新增一条管理写 API

1. 契约：`packages/contracts/src/admin.ts` 加请求 schema 与错误码（冻结文件，改动需根 Agent 确认）。
2. 路由：`apps/server/src/admin/writes/routes.ts` 内注册，必须 `preHandler: deps.guard`，错误统一走 `sendAdminError`，成功响应 `cache-control: no-store`。
3. 顺序固定：`validationError` → `readRegistryItem(toolId)` 判存在 → 读 `catalog.getOverride` → 写 `upsertOverride`（`displayOrder: null` 表示回落注册表）。
4. 测试放 `apps/server/src/admin/writes/routes.test.ts`：401（无会话）、403（缺 CSRF）、404（未知工具）、409（版本冲突）。
5. 权限与版本语义见 [07](07-admin-console.md)。

## 7. 已知限制与相关决策

- M1 注册表权威见 D27；降级只由缺失 `DATABASE_URL` 触发，运行期故障返回 503 而非旧快照。
- 依赖边界见 D28：`apps/server` 不接触 pg，也不直接读注册表。
- 限流见 D35：进程内固定窗口，多实例各自计数。
- `upsertOverride` 只 upsert 传入的 locale 行，不删除缺失行；后台也没有「清除单字段覆盖」入口，覆盖一旦写入只能改值。
- 迁移执行器没有 advisory lock：多进程同时迁移可能重复执行同一文件，后者因 `_migrations` 主键失败并回滚。
- `admin_sessions.deleteExpired` 已实现但未被调用，过期会话只在解析时被拒绝，不会自动清理。
- `db:generate` 没有生成 drizzle meta 目录；结构权威是 `tables.ts` + 手写 SQL，`drizzle.config.ts` 仅用于结构对照。
- 管理端点依赖 `DATABASE_URL`：无库时 `/api/v1/admin/**` 为 404，详见 [07](07-admin-console.md)。
