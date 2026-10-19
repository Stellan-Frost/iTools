# 11 · 部署与运维

> 定位：给出当前唯一可复现的运行方式（本地 dev / 本地 production）、环境变量、便携 PostgreSQL 启停、迁移与 Seed、口令恢复、健康检查与故障排查；同时明确哪些运维能力**根本不存在**。
> 状态：**部分实现**——本地运行与便携 PostgreSQL（阶段 7）已可用；生产部署、Docker Compose、备份、日志落盘、监控、回滚全部**未实现（阶段 12）**。
> 代码入口：`apps/server/src/{index.ts,config.ts,app.ts,catalog-runtime.ts}`、`apps/server/src/api/routes.ts`、`apps/server/src/logging/request-log.ts`、`apps/server/src/cli/reset-password.ts`、`packages/db/src/cli/{migrate,seed}.ts`、`packages/db/src/infrastructure/{pool,probe}.ts`、`.env.example`。

## 1. 当前事实

- 唯一部署形态是**本机运行**：`pnpm dev`（开发）与 `pnpm build` + `NODE_ENV=production node dist/index.js`（生产模式演练）；没有 Docker/Compose、反向代理与 TLS、VPS、域名、CDN/WAF、进程守护，`itools.wataa.men` 只是目标域名，未做 DNS、证书或代理配置。
- 便携 PostgreSQL 17.6：二进制 `C:/itools-pg/bin`，数据目录 `C:/itools-pg/data`，监听 `127.0.0.1:5432`（仅本机），库 `itools`（开发）与 `itools_test`（测试）。本次核对时 5432 处于 LISTENING。
- 服务启动**不执行迁移**；`DATABASE_URL` 缺省时目录回落到代码注册表，服务照常启动，`/health/ready` 报 `skipped`。
- 日志：仅生产模式写 stdout，每请求一行 JSON（`time/requestId/method/path/status/durationMs`），开发模式不写请求日志；无文件、无轮转、无 30 天保留。
- 备份/恢复：无任何自动化；`pg_dump.exe` 存在但未接入脚本。RTO/RPO 24 小时是目标，不是已验证能力。
- 生产部署、生产迁移、破坏性数据操作、公网安全配置变更**必须先获得用户批准**。

### 1.1 环境变量（`apps/server/src/config.ts` 校验）

| 变量 | 默认 | 约束与影响 |
| --- | --- | --- |
| `NODE_ENV` | `development` | 只接受 `development` / `production`；生产启用严格 CSP、静态资源与 stdout 请求日志 |
| `HOST` | `127.0.0.1` | 不得为空；本地保持回环地址 |
| `PORT` | `5173` | 1–65535 整数；仓库 `.env` 当前设为 `3000` |
| `SITE_ORIGIN` | `http://localhost:5173` | 必须是纯 origin（无 path/query/hash/凭据）；决定 canonical、hreflang、Sitemap |
| `WEB_ROOT` | `../web`（相对**启动目录**） | 生产需指向 `apps/web`，内含 `dist/client` 与 `dist/server` |
| `DATABASE_URL` | 未设置 | 必须是 `postgres(ql)://`；缺省时目录仅来自注册表 |
| `TEST_DATABASE_URL` | 未设置 | 仅测试与集成测试使用；库名必须以 `_test` 结尾 |
| `ADMIN_SETUP_TOKEN` | 未设置 | 至少 24 字符，否则**拒绝启动**；未设置时初始化请求返回 404 `not_initialized` |
| `ADMIN_NEW_PASSWORD` | 未设置 | 仅 `reset-password` CLI 读取；缺省则生成随机口令 |

`HOST`/`PORT` 校验失败、`SITE_ORIGIN` 带路径、`ADMIN_SETUP_TOKEN` 过短都会让进程以非零码退出，错误信息不回显变量值。`.env` 已被 `.gitignore` 忽略（`git ls-files .env` 为空），只提交 `.env.example`。

### 1.2 健康检查与日志

