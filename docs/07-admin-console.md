# 07 · 管理后台

> 定位：给出唯一管理员后台的权限边界、认证/会话/CSRF 规则、元数据与版本语义，以及新增管理能力时的完整改动清单。
> 状态：已实现（阶段 8；安全配套属阶段 9）。浏览器 E2E 未做（阶段 11），无注册、无多管理员。
> 代码入口：`apps/server/src/admin/register.ts`、`apps/server/src/admin/auth/routes.ts`、`apps/server/src/admin/writes/routes.ts`、`packages/contracts/src/admin.ts`、`apps/web/src/pages/admin/AdminPage.tsx`。

## 1. 当前事实

| 项 | 事实 |
| --- | --- |
| 管理员 | 唯一（D05）；`admin_credentials` 单行 `check (id = 1)`；不开放注册 |
| 可编辑 | 双语文案（name/summary/description）、`display_order`、上下架 |
| 不可编辑 | 分类、图标、工具身份（D29）；请求 schema 无这些字段 |
| 初始化 | `ADMIN_SETUP_TOKEN`（≥24 字符）+ 网页初始化页（D31）；令牌只在内存比对，不落库、不写日志 |
| 会话 | 32 字节随机 token，库中只存 sha256；空闲 7 天滑动 + 绝对 30 天；登录轮换旧会话 |
| CSRF | 双提交：`itools_admin_csrf`（可读）+ `x-csrf-token`；非 GET/HEAD 强制 |
| 限流 | 登录固定窗口 5 次/15 分钟，第 6 次 429；成功即清零；不永久锁定 |
| 版本 | 每个 `(tool, locale)` 保留最近 50 版（D30）；排序与启停不入版本（D32） |

