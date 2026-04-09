# 14-Agent架构

## 1. 设计定位

Orbit 的 Agent 架构不是把 Hermes 的 CLI 助手搬进应用，而是把“Agent 作为系统级编排层”真正嵌进项目、阅读、研究、写作、Journal 与对象网络之中。用户看到的不是一个外挂聊天框，而是每个产品场景里都有一个可被唤起、可被审计、可被暂停、可被接管、可被追溯的执行层。

本专题的核心判断是：**Hermes 值得借鉴的是 Agent 运行原则，不是 CLI / gateway 的产品外形。**

| 分类 | 应借鉴的 Hermes 原则 | 不应照搬的 Hermes CLI / gateway 实现 |
|---|---|---|
| 主循环 | 稳定 system prompt + 动态上下文注入；ReAct 主循环只负责思考、选能力、执行能力 | 以终端命令、文件编辑、shell session 为中心的任务形态 |
| 多 Agent | 子 Agent 必须隔离上下文、预算、工具集，且只回传摘要与产物 | “子 Agent = 新开一个 CLI 子会话”的交互模型 |
| 工具体系 | Tool / capability registry 是一等公民；工具入口要做过滤与策略检查 | 以 toolset 名称硬编码产品结构；把能力等同于命令行工具 |
| 记忆体系 | 记忆分层、session search、handoff summary、compression、lineage | 用 `MEMORY.md` / `USER.md` 作为产品长期记忆主载体 |
| 安全 | 安全要落在能力入口与执行网关，而不只写在 prompt 里 | 仅围绕危险 shell 命令的正则审批逻辑 |
| 学习 | 学习沉淀应异步后置，不污染主任务 | 直接让主会话承担技能维护、CLI 自修补的主要体验 |

因此，Orbit 中真正的一等公民不是“聊天消息”，而是 **Agent Session、Agent Task、对象上下文、能力调用、审批记录、异步任务、压缩摘要与审计日志**。

## 2. 关键用户场景

### 场景 A：在项目页内发起“把这个方向落成计划”
用户在项目页写下一段意图，Orchestrator 不先打开聊天窗，而是直接创建一次 `agent_session + agent_run`，装配 vision、directive、项目现状、相关研究与待办，调用 Planner Agent 产出里程碑、任务草案与待确认决策点，并把结果回写到项目视图。

### 场景 B：在阅读现场触发“这段内容和我当前研究有什么关系”
用户在 Reader 中选中一段文本，Reader Agent 先取文章、高亮、相关研究空间与当前项目，再决定是否委派给 Research Agent 做证据比对，最后把“解释 + 建链建议 + 是否生成任务/笔记”的结果回写侧栏，而不是生成一段孤立对话。

### 场景 C：长任务进入后台执行
抓取网页、批量转写、翻译、外部检索、报告生成等都不应阻塞前台会话。Orchestrator 会把能力调用拆成 `agent_task + async_job`，进入统一任务中心；用户可在任何端查看状态、重试、审批、接管或回放。

### 场景 D：跨会话延续同一主题
用户三天后回到一个研究空间，系统不依赖滚动聊天历史，而是通过 session lineage、对象网络和压缩摘要找回“上次已验证的结论、未解决的缺口、待审批的外部动作、已生成的产物”，让会话成为连续工作，而不是重新聊天。

## 3. 核心设计

### 3.1 总体架构：以 Orchestrator 为中枢的产品内多 Agent 系统

Orbit 采用“**主 Agent 编排 + 领域 Agent 执行 + capability registry 管控 + memory / search / safety 作为共享底座**”的结构：

1. **触发层**：来自项目页、Reader、Research Space、Writing、Journal、定时器或后台事件。
2. **Orchestrator**：识别意图、装配对象上下文、决定同步执行还是异步排队、决定是否委派子 Agent。
3. **Domain Agents**：在被裁剪后的能力范围内完成专题工作。
4. **Capability / Tool Registry**：统一暴露应用内能力、MCP 能力与系统能力，并附带风险、权限、设备、成本与审批元数据。
5. **Memory / Session Search / Compression**：负责跨回合、跨对象、跨会话的可控回忆，不让原始长对话成为唯一真相。
6. **Safety Gate**：在任何能力执行前做上下文扫描、策略校验、审批判定、出境检查与审计记录。
7. **对象层与日志层**：所有关键结果都要对象化、事件化、可追溯，而不是只留在消息里。

