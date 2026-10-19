# iTools

多工具网站（MD3 设计体系，工具在浏览器本地处理）。阶段 0–9 已完成；PWA、CI 与部署未开始。

**全部技术文档只有一套：`docs/00`–`15`。** 请从 [docs/00 · 架构总览与开发入口](docs/00-architecture-overview.md) 开始阅读——启动、命令、代码地图、任务流程与红线都在那里。

| 常用入口 | 文档 |
| --- | --- |
| 开发入口 / 启动 / 红线 | [00](docs/00-architecture-overview.md) |
| MD3 设计系统规范 | [01](docs/01-design-system.md) |
| 阶段路线图 | [14](docs/14-phase-implementation-roadmap.md) |
| 决策记录（D01–D36） | [13](docs/13-acceptance-open-decisions.md) |
| 强制代码规范 | [15](docs/15-mandatory-code-requirements.md) |

```sh
pnpm install
pnpm dev       # http://127.0.0.1:$PORT（.env 当前 PORT=3000），/ → /zh-CN
pnpm verify    # 提交前必须全绿
```