| 端点 | 200 | 503 |
| --- | --- | --- |
| `GET /api/v1/health/live` | `{"status":"ok","checks":{"database":"skipped"}}`，固定 | — |
| `GET /api/v1/health/ready` | `database: ok` 或 `skipped` | `{"status":"degraded","checks":{"database":"unavailable"}}` |

探测实现为 `select 1` + 1000 ms 硬超时，永不抛错（`packages/db/src/infrastructure/probe.ts`）。请求日志只记录路径（丢弃查询串），不读 Cookie/Authorization/body；`SIGINT`/`SIGTERM` 会依次关闭 Fastify、Vite renderer 与连接池。

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `apps/server/src/index.ts` | 进程入口：装配 runtime、监听、优雅关闭、启动失败退出码 1 |
| `apps/server/src/config.ts` | 环境变量读取与校验（含全部默认值） |
| `apps/server/src/app.ts` | Fastify 路由、SSR 注入、静态资源、缓存头、安全头、404 |
| `apps/server/src/catalog-runtime.ts` | 有 `DATABASE_URL` 建池并接管理端；无则 `createRegistryOnlyCatalog` |
| `apps/server/src/api/routes.ts` | `/api/v1/tools`、健康检查、限流与 503 错误信封 |
| `apps/server/src/logging/request-log.ts` | 单行 JSON 请求日志与脱敏 |
| `apps/server/src/cli/reset-password.ts` / `reset-password-core.ts` | 服务器侧口令恢复（无 HTTP 接口） |
| `packages/db/src/cli/migrate.ts` / `seed.ts` | 迁移 / Seed CLI，缺 `DATABASE_URL` 时非零退出 |
| `packages/db/src/migrate.ts` | 按文件名升序、单文件单事务、sha256 checksum |
| `packages/db/src/infrastructure/pool.ts` / `probe.ts` | 连接池与健康探测 |
| `apps/server/src/renderer/{dev,prod}.ts` | Vite middleware / 读取 `dist/server/entry-server.js` |
| `.env.example` | 环境变量模板（不含真实口令） |
| `scripts/verify-stage-4.mjs` | 以生产模式在 5198 端口起服务跑 HTTP 验收 |

## 3. 必须遵守的规则

1. 生产配置只经环境变量或只读秘密文件注入；不得写入镜像、代码、日志或 Git。检查：`git ls-files | grep -c '^\.env$'` 必须为 0。
2. 启动前必须提供合法 `SITE_ORIGIN`；部署到 HTTPS 时必须同步改为 `https://` 正式 origin，否则 canonical/Sitemap 全错且 HSTS 不下发。
3. `ADMIN_SETUP_TOKEN` 只在首次初始化时使用，至少 24 字符；初始化成功后必须从环境移除并重启。
4. 迁移与 Seed 必须显式执行，顺序固定：migrate → seed；服务启动不自动迁移。
5. 迁移失败立即停止发布并保留现场；禁止自动反向迁移（`migrate.ts` 也会拒绝改写已执行文件的 checksum）。
6. `TEST_DATABASE_URL` 必须指向库名以 `_test` 结尾的独立库，且不得与 `DATABASE_URL` 相同；测试会重建 schema。
7. 数据库端口只监听 `127.0.0.1`；不得把 5432 暴露到公网或容器外网。
8. 生产日志只允许 stdout 单行 JSON；新增字段不得包含查询串、Cookie、Authorization、请求体或用户内容。
9. 口令恢复只能通过服务器侧 CLI 执行；不得新增公网重置接口，不得把新口令写入日志。
10. 任何生产部署、迁移、恢复演练、公网配置变更前必须提交计划并获得用户批准（见 [13](13-acceptance-open-decisions.md)）。
11. 文档不得声称已具备未实现的能力（备份、监控、回滚、CDN、域名）。

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| 把 `pnpm dev` 当作生产部署 | `pnpm build` 后用 `NODE_ENV=production node dist/index.js`，并显式注入环境变量 |
| 在仓库根直接 `node apps/server/dist/index.js` | `cd apps/server` 再启动，否则 `WEB_ROOT=../web` 解析错误 |
| 提交 `.env` 或在文档里写真实数据库口令 | 只提交 `.env.example`，口令留在本机 `.env` |
| 启动时自动跑迁移“图省事” | 先 `migrate` 再 `seed`，失败即停止发布 |
| 让 `TEST_DATABASE_URL` 指向 `itools` 开发库 | 指向 `itools_test`；测试会 drop schema |
| 用 `pg_ctl stop -m immediate` 强制杀库 | 默认 `-m fast`，等连接结束后再停 |
| 在日志里打印 `request.headers.cookie` 或完整 URL | 只记录 `path`（无查询串）与状态码 |
| 声称“已有每日备份 / 监控 / 自动回滚” | 明确写“未实现”，RTO/RPO 仅为目标 |
| 默认 `SITE_ORIGIN` 就上线 | 按真实域名设置 origin，并检查 Sitemap 绝对地址 |