### 3.2 Orchestrator：不是超级聊天机器人，而是系统调度器

Orchestrator 的职责有且只有六类：

1. **意图路由**：判断这是规划、阅读理解、研究求证、写作辅助、Journal 回顾，还是后台执行请求。
2. **上下文装配**：从 01/03/05/08/09 拉取对象、关系、事件、规则与用户长期偏好，生成本轮可用上下文包。
3. **Agent 分发**：决定由哪个 domain agent 主执行，是否需要并行委派，子 Agent 的预算和能力边界是什么。
4. **执行模式选择**：前台同步、后台异步、需要审批后继续、或先产出草案再等待用户确认。
5. **结果归档**：把结论写回对象层，把过程写入日志层，把可复用摘要送入压缩层，把应学习的内容送去异步学习回路。
6. **风险兜底**：所有外部写入、付费调用、隐私出境、不可逆修改都必须先过 Safety Gate。

Orchestrator 自己不承担所有领域知识；它更像“任务总控 + 上下文编译器 + 执行监督者”。

### 3.3 Orbit 的领域 Agent 划分

Orbit 的子 Agent 必须按产品专题划分，而不是按 CLI 工具集划分：

| Agent | 负责对象 / 场景 | 典型输出 | 禁止越界 |
|---|---|---|---|
| **Planner Agent** | vision、directive、project、milestone、task、Today / Focus / Review 编排 | 计划草案、任务树、优先级建议、阻塞识别 | 不可直接改写愿景；高影响计划变更需审批 |
| **Reader Agent** | article、book、podcast、video transcript、highlight | 摘要、解释、翻译、转写结果、建链建议 | 不可把 AI 摘要替代原文真相 |
| **Research Agent** | research_space、question、source_set、claim、gap、artifact | 证据包、差异分析、研究报告、缺口清单 | 不可绕过证据链直接写长期结论 |
| **Writing Agent** | draft、document、post、slide、outline | 提纲、改写、引用插入、发布前核验 | 不可静默对外发布 |
| **Review Agent** | journal_entry、review、timeline、daily/weekly summary | 回顾草稿、模式识别、下一步建议 | 不可把回顾解释覆盖事实事件 |
| **Graph Agent** | object_index、links、events、backlinks、session lineage | 建链、去重、对象归类、上下文召回包 | 不可代替业务 Agent 做领域判断 |
| **Ops Agent** | async_job、approval_request、notification、connector run | 后台任务编排、失败恢复、提醒与状态同步 | 不可绕过审批执行高风险动作 |

这些 Agent 都是围绕 Orbit 的对象系统和工作台设计的，不是 Hermes 中“terminal/file/web/browser”式工作分组的翻版。

### 3.4 Capability / Tool Registry：以能力为单位，而不是以命令为单位

Orbit 不应简单复制 Hermes 的工具注册表，而应升级为**能力注册表**。工具只是能力的执行适配器；产品真正治理的是 capability。

建议每个 capability 至少带以下元数据：

- `capability_id`：如 `project.plan.generate`、`reader.translate`、`research.search.external`
- `domain`：planning / reading / research / writing / review / graph / ops
- `input_contract` / `output_contract`
- `risk_level`：`R0-read` / `R1-internal-write` / `R2-external-read` / `R3-external-write`
- `approval_policy`：none / soft / required / dual-confirm
- `execution_mode`：sync / async / resumable
- `scope_limit`：当前对象、当前空间、当前项目、全局
- `cost_profile`：token、网络、金钱、时延
- `data_boundary`：本地、可出境、敏感需脱敏
- `provider_binding`：本地引擎、内建服务、MCP connector、第三方 API

注册表过滤逻辑必须同时考虑：**当前入口、用户权限、设备能力、对象作用域、隐私策略、审批状态、模型预算**。这正是 Hermes 的 registry 思路应被保留的部分；但 Orbit 不应把 registry 退化成“列出可给模型的函数名”。

