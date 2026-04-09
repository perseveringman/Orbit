# Orbit Reboot 设计方案总目录

这是一套为**全新 Agent 原生智能助手应用**准备的完整蓝图。它保留 Orbit 的核心愿景——把输入、思考、行动编织成一张网——但不再延续当前项目的历史实现边界，而是按新的产品目标、三端形态、Local-first、对象网络与 Agent 深度融合方式，从 0 重新设计。

这套方案由**主 Agent 总体收敛 + 18 个专题 Agent 并行细化**共同完成。阅读顺序建议先看总纲，再按产品域和技术域展开。

## 阅读顺序

1. `00-总体架构蓝图.md`
2. `01-愿景写入与长期记忆.md`
3. `02-人生规划系统.md`
4. `03-Agent驱动任务管理.md`
5. `04-全源阅读与转译转写.md`
6. `05-研究工作台.md`
7. `06-笔记与高亮系统.md`
8. `07-写作与输出工作台.md`
9. `08-全局日志与Journal.md`
10. `09-对象网络与关联能力.md`
11. `10-Monorepo与三端应用.md`
12. `11-LocalFirst同步与GDPR.md`
13. `12-关系型对象数据库.md`
14. `13-文件系统优先数据架构.md`
15. `14-Agent架构.md`
16. `15-应用能力MCP化.md`
17. `16-Block编辑器.md`
18. `17-中英繁三语架构.md`
19. `18-设计系统与换肤.md`

## 文档分区

| 分区 | 文档 | 说明 |
|---|---|---|
| 总纲 | `00` | 主 Agent 对整体产品与系统架构的统一收敛 |
| 方向与规划 | `01` `02` `03` | 愿景、人生规划、Agent 驱动任务管理 |
| 输入与思考 | `04` `05` `06` | 阅读、研究、笔记/高亮 |
| 输出与复盘 | `07` `08` `09` | 写作工作台、日志/Journal、对象网络 |
| 平台与基础设施 | `10` `11` `12` `13` | 三端、同步合规、对象数据库、文件系统优先数据架构 |
| Agent 与能力层 | `14` `15` | Agent runtime 与 MCP capability layer |
| 体验基础层 | `16` `17` `18` | Block 编辑器、三语、设计系统 |

## Agent 团队编排

| 角色 | Agent | 负责文档 |
|---|---|---|
| 主架构 Agent | 主 Agent（当前会话） | `00-总体架构蓝图.md`、本目录组织与一致性收敛 |
| 愿景 Agent | `vision-memory-agent` | `01-愿景写入与长期记忆.md` |
| 人生规划 Agent | `life-planning-agent` | `02-人生规划系统.md` |
| 任务编排 Agent | `task-management-agent` | `03-Agent驱动任务管理.md` |
| 阅读宇宙 Agent | `reading-universe-agent` | `04-全源阅读与转译转写.md` |
| 研究 Agent | `research-workspace-agent` | `05-研究工作台.md` |
| 笔记高亮 Agent | `note-highlight-agent` | `06-笔记与高亮系统.md` |
| 写作 Agent | `writing-studio-agent` | `07-写作与输出工作台.md` |
| Journal Agent | `journal-log-agent` | `08-全局日志与Journal.md` |
| 对象网络 Agent | `object-graph-agent` | `09-对象网络与关联能力.md` |
| 平台架构 Agent | `monorepo-platform-agent` | `10-Monorepo与三端应用.md` |
| 同步合规 Agent | `localfirst-gdpr-agent` | `11-LocalFirst同步与GDPR.md` |
| 对象数据库 Agent | `relational-object-db-agent` | `12-关系型对象数据库.md` |
| 文件系统 Agent | `filesystem-metadata-agent` | `13-文件系统优先数据架构.md` |
| Agent Runtime Agent | `agent-architecture-agent` | `14-Agent架构.md` |
| MCP 能力层 Agent | `mcp-capability-agent` | `15-应用能力MCP化.md` |
| 编辑器 Agent | `block-editor-agent` | `16-Block编辑器.md` |
| 三语 Agent | `trilingual-i18n-agent` | `17-中英繁三语架构.md` |
| 设计系统 Agent | `design-system-agent` | `18-设计系统与换肤.md` |

## 这套方案的总前提

1. 这是一个**从 0 设计的新项目**。
2. 保留 Orbit 的核心方向：输入、思考、行动的闭环，以及 Agent 无处不在。
3. 桌面端使用 **Electron**，整体采用 **Monorepo**，同时支持 **iOS / Web**。
4. 数据是 **Local-first**，用户内容以**文件系统**为主真相层，数据库负责**元数据、关系、索引、事件**。
5. 应用内全部能力都应经过统一 capability interface，并向内部/外部 Agent 提供 **MCP** 访问能力。
6. 整体从一开始支持**简体中文 / English / 繁體中文**与完整设计系统。