## 5. 如何验证

```sh
# 便携 PostgreSQL 状态
C:/itools-pg/bin/pg_isready -h 127.0.0.1 -p 5432      # 期望：accepting connections

# 开发模式
pnpm dev
# 期望日志：@itools/server listening on http://127.0.0.1:3000 (development)
curl -s http://127.0.0.1:3000/api/v1/health/live      # {"status":"ok","checks":{"database":"skipped"}}
curl -s http://127.0.0.1:3000/api/v1/health/ready     # 有 DATABASE_URL 时 database:"ok"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/zh-CN   # 200
# 迁移与 Seed（幂等）
node --env-file=.env packages/db/dist/cli/migrate.js  # 迁移完成：应用 0 个，跳过 2 个。
node --env-file=.env packages/db/dist/cli/seed.js     # 以 "Seed 完成：" 开头，退出码 0

# 本地生产模式演练
pnpm build
cd apps/server && NODE_ENV=production HOST=127.0.0.1 PORT=3100 \
  SITE_ORIGIN=http://127.0.0.1:3100 WEB_ROOT=../web \
  DATABASE_URL="$(grep '^DATABASE_URL=' ../../.env | cut -d= -f2-)" node dist/index.js
# 期望：listening on http://127.0.0.1:3100 (production)；请求日志为单行 JSON
# 口令恢复（服务器侧）
cd apps/server && node --env-file=../../.env dist/cli/reset-password.js
# 期望：管理员口令已重置（...），已撤销 N 个会话。若未设 ADMIN_NEW_PASSWORD，新口令仅打印一次
```

## 6. 常见任务（step-by-step）

### 6.1 启动 / 停止便携 PostgreSQL

```sh
# 前台启动（Ctrl+C 停止）
C:/itools-pg/bin/postgres.exe -D "C:/itools-pg/data" -p 5432 -c listen_addresses=127.0.0.1
# 后台启动并写日志
C:/itools-pg/bin/pg_ctl.exe -D "C:/itools-pg/data" -l "C:/itools-pg/pg.log" \
  -o "-p 5432 -c listen_addresses=127.0.0.1" start
# 停止（fast：等待连接正常结束）
C:/itools-pg/bin/pg_ctl.exe -D "C:/itools-pg/data" stop -m fast
```

首次初始化（**已执行过，勿重复**）记录：`initdb -D "C:/itools-pg/data" -U itools --auth=scram-sha-256 --pwfile=<临时文件> -E UTF8 --locale=C`，随后 `createdb -h 127.0.0.1 -U itools itools` 与 `createdb -h 127.0.0.1 -U itools itools_test`。删除 `C:/itools-pg` 即可完全清理，不注册系统服务、不需要管理员权限。

### 6.2 迁移与 Seed