### 3.5 Memory Layers：让回忆服务对象网络，而不是吞掉对象网络

Orbit 采用五层记忆：

| 层级 | 作用 | 主要来源 | 典型用途 |
|---|---|---|---|
| **L0 Turn Scratch** | 当前回合临时推理缓存 | 本轮消息、即时 tool result | 单回合内思考，不持久化 |
| **L1 Session Memory** | 当前 session 的工作记忆 | 消息、已选对象、当前任务状态 | 连续多轮协作、断点恢复 |
| **L2 Object Memory** | 从对象与事件中提炼出的结构化事实 | project/task/research/journal/links/events | 当前主题 grounding |
| **L3 User Long-term Memory** | 长期稳定偏好、愿景摘要、确认过的规则 | 01 的愿景与 directive、用户设定 | 跨场景建议稳定性 |
| **L4 Procedural Memory** | 经验证的工作法、提示模板、能力使用策略 | 异步学习回路沉淀 | 下次类似任务的执行策略 |
| **L5 Session Archive/Search** | 历史 session 摘要、lineage、可检索片段 | 压缩摘要、审计日志、搜索索引 | 跨会话回忆与追溯 |

这里要明确借鉴 Hermes 的三条原则：

1. 记忆应由 Agent 层直接托管，而不是散落在业务页面状态里。
2. 跨会话回忆优先依赖搜索 + 摘要，不依赖无限堆叠原始历史。
3. 记忆注入必须被 `<memory-context>` 一类边界包裹，避免模型误判来源。

但 Orbit 不照搬 Hermes 的地方是：**长期真相主要来自对象层与用户确认，而不是自由写入的 Memory 文件。**

### 3.6 Session Lineage 与 Compression：会话不是线性聊天，而是可追溯工作谱系

Orbit 的 session 必须有谱系关系：

- `continues_from`：同一主题的后续会话
- `delegated_from`：由主 Agent 派生出的子 Agent 运行
- `spawned_by_object`：从项目/文章/研究空间/Journal 触发
- `blocked_by_approval`：因审批暂停
- `resumed_from_job`：由异步任务恢复
- `compressed_into`：被压缩成更高层摘要

Compression 也必须分层：

1. **Turn Summary**：压缩单轮工具结果，保留关键参数与结论。
2. **Session Summary**：会话结束时生成“问题—动作—结果—未决事项”。
3. **Workspace Digest**：对项目、研究空间、写作空间生成主题摘要。
4. **Lineage Handoff**：跨会话续接时只注入摘要、关键对象与未决点。
5. **Archive Recall Pack**：session search 返回命中的历史摘要包，而不是原始长聊天。

Hermes 的“靠 handoff summary + session lineage，而不是无限堆历史”应完整继承；但 Orbit 不需要复制其 CLI 的 session 浏览体验，而应在产品内把 lineage 显示为对象侧栏、任务时间线和审计回放。

### 3.7 Approval 与 Safety Gate：执行边界必须产品级可见

Safety Gate 是比 Orchestrator 更靠近执行的一层，统一负责：

1. **上下文安全扫描**：检查外部内容中的注入文本、隐藏控制字符、越权指令。
2. **能力策略判断**：当前 capability 是否允许在此入口、此对象范围、此设备上执行。
3. **审批判定**：是否涉及外部发送、批量改写、删除、同步出境、付费调用、发布。
4. **脱敏与最小出境**：云模型默认只发摘要、片段、结构化元数据，不默认发送完整原文。
5. **执行审计**：记录谁触发、Agent 为什么调用、输入摘要、输出摘要、对象影响、审批链。

审批分四档：

- **A0 自动通过**：只读、本地、可逆、低成本。
- **A1 透明自动执行**：内部写入但可撤销，如高置信建链、草稿生成。
- **A2 单次审批**：外部检索、批量处理、明显成本消耗、敏感内容出境。
- **A3 强审批**：删除、发布、发送消息、跨空间批量改写、授权变更。

这里借鉴 Hermes 的关键不是“approval.py 的正则规则”，而是**审批必须在工具入口生效**。Orbit 的审批对象也不是 shell 命令，而是产品动作、数据出境和对象改写。

## 4. Agent 行为与自动化机制

