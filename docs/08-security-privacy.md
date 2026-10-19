# 08 · 安全与隐私

> 状态：**已实现（阶段 9）**。已具备：严格 CSP 与安全响应头、管理端认证/会话/CSRF/来源检查/登录限流、公开 API 限流、最小化脱敏日志、本地包禁网审计、外部资源审计、依赖漏洞扫描命令。
> 未实现：依赖漏洞的**合并阻断**（需 CI，阶段 11）、源站防火墙与 WAF（阶段 12）、日志落盘轮转与 30 天保留（阶段 12）。

## 数据边界
- 用户源文件、处理结果和普通用户任务数据只在浏览器本地处理/保存；禁止未经授权的遥测、分析或错误报告外传。
- **自动化边界**：`scripts/check-no-network.mjs` 扫描 `asset-store` 与 `task-runtime` 的生产源码，禁止任何网络发送 API；已并入 `pnpm lint` 与 `pnpm verify`。新增本地处理包必须显式加入白名单并说明理由。

## 响应头与 CSP（`apps/server/src/security/headers.ts`）
- 全部响应（HTML / API / 404 / 静态资源）经 `onSend` 统一加头。
- 生产 CSP：`default-src 'self'`、`script-src 'self'`、`style-src 'self' 'unsafe-inline'`、`img-src 'self' data: blob:`、`font-src 'self'`、`connect-src 'self'`、`worker-src 'self' blob:`、`object-src 'none'`、`base-uri 'self'`、`form-action 'self'`、`frame-ancestors 'none'`。
- 开发 CSP 额外放行内联脚本与 `ws:`（Vite HMR），但仍保留 `object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`。
- 其余：`x-content-type-options: nosniff`、`referrer-policy: strict-origin-when-cross-origin`、`x-frame-options: DENY`、`permissions-policy`（禁用 camera/microphone/geolocation/payment）、`cross-origin-opener-policy: same-origin`。
- HSTS 仅在站点来源为 `https:` 时下发（`max-age=31536000; includeSubDomains`）。
- 已知取舍（D34）：`style-src` 必须保留 `'unsafe-inline'`，因为 MD3 组件会输出元素级 `style` 属性与主题变量，CSP 的 nonce/hash 不覆盖内联样式属性。`script-src` 未放宽。

## 外部资源审计
`scripts/check-external-resources.mjs` 扫描构建产物中的 HTML/CSS，发现指向外部 `http(s)` 的 `src` / `href` / `url()` 即失败；已串入 `pnpm verify`（build 之后）。新增外部资源必须先经审核并同步 CSP 白名单。

## 认证与授权
- 唯一管理员，无注册；口令 scrypt + 随机盐；会话 token 只存哈希；Cookie `HttpOnly` + `SameSite=Strict`，HTTPS 下加 `Secure`。
- 非 GET/HEAD 请求强制 CSRF 双提交校验；生产环境下额外校验 `Origin` 必须等于站点来源（配置 `allowedOrigin` 时生效）。
- 登录固定限流（5 次 / 15 分钟，进程内固定窗口，不永久锁定）。
- 所有权限检查在服务端执行，错误统一为固定文案，不区分「账号不存在」与「口令错误」。

## 公开 API
- 只读 `/api/v1/tools`、`/api/v1/tools/:id`、`/api/v1/health/*`；错误信封固定 `{ code, message, requestId }`。
- 固定速率限制：每 IP 每分钟 120 次，超限返回 429 + `retry-after`，`cache-control: no-store`。
- 目录响应 `public, max-age=60`；404 与 429 均 `no-store`。

## 日志
- 生产环境每个请求输出一行 JSON：`time, requestId, method, path, status, durationMs`。
- **不读取**任何请求头、请求体、响应体；`path` 去掉查询串，因此不会记录 URL 中的凭据。
- 写入失败被吞掉，不影响请求；日志落盘、轮转与 30 天保留属阶段 12。

## 依赖
- 锁文件固定；`pnpm check:audit`（`pnpm audit --prod --audit-level high`）当前结果为 **No known vulnerabilities found**。
- 漏洞的合并阻断在阶段 11 的 CI 中执行（本阶段只提供命令与策略）。
- 许可证纳入依赖清单与开源致谢（阶段 13 汇总）。

## 验收证据
- 安全响应头：`apps/server/src/security/headers.test.ts`（8 项）+ `apps/server/src/app-security.test.ts`（4 项，覆盖 302/404/503 与生产 CSP）。
- 来源检查：`apps/server/src/admin/auth/guard-origin.test.ts`（5 项，缺失/跨源 Origin 拒绝，读请求不受影响）。
- 限流：`apps/server/src/api/rate-limit.test.ts`（第 121 次 429）。
- 日志脱敏：`apps/server/src/logging/request-log.test.ts`（8 项，查询串、Cookie、Authorization、body 均不出现在输出）。
- 真实 HTTP 冒烟：CSP/HSTS/其余头齐全；带 `?token=...` 的请求在日志中只留路径，`grep` 敏感值为 0。