1. `pnpm --filter @itools/db build`（必须有 `dist/cli/*.js`）。
2. `node --env-file=.env packages/db/dist/cli/migrate.js`；期望“应用 0 个，跳过 2 个”（首次为应用 2 个）。
3. `node --env-file=.env packages/db/dist/cli/seed.js`；期望退出码 0，已存在条目数等于注册表 7 条。
4. 校验：`psql -h 127.0.0.1 -U itools -d itools -c "select name from _migrations order by name"` 应列出 `0001_initial.sql`、`0002_admin_credentials.sql`。

### 6.3 生产模式本地演练

1. `pnpm build`，确认 `apps/web/dist/{client,server}` 与 `apps/server/dist/index.js` 存在。
2. 从 `apps/server` 启动，显式传 `NODE_ENV=production`、`SITE_ORIGIN`、`WEB_ROOT=../web`、`DATABASE_URL`。
3. 抽查：`/zh-CN` 200、`/zh-CN/text/csv-inspector` 404、`/sitemap.xml` 含绝对 origin、响应含 CSP 与 HSTS（仅 https origin 才有 HSTS）。
4. 生产脚本**不会**自动读取 `.env`（`start` 脚本是 `node dist/index.js`）；要么显式导出变量，要么加 `--env-file`。

### 6.4 管理员口令恢复

1. 在服务器侧执行 `cd apps/server && node --env-file=../../.env dist/cli/reset-password.js`。
2. 未提供 `ADMIN_NEW_PASSWORD` 时会生成 24 字节随机口令并只打印一次；记下后立即保存。
3. 执行后全部旧会话被撤销；管理员需用新口令重新登录。未初始化时命令报“管理员尚未初始化”。

### 6.5 故障排查

| 症状 | 排查 | 处理 |
| --- | --- | --- |
| 启动报 `EADDRINUSE` | `netstat -ano \| grep :3000` | 换 `PORT` 或结束占用进程（先确认归属） |
| 启动报 `@itools/server failed to start` | 看 stderr 的首条约束（多为 `SITE_ORIGIN` 或 `ADMIN_SETUP_TOKEN`） | 按 §1.1 修正后重启 |
| `ready` 返回 503 `unavailable` | `pg_isready`；检查 `DATABASE_URL` | 启动 PG、修正连接串、确认库已建 |
| `ready` 返回 `skipped` | 未设置 `DATABASE_URL` | 需要数据库能力时补变量并重启 |
| `/api/v1/tools` 503 `CATALOG_UNAVAILABLE` | 迁移未执行或表缺失 | 跑 §6.2 的 migrate/seed |
| 管理端初始化返回 404 `not_initialized` | `ADMIN_SETUP_TOKEN` 未设置或为空 | 设置 ≥24 字符令牌并重启 |
| 页面或静态资源 404 | `WEB_ROOT` 指错、`dist/client/assets` 不存在、工具为 `disabled` | 从 `apps/server` 启动；`pnpm build`；核对注册表 |

## 7. 已知限制与相关决策

- 除本地便携 PostgreSQL 外，**没有任何已部署环境**；VPS、域名、TLS、反向代理、CDN/WAF、Docker Compose 全部未落地（阶段 12）。
- 备份/恢复未实现：无自动备份、无保留策略、无恢复演练；RTO/RPO 24 小时只是目标，不得宣称已具备。
- 日志无落盘、无轮转、无 30 天保留，进程退出即丢日志；无监控、无告警、无健康检查自动回滚，`health/ready` 只是可被外部轮询的端点。
- 本地 `.env` 将 `PORT` 设为 3000 但未设 `SITE_ORIGIN`，canonical 仍是默认 `http://localhost:5173`；本地验收脚本自行覆盖 origin，不影响 28 项结果，但手工核对 head 时需注意。
- 公开 API 限流为进程内固定窗口（D35），多实例部署时各自计数；集中限流属阶段 12。
- 目录覆盖模型为 M1/D27：数据库只能覆盖排序与文案、只能下架，不能启用注册表中不存在的工具。
- 相关决策：D31（初始化令牌）、D27（目录合并）、D35（进程内限流）、D03（CDN 未实测）。全文见 [13](13-acceptance-open-decisions.md)。