### 4.1 Agent 如何深度融入产品，而不是做外挂聊天框

Orbit 中每个主工作台都应内嵌一个“带对象上下文的 Agent 面板”，但这个面板只是入口，不是容器本体：

- **项目页**：Agent 生成计划、判断下一步、解释阻塞，结果回写任务树与 Review。
- **Reader**：Agent 围绕选区做解释、翻译、比较、提问、建链，结果回写高亮、笔记、研究空间。
- **Research Space**：Agent 负责证据编译、缺口识别、外部检索任务派发、报告生成。
- **Writing**：Agent 做提纲、引用、风格修订、事实回链，但所有稿件仍是文档对象。
- **Journal / Review**：Agent 读取 timeline、事件与对象变化，生成回顾草稿与下一步建议。
- **任务中心**：Agent 的异步任务、失败重试、审批等待、恢复入口统一可见。

设计重点是“**先找对象和动作，再决定是否显示对话**”，而不是“先聊天，再想办法把聊天内容落地”。

### 4.2 产品级 Agent 对象、任务、日志、审计、审批与异步任务

一次完整的 Agent 工作流应当是：

`agent_session` → `agent_run` → `agent_task`（可树状拆分）→ `capability_call` / `subagent_run` → `approval_request?` → `async_job?` → `object_mutation` / `artifact_output` → `session_summary` → `audit_log`

这意味着：

- **对象**：会话、运行、任务、步骤、审批、日志、摘要、学习项都是对象，不只是内部状态。
- **任务**：前台与后台共享同一任务模型，只是展示与调度不同。
- **日志**：既记录用户可见摘要，也记录系统级结构化 trace。
- **审计**：可按对象、会话、能力、审批、时间段回放。
- **审批**：审批请求可暂停运行，批准后从原谱系恢复，而不是重开一段聊天。
- **异步任务**：长任务可跨端继续，完成后回到原工作台对应对象。

### 4.3 异步学习回路

借鉴 Hermes，“学习沉淀异步后置”应保留，但 Orbit 要把它产品化：

1. 主任务结束后，系统把 `run summary + 成败结果 + 审批记录 + 用户修正` 送入学习队列。
2. 学习器提炼三类内容：
   - 可复用执行模板（程序化记忆）
   - 稳定用户偏好或禁忌（长期记忆候选）
   - 能力路由与上下文装配优化建议
3. 学习结果先进入 **候选层**，不能直接改写愿景、directive、安全规则或审批策略。
4. 高风险学习项必须用户确认；低风险执行模板可灰度启用并留痕。
5. 学习过程本身也要有审计记录，避免“系统偷偷学坏”。

因此 Orbit 的学习闭环不是“Agent 自我强化黑箱”，而是“**可审计的、可回滚的、与对象系统协同的异步改进机制**”。

## 5. 数据模型 / 接口 / 能力边界

### 5.1 核心对象模型

| 对象 / 表 | 作用 |
|---|---|
| `agent_sessions` | 一个被用户感知的连续协作容器，绑定入口、对象范围与 lineage |
| `agent_runs` | 一次具体运行，记录模型、策略、预算、开始/结束状态 |
| `agent_tasks` | 可递归拆分的任务节点，对应主任务、子任务或异步任务单元 |
| `agent_steps` | 每次推理阶段、能力调用、子 Agent 委派、审批暂停点 |
| `capability_calls` | 结构化记录每次 capability 输入摘要、输出摘要、风险与耗时 |
| `approval_requests` | 审批对象、原因、请求人/Agent、状态、过期时间、恢复点 |
| `async_jobs` | 后台执行实体，支持队列、重试、取消、恢复、跨端同步 |
| `memory_entries` | 分层记忆项，带来源对象、置信度、过期策略与可见性 |
| `session_summaries` | 压缩后的 turn/session/workspace/lineage 摘要 |
| `audit_logs` | 面向治理与排障的统一追溯记录 |

### 5.2 关键接口

