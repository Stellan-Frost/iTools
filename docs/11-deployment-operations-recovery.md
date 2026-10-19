# 11 · 部署、运维与恢复

> 状态：**生产部署未实现（阶段 12）；本地开发数据库已可用（阶段 7）**。当前只有本地构建与 `node dist/index.js` 运行方式；没有 Docker、Compose、反向代理、备份或回滚。

## 本地开发数据库（已实现）

本机没有 Docker 与 psql，因此使用**便携版 PostgreSQL 17.6**，不注册系统服务、不需要管理员权限，删除 `C:/itools-pg` 即可完全清理。

| 项 | 值 |
| --- | --- |
| 二进制 | `C:/itools-pg/bin` |
| 数据目录 | `C:/itools-pg/data` |
| 监听 | `127.0.0.1:5432`（仅本机） |
| 开发库 / 测试库 | `itools` / `itools_test` |
| 连接串 | 见 `.env`（gitignored），模板见 `.env.example` |

启动与初始化：

```sh
# 启动（前台运行，Ctrl+C 停止）
C:/itools-pg/bin/postgres.exe -D "C:/itools-pg/data" -p 5432 -c listen_addresses=127.0.0.1

# 首次初始化（已执行过，无需重复）
C:/itools-pg/bin/initdb.exe -D "C:/itools-pg/data" -U itools --auth=scram-sha-256 --pwfile=... -E UTF8 --locale=C
C:/itools-pg/bin/createdb.exe -h 127.0.0.1 -U itools itools
C:/itools-pg/bin/createdb.exe -h 127.0.0.1 -U itools itools_test
```

迁移与 Seed（服务启动**不会**自动执行）：

```sh
pnpm --filter @itools/db build
node --env-file=.env packages/db/dist/cli/migrate.js
node --env-file=.env packages/db/dist/cli/seed.js
```

安全约束：测试只连 `TEST_DATABASE_URL`，且库名必须以 `_test` 结尾，否则测试支持层直接拒绝运行；测试会重建该库的 `public` schema。

管理员口令恢复（仅服务器侧，无公网接口）：

```sh
cd apps/server
DATABASE_URL=postgresql://... node dist/cli/reset-password.js
```

未设置 `ADMIN_NEW_PASSWORD` 时生成随机口令并只打印一次；执行后会撤销全部旧会话。

## 生产拓扑
- Linux + Docker Compose。
- 容器：Fastify 应用与 PostgreSQL，使用私有网络、持久化卷和健康检查。
- 反向代理负责 HTTPS；Cloudflare/CDN/WAF 代理公网流量。
- 源站防火墙限制直接访问；验证源站不能绕过代理被访问。
- 保留不可变版本化 Docker 镜像与部署配置；健康检查达到预设失败阈值时自动回滚应用版本。
- 数据库迁移、数据恢复、公网安全配置变更仍需独立审批。

## 环境配置
- 本地 `.env` 不纳入版本控制；提供 `.env.example`。
- 生产通过部署配置注入环境变量或只读秘密文件。
- 密钥不得写入镜像、代码或日志。
- 启动时使用集中 Schema 校验；关键配置缺失/无效时拒绝启动。

## 迁移
- Drizzle Kit 显式迁移，兼容性优先、分阶段执行。
- 破坏性迁移单独审批并验证备份恢复。
- 迁移失败立即停止发布，保留现场；检查迁移状态、一致性与备份。
- 修复、重试或恢复方案须授权；禁止自动执行破坏性反向迁移。
- 应用回滚不等于数据库回滚。

## 备份与恢复
- 每日自动加密备份；保留 7 份每日和 4 份每周备份。
- 备份存放于生产服务器独立磁盘或目录（此方案的同机故障风险必须记录）。
- 用户选择只在实际故障时验证恢复流程；不得声称恢复能力已通过定期演练。
- RTO 目标 24 小时；数据库 RPO 目标 24 小时。
- 发生故障时必须验证备份完整性、密钥可用性、数据库恢复、迁移状态和应用连接。

## 监控与日志
- 自托管监控与健康检查：liveness、readiness、数据库、部署、备份状态、资源指标。
- 结构化应用日志保留 30 天，按日期和容量轮转。
- 日志只记录必要运行状态、路由、状态码、耗时和错误代码；不记录用户内容或凭据。

## 生产变更审批
生产部署、生产数据库迁移、破坏性数据操作和公网安全配置变更必须先提交计划并获得用户批准。