| 方法 | 路径 | 成功 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/setup` | 200 `{data:{available}}` | `available = 有令牌且未初始化`；不泄露令牌 |
| POST | `/api/v1/admin/setup` | 201 `{data:{expiresAt,lastSeenAt}}` | 校验令牌与口令；重复 409；未配置令牌 404 |
| POST | `/api/v1/admin/session` | 200 `{data:{expiresAt,lastSeenAt}}` | 登录；限流；成功轮换 |
| GET | `/api/v1/admin/session` | 200 同上 | 无会话或会话失效 401 |
| DELETE | `/api/v1/admin/session` | 204 | 撤销当前会话并清 Cookie |
| PATCH | `.../tools/:toolId/metadata` | 200 `{data:{toolId,updatedLocales,order}}` | 字段级补丁 + 版本快照 |
| PATCH | `.../tools/:toolId/availability` | 200 `{data:{toolId,availability}}` | 只接受 `disabled` 或 `registry` |
| GET | `.../tools/:toolId/versions` | 200 `{data: AdminVersion[]}` | 按 versionId 倒序，含两种语言 |
| POST | `.../tools/:toolId/rollback` | 200 `{data:{versionId,toolId,locale}}` | 必须带 `expectedVersionId` |

- Cookie：`itools_admin`（HttpOnly、SameSite=Strict、Path=/、Max-Age 为签发时剩余 7 天、HTTPS 下加 Secure）+ `itools_admin_csrf`（可读，同生命周期）。所有管理响应 `cache-control: no-store`。
- 无 `DATABASE_URL` 时 `createCatalogRuntime` 不返回 `admin`，管理端点整体 404；这是「无库不暴露管理面」的默认行为。
- 错误码与状态码映射集中在 `apps/server/src/admin/http.ts`（如 `ADMIN_NOT_AUTHENTICATED` 401、`ADMIN_CSRF_FAILED` 403、`ADMIN_VERSION_CONFLICT` 409），文案固定。

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `apps/server/src/admin/register.ts` | 组装认证与写路由，注入 `guard`、`allowedOrigin` |
| `apps/server/src/admin/types.ts` | Cookie 名、7 天/30 天、5 次/15 分钟常量（冻结） |
| `apps/server/src/admin/http.ts` | 错误码 → 状态码/固定文案的唯一映射 |
| `apps/server/src/admin/auth/routes.ts` | 初始化、登录、会话查询/登出，Cookie 下发与清除 |
| `apps/server/src/admin/auth/{password,tokens}.ts` | scrypt 哈希、32 字节 token、sha256、常量时间比较 |
| `apps/server/src/admin/auth/session-service.ts` | issue / resolve（滑动续期）/ revoke，绝对上限 |
| `apps/server/src/admin/auth/{cookies,csrf}.ts` | 最小 Cookie 读写（SameSite=Strict）与双提交令牌 |
| `apps/server/src/admin/auth/rate-limit.ts` | 进程内固定窗口，1024 键阈值时清理过期窗口 |
| `apps/server/src/admin/auth/guard.ts` | 会话 + CSRF + Origin 校验 |
| `apps/server/src/admin/writes/routes.ts` | 4 条写/读路由、逐字段合并、快照与 trim |
| `apps/server/src/admin/writes/rollback-guard.ts` | 纯函数冲突判定（无 IO） |
| `packages/contracts/src/admin.ts` | 请求 schema、错误码、仓储端口、`ADMIN_VERSION_RETENTION = 50` |
| `packages/db/src/infrastructure/pg-admin-*.ts` | 凭据/会话/版本仓储（SQL 与时间类型） |
| `apps/web/src/api/admin-client.ts` | 同源 Cookie、自动带 CSRF、错误码透传 |
| `apps/web/src/api/{admin-types,admin-queries}.ts` | 客户端类型与查询键（D33：未接 TanStack Query） |
| `apps/web/src/pages/admin/*` | 状态机、认证区、文案表单、启停、版本面板 |
| `packages/app-core/src/i18n/resources/{zh-CN,en}/admin.ts` | `admin` 命名空间文案 |
| `apps/server/src/cli/reset-password{,-core}.ts` | 口令恢复核心与服务器侧命令 |

## 3. 必须遵守的规则

| 规则 | 可检查点 |
| --- | --- |
| 所有管理写路由必须挂 guard，权限只在服务端判定 | `writes/routes.ts` 每个 PATCH/POST 都有 `preHandler: deps.guard`；`guard.ts:61-97`；前端隐藏按钮不算控制 |
| 只能编辑文案/排序/启停 | `AdminMetadataPatchSchema` 无 category/icon；`additionalProperties: false` |
| `availability` 只有 `disabled` / `registry` | `AdminAvailabilityPatchSchema`；服务端把 `registry` 写成 `null`（`writes/routes.ts:124-131`） |
| 文案逐字段合并 | `mergeLocalization`（`:280-303`）；不得整条替换某个 locale |
| 版本只记 `(tool, locale)` 的三条文案 | `AdminVersionSchema`；排序/启停不 append（D32） |
| append 后立即按 50 清理 | `versions.trim(toolId, locale, ADMIN_VERSION_RETENTION)`（`:92`、`:237`） |
| 回滚必须校验 `expectedVersionId`，且只影响目标语言 | `evaluateRollbackGuard`；不等于该语言最新版即 409；`replaceLocaleText`（`:341-360`）不改排序与其它语言 |
| 口令必须 scrypt + 随机盐；token 只存 sha256 | `password.ts:23-33`（盐 16 字节、密钥 64 字节）；`tokens.ts:13`；`token_hash` 唯一索引 |
| Cookie 属性固定 | `cookies.ts:14-15,57-78`：Path=/、SameSite=Strict、会话 HttpOnly |
| 初始化令牌不落库、不写日志 | `auth/routes.ts:88` 只与 `deps.setupToken` 比较；值来自 `config.ts` |
| 管理响应全部 no-store | `sendAdminError` 与各路由显式 header |

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| 在后台开放分类或图标编辑 | 分类/图标属于工具身份，只由注册表决定（D29） |
| 启停写 `availabilityOverride: 'enabled'` | 只允许 `'disabled'` 或 `null`；「启用」= 恢复注册表默认 |
| 回滚省略 `expectedVersionId`，冲突也照写 | 必填；`ADMIN_VERSION_CONFLICT` 时刷新版本列表由人重试 |
| 每次保存都追加含排序/启停的「全量版本」 | 只记 `(tool, locale)` 三条文案（D32），状态变更不进历史 |
| 把会话 token 放进 localStorage 或响应体 | HttpOnly Cookie；服务端只存哈希 |
| 用前端校验替代服务端校验 | 服务端 `guard` + TypeBox schema 双重校验 |
| 初始化令牌写进日志/数据库/前端 bundle | 只从 `process.env.ADMIN_SETUP_TOKEN` 读取并在内存比较 |
| 失败登录就永久锁定账号 | 固定窗口 5 次/15 分钟，窗口结束自动恢复 |

## 5. 如何验证

```sh
pnpm test
# 期望：593 passed（server 162：管理相关 auth 75、writes 14、admin-integration 8；web 102 含后台组件测试）

pnpm build && pnpm check:i18n
# 期望：i18n 键检查通过（admin 命名空间两种语言都不得有未使用键）
```

真实流程（需先 `ADMIN_SETUP_TOKEN` ≥24 字符并启动服务；`3000` 来自 `.env` 的 `PORT`）：

```sh
BASE=http://127.0.0.1:3000
curl -s $BASE/api/v1/admin/setup
# {"data":{"available":true}}

curl -s -c /tmp/itools.jar -X POST $BASE/api/v1/admin/setup \
  -H 'content-type: application/json' -d '{"token":"<令牌>","password":"至少12位口令"}'
# 201；再次调用返回 409 ADMIN_ALREADY_INITIALIZED

CSRF=$(awk '$6=="itools_admin_csrf"{print $7}' /tmp/itools.jar)
curl -s -o /dev/null -w '%{http_code}\n' -b /tmp/itools.jar \
  -X PATCH $BASE/api/v1/admin/tools/<toolId>/availability \
  -H 'content-type: application/json' -d '{"override":"disabled"}'
# 403（缺少 x-csrf-token）

curl -s -o /dev/null -w '%{http_code}\n' -b /tmp/itools.jar \
  -X PATCH $BASE/api/v1/admin/tools/<toolId>/availability \
  -H "x-csrf-token: $CSRF" -H 'content-type: application/json' \
  -d '{"override":"disabled"}'
# 200
```

口令恢复（无公网接口，仅服务器侧）：

```sh
DATABASE_URL='postgresql://...' pnpm --filter @itools/server admin:reset-password
# 或本地：cd apps/server && node --env-file=../../.env dist/cli/reset-password.js
# 期望：管理员口令已重置（...），已撤销 N 个会话。
# 未设 ADMIN_NEW_PASSWORD 时另打印「新口令：...」且只显示一次。
```

## 6. 常见任务（step-by-step）

### 6.1 新增一条管理写 API

1. `packages/contracts/src/admin.ts`：新增请求 schema 与错误码（冻结文件，先确认）；导出请求类型。
2. `apps/server/src/admin/writes/routes.ts`：在 `registerAdminWriteRoutes` 注册，`attachValidation: true` + `preHandler: deps.guard` + `schema.body`。
3. 校验顺序固定：`validationError` → `readRegistryItem` 判存在 → 读当前覆盖 → `upsertOverride` →（如需快照）`versions.append` + `trim`；成功响应 `cache-control: no-store`。
4. 错误只走 `sendAdminError`。新错误码必须在 `http.ts` 的 `DEFAULT_STATUS` 与 `DEFAULT_MESSAGE` 同时登记。
5. 测试补 400/401/403/404/409（`writes/routes.test.ts`），真实库链路加到 `admin/admin-integration.test.ts`；前端在 `admin-client.ts` 加方法与 guard，并补 `admin` 命名空间文案。

### 6.2 新增一个可编辑文案字段

1. 契约与表：`AdminLocalizedPatchSchema`、`AdminVersionSchema`、`tables.ts` 与新增迁移同步（见 [06](06-backend-database-api.md)）；合并四处都要改：`mergeLocalization`、`collectUpdatedLocales`、`effectiveText`、`replaceLocaleText`，漏一处会出现「保存成功但回滚丢字段」。
2. 快照：`pg-admin-versions.ts` 的 `append` 写入 jsonb、`VERSION_COLUMNS` 展开新键；UI 在 `AdminMetadataForm` 的 `FIELD_KEYS`/`toDraft`/`buildPatch`/`validate` 增加输入。
3. i18n 与测试：`packages/app-core/src/i18n/resources/{zh-CN,en}/admin.ts` 同时加键，`pnpm check:i18n` 必须通过；补 writes 路由与 `apps/web/src/pages/admin/admin.test.tsx`。

### 6.3 调整版本保留数

1. 只改 `packages/contracts/src/admin.ts` 的 `ADMIN_VERSION_RETENTION`，并在 D30 记录原因；两处调用自动生效（`writes/routes.ts:92`、`:237`），确认没有别处硬编码 50。
2. 测试：构造 `keep + 1` 条版本，断言最旧被删除、当前生效版本仍在。

### 6.4 排障：初始化入口不可见或口令丢失

1. `GET /api/v1/admin/setup` 返回 404 → 没有 `DATABASE_URL`（管理未装配）或服务未重启。
2. 返回 `available:false` → 已初始化（改走登录），或令牌为空/不足 24 字符（后者启动即失败）；令牌正确但 401 说明重启后换了值。
3. 忘记口令 → 用 5. 中的 CLI；不要手工改 `admin_credentials`，也不要新增恢复 API。

## 7. 已知限制与相关决策

- D05 唯一管理员；D29 不可编辑分类/图标；D30 每语言 50 版；D31 环境令牌初始化；D32 版本只含文案；D33 后台用 effect + 局部状态取数（`admin-queries.ts` 的 Query 选项保留但未使用）。
- 会话 Cookie 的 `Max-Age` 在登录时固定为 7 天，服务端滑动续期不会重发 Cookie：持续活跃超过 7 天仍需重新登录；CSRF token 也只在登录/初始化时下发，不随会话轮换。
- 限流是进程内固定窗口，多实例各自计数；也没有账号维度的锁定。
- 元数据写入是跨仓储调用的「读-改-写」，无数据库事务；并发编辑可能后写覆盖，回滚有 `expectedVersionId` 保护。
- **下架后无法在后台恢复**：后台工具列表复用公开 `GET /api/v1/tools`（`AdminPage.tsx:68`），该接口过滤 `disabled`（`tool-catalog-service.ts:131`），工具下架后即从列表消失；恢复需直接调用 `PATCH .../availability`（带 CSRF），或后续补管理专用列表。
- 文案覆盖没有「清除」入口：`AdminLocalizedPatchSchema` 只接受 ≥1 字符字符串，`upsertOverride` 也不删除缺失 locale 行。
- 版本列表不按语言过滤，面板展示两种语言混排；回滚只按目标版本的 `locale` 生效。
- 阶段 11 的浏览器 E2E 已验证无数据库时管理入口安全失败；真实管理员初始化、登录和写入仍只有组件测试与 `inject` 集成测试，未有浏览器端到端覆盖。