```ts
agent.startSession(surface, anchorObjects, intent)
agent.run(sessionId, userInput, mode)
agent.delegate(runId, domainAgent, scopedTask)
capability.list(filters)
capability.invoke(capabilityId, payload, executionContext)
memory.recall(scope, query)
session.search(query, lineageScope)
compression.compact(sessionId, level)
approval.request(action, impactSummary)
asyncJob.enqueue(capabilityCallId)
audit.replay(targetId, targetType)
```

### 5.3 能力边界

- Agent **只能通过 capability registry** 触达数据库、文件、MCP、通知、同步和外部网络，不能绕过注册表直接写底层存储。
- Domain Agent **只能在自己的对象域与授权能力域内行动**，需要跨域时由 Orchestrator 重新分发。
- `session_search` 返回的是**压缩摘要包**，不是无限量原始历史。
- 长期记忆写入必须带**来源对象或来源会话引用**，防止幻觉事实进入记忆层。
- 愿景、directive、发布、删除、授权、安全策略等高敏对象一律不能被自动静默改写。

## 6. 与其他专题的依赖关系

> 以下以能力边界为准；若 11/12/15 的最终标题命名调整，不影响此处依赖语义。

| 依赖专题 | 关系说明 |
|---|---|
| **01 愿景写入与长期记忆** | 14 需要 01 提供可引用但不可被静默改写的 vision / directive 体系；14 的 L3 长期记忆、提醒姿态、用户偏好注入直接建立在 01 之上。 |
| **03 Agent 驱动任务管理** | 14 提供 Planner / Review / Ops 等执行框架；03 定义 Today / Focus / Review、task 生命周期与任务对象语义，是 Orchestrator 最重要的业务落点。 |
| **05 研究工作台** | 05 依赖 14 提供 Research Agent、session search、context compression、外部检索编排与异步产物生成；14 反过来依赖 05 定义研究对象与证据边界。 |
| **08 Journal / Review 时间层** | 14 需要 08 提供 timeline、回顾窗口、时间性事件聚合；Review Agent 的事实压缩与跨天回忆都以 08 的时间容器为入口。 |
| **09 对象图谱 / 统一对象系统** | 14 的上下文装配、Graph Agent、建链、backlinks、跨专题召回都建立在 09 的 `object_index + links + events` 之上；没有 09，就没有“对象化回忆”。 |
| **11 LocalFirst 同步与 GDPR** | 14 的审批、数据出境、跨端 continuation、后台任务状态同步都必须遵守 11 的信任边界、密钥体系与最小出境规则。 |
| **12 关系型对象数据库** | 14 的 `agent_sessions`、`agent_runs`、`agent_tasks`、`capability_calls`、`approval_requests`、`audit_logs` 等结构化状态，需要 12 提供统一关系型承载与对象访问契约。 |
| **13 文件系统优先数据架构** | 14 的 session search、对象检索、证据召回、block grounding 依赖 13 提供 `file_index`、FTS、chunk、vector、`block_provenance` 与 `compile_edges` 等索引底座。 |
| **15 MCP 与开放能力层** | 14 通过 capability registry 挂接 15 暴露的外部连接器、检索器与执行器，但坚持“外部能力负责拿数据/做动作，内部对象化与治理仍归 Orbit”。 |

## 7. 风险、边界与设计决策

1. **不把 Agent 主体建成“超级对话框”**：所有重要结果都必须对象化、任务化、事件化，聊天只是交互层。
2. **不把 Hermes 的 CLI 体验误当产品架构**：借鉴其 loop、registry、memory、delegation、安全原则；不复制 terminal-first 形态。
3. **不让长对话充当唯一真相**：真相在对象、事件、审批、日志、摘要与版本中；聊天历史只是一种来源。
4. **不让跨会话回忆变成隐形操控**：所有长期记忆都要可查看、可追溯来源、可删除、可降级。
5. **不让子 Agent 成为越权黑箱**：子 Agent 必须空上下文启动、能力裁剪、预算独立、输出只回传摘要与产物。
6. **不让学习回路静默改变产品规则**：学习可以提议模板、偏好、路由优化，但不能偷偷改写愿景、审批与安全边界。
7. **关键设计决策：Safety Gate 以“产品动作”为核心，而不是“命令字符串”为核心**。Orbit 需要治理的是对象改写、数据出境、发布、同步与成本，不是 shell 命令本身。
