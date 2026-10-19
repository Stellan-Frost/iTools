# 06 · 后端、数据库与 API

## 运行栈
- Node.js + TypeScript + Fastify。
- PostgreSQL 主关系数据库。
- Drizzle ORM + Drizzle Kit；迁移显式版本化。
- TypeBox + Fastify JSON Schema 统一运行时校验、TS 类型与 OpenAPI 生成。
- API 前缀 `/api/v1`；共享类型安全 API client + TanStack Query。

## 数据模型边界
- `tools`：稳定 ID、实现/路由标识、启用状态、分类、排序、非语言属性及系统字段。
- `tool_localizations`：`tool_id + locale` 唯一，存名称、简介与 SEO 文案；外键关联工具。
- 元数据版本表：为管理员可编辑展示字段保存快照、版本、时间及回滚所需信息。
- `admin_sessions`：持久化会话状态、过期和撤销信息。
- 不建立普通用户账户系统；普通用户数据留在浏览器。
- 数据库事务处理多表操作；唯一性、外键和关键状态由数据库约束。

## Seed 与目录一致性
- Seed 负责新增工具、初始化默认值和同步稳定身份/系统字段。
- 已存在的管理员可编辑字段默认保留；默认值变更使用显式迁移或经批准脚本。
- CI/部署核对代码注册表、Seed 与数据库；不存在实现的工具不得启用。
- 重复 ID、非法路由、不兼容能力声明阻断发布；只自动执行安全明确的新增和默认值初始化。

## API 响应
- 成功：统一 `{ data, meta? }`。
- 错误：稳定 `code`、用户可读 `message`、可选字段校验详情、request ID。
- HTTP 状态码必须准确；分页结构统一。
- 错误响应不得泄露堆栈、数据库内部信息、凭据或敏感参数。
- 同一主版本保持向后兼容；优先增加可选字段/新端点，不兼容变化使用新版本。
- OpenAPI 从实际 Fastify 路由与 TypeBox Schema 生成；CI 检查契约差异与文档一致性。
- 生产提供受控只读 OpenAPI 入口。

## 连接与运行
- Fastify 使用应用内 PostgreSQL 连接池，配置上限、连接/查询超时、空闲回收和优雅关闭；不引入独立连接池代理。
- 健康检查区分 liveness 与 readiness。
- 配置通过集中 Schema 校验；关键配置缺失/非法时拒绝启动，日志不得输出秘密值。
