# iTools

多工具网站（MD3 设计体系，工具在浏览器本地处理）。阶段 0–11 已完成；阶段 11 的本地与 GitHub Actions 门禁均已验证，`main` 分支要求 `quality` 检查通过。部署与真实工具仍未开始。

**全部技术文档只有一套：`docs/00`–`15`。** 请从 [docs/00 · 架构总览与开发入口](docs/00-architecture-overview.md) 开始阅读——启动、命令、代码地图、任务流程与红线都在那里。

| 常用入口 | 文档 |
| --- | --- |
| 开发入口 / 启动 / 红线 | [00](docs/00-architecture-overview.md) |
| MD3 设计系统规范 | [01](docs/01-design-system.md) |
| 阶段路线图 | [14](docs/14-phase-implementation-roadmap.md) |
| 决策记录（D01–D37） | [13](docs/13-acceptance-open-decisions.md) |
| 强制代码规范 | [15](docs/15-mandatory-code-requirements.md) |

```sh
pnpm install
pnpm dev       # http://127.0.0.1:$PORT（.env 当前 PORT=3000），/ → /zh-CN
pnpm verify:stage11  # 本地全量门禁；需测试 PostgreSQL 与 Playwright Chromium
```
