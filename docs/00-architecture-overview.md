# 00 · 全局架构总览

## 目标与范围
公开发布的多工具网站：`itools.wataa.men`。提供首页、音频、图像、视频、文本、其他工具分类；普通用户免登录，管理员后台登录。文件和计算尽可能在浏览器本地完成；禁止未经授权上传用户文件、处理结果或任务数据。

## 固定技术栈
- Monorepo：pnpm Workspace + Turborepo。
- 前端：React + Vite，Fastify 提供 SSR 与静态资源托管；TypeScript `strict`。
- 后端：Node.js + TypeScript + Fastify。
- 数据库：PostgreSQL；Drizzle ORM + Drizzle Kit。
- API：TypeBox + Fastify JSON Schema；`/api/v1`；OpenAPI 从实际路由/Schema 生成。
- 请求：共享类型安全 API client + TanStack Query。
- 国际化：i18next + react-i18next。
- 测试：Vitest（单元/集成），Playwright（浏览器 E2E）。
- 质量：ESLint + Prettier + TypeScript Strict。
- CI：GitHub Actions。
- 部署：Linux + Docker Compose；反向代理负责 HTTPS；Cloudflare/CDN/WAF 代理公网入口。
- UI：Material Design 3 体系；主品牌洋红、Material Symbols Rounded 本地托管优先。

## 系统边界
- 浏览器：工具算法、文件处理、任务运行、IndexedDB、结果下载、PWA。
- Fastify：SSR、静态资源、目录可用性验证、管理 API、公开 API、健康检查、OpenAPI。
- PostgreSQL：工具目录元数据、管理员会话、元数据版本历史及服务端运行数据。
- CDN/WAF：公网代理、HTTPS/WAF/限流和缓存；源站防火墙限制绕过代理的直接访问。
- 不把用户文件、处理结果或本地任务数据上传至后端。

## 模块依赖方向
`apps/web` → `packages/design-system-adapter`、`packages/app-core`、`packages/tool-*`  
`packages/tool-*` → 仅依赖公开的 `app-core` 契约和必要的共享 UI，不得反向依赖其他工具。  
`apps/server` → `packages/contracts`、`packages/db`。  
`packages/contracts` 不依赖前端、数据库实现或工具实现。  
用 ESLint 边界规则和 CI 强制执行；不得只依赖文档约定。

## 核心原则
1. 工具真实实现、稳定 ID、路由、能力与依赖由代码注册表和版本化 Seed 管理。
2. 数据库管理启用状态、分类、排序及管理员可编辑的展示元数据；后台不能创建不存在的实现。
3. 工具目录动态数据不承诺强实时；但服务器直达工具路由必须查询数据库状态并对不存在/停用工具返回真实 HTTP 404。
4. 任务、文件、错误、存储与下载统一经共享核心。
5. 生产部署、生产数据库迁移、破坏性数据操作和公网安全配置变更必须先获用户批准。
6. 全局架构基线冻结后，变更必须提交原因、影响、迁移、测试和回滚方案。
