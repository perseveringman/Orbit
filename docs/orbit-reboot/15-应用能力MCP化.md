# 应用能力 MCP 化

## 1. 设计定位

Orbit 的 MCP 化不是“再接一个协议层”，而是把应用内所有可执行能力先收敛为统一的 `Capability Interface`，再决定这些能力如何被 UI、应用内 Agent、CLI、自动化规则、外部 Agent 和外部系统消费。换言之，**MCP 只是能力分发协议，Capability 才是 Orbit 的真实边界**。

因此本专题的核心设计目标有三点：

1. **统一能力面**：任何域能力——阅读、研究、写作、项目、对象查询、导出、发布——都必须先注册为带元数据、权限、审计策略的 capability，而不是散落在页面逻辑、IPC handler、脚本或数据库操作里。
2. **统一执行面**：应用内 Agent 与外部 Agent 调用的是同一组能力定义，只是运行通道、权限范围、确认要求与可见数据面不同。
3. **统一治理面**：鉴权、授权、用户确认、审计、敏感隔离、数据出境控制都收口在 capability runtime，而不是靠 prompt 自觉。

Orbit 在这个体系里同时扮演三个角色：

- **Capability Registry**：系统唯一的能力登记与策略中心。
- **Local MCP Server**：把被允许外露的能力按 MCP `resource / tool / prompt` 形式暴露给内部或外部 Agent。
- **External MCP Client**：接入 GitHub、搜索、发布、日历等外部 MCP server，并把其能力纳入 Orbit 的统一编排与审计体系。

最终目标不是“让 Agent 能碰到 Orbit 数据”，而是让 Agent 只能通过 Orbit 明确定义、可解释、可撤销、可审计的接口与 Orbit 协作。

## 2. 关键用户场景

### 场景 A：应用内 Research Agent 调 Orbit 内部能力完成研究闭环

Research Agent 需要读取项目上下文、检索已采纳来源、补充候选外部资料、生成研究产物、提出后续任务。它看到的不是数据库表，也不是随意开放的 ORM，而是：`project.summary.get`、`research.source_bundle.get`、`research.source_candidate.import`、`artifact.create_draft`、`task.propose_from_research` 这类 capability。这样 Agent 能组合工作，但不能绕过对象层直接改数据。

### 场景 B：外部 Agent 通过 MCP 读取 Orbit 受控上下文

Claude Code、Cursor Agent 或用户自建 Agent 希望读取“当前项目简报”“某研究空间证据包”“某篇稿件可引用材料”。Orbit 对外暴露的是只读 resource，如 `orbit://projects/{id}/summary`、`orbit://research-spaces/{id}/evidence-bundle`，返回最小必要的视图对象与稳定引用，不返回数据库 schema、内部 joins、私有缓存字段或未授权对象。

### 场景 C：外部 Agent 请求执行受控写操作

外部 Agent 想把一份研究总结写回 Orbit。它不能直接 `INSERT note`，只能调用 `note.create_from_external` 或 `research.artifact.import_draft` 这类工具。调用时必须声明目标容器、来源、预期副作用、是否会触发对外发送；Runtime 先做 scope 校验，再按策略决定静默执行、生成确认卡片，或进入敏感能力隔离流程。

### 场景 D：Orbit 自身调用外部 MCP server 完成外部动作

Orbit 作为 MCP client 接入 GitHub、搜索、云文档或发布平台。应用内 Agent 并不直接持有这些 server 的原始凭证，而是通过 Orbit Registry 调用“外部 capability 代理”。外部返回先进入 Orbit 的候选层、草稿层或动作预览层，经过用户确认和内部对象化之后，才进入长期知识或外部发布。

## 3. 核心设计

### 3.1 统一 Capability Interface

每个 capability 必须有稳定声明，至少包含以下字段：

| 字段 | 作用 |
|---|---|
| `id` / `version` | 稳定标识与演进控制 |
| `domain` | 所属能力域 |
| `kind` | `query` / `command` / `mutation` / `integration` |
| `exposure` | `internal-only` / `internal+mcp` / `mcp-readonly` / `brokered-external` |
| `inputSchema` / `outputSchema` | 强类型入参与出参 |
| `scopeRequirements` | 所需权限范围 |
| `dataAccessClass` | 访问的数据敏感级别 |
| `confirmationPolicy` | 是否需要用户确认 |
| `auditPolicy` | 需要记录的审计粒度 |
| `egressPolicy` | 是否允许向外部模型或外部服务出境 |
| `idempotency` | 是否可重放 |
| `rateLimit` / `budgetClass` | 资源与成本控制 |
| `handler` | 真正执行逻辑，仅调用应用服务层 |

设计决策是：**先定义能力契约，再定义 UI/IPC/MCP 适配器**。Renderer、CLI、内部 Agent、外部 Agent 都不能跳过这个契约层直接碰业务对象。

### 3.2 Capability 分域

Orbit 的 capability 不按“页面”分，而按“数据边界 + 副作用边界 + 安全边界”分域：

1. **Workspace Query 域**：项目摘要、对象详情、关系图谱、时间线、统计视图。默认只读，可资源化。
2. **Content Capture 域**：导入文章、保存网页、转写、转译、附件摄取。涉及新对象创建，通常需要写权限。
3. **Research 域**：资料池编排、候选来源导入、证据包生成、研究产物落稿。
4. **Writing 域**：稿件草拟、引用插入、结构重组、导出预览。
5. **Planning 域**：项目、任务、里程碑、回顾、日程协同。
6. **Graph / Memory 域**：对象检索、回链、视图投影、记忆摘要；只暴露投影与查询，不暴露底层索引表。
7. **Integration 域**：GitHub、搜索、发布、日历、云盘等外部连接。
8. **Sensitive Ops 域**：删除、批量覆盖、外部发布、密钥访问、批量导出、跨工作区复制。默认不对外直出。

分域的目的不是分类好看，而是让 Registry 能按域做：工具集裁剪、审批策略、默认 scope、审计模板、对外可见性控制。

### 3.3 Orbit 同时扮演 Registry / Local MCP Server / External MCP Client

#### 3.3.1 Orbit 作为 Capability Registry

Registry 是唯一真相层，负责：

- 注册内部 capability 定义；
- 维护 capability 与 domain / scope / audit / confirm policy 的绑定；
- 生成给内部 Agent 的 toolset；
- 决定哪些 capability 可映射为 MCP resource、tool、prompt；
- 为外部 MCP server 建立“代理 capability”；
- 记录 capability 版本与弃用策略。

内部服务不直接“暴露接口”，而是把服务逻辑挂到 capability handler。这样 Orbit 才能保证内部 Agent、外部 Agent 与 UI 看到的是同一套边界。

#### 3.3.2 Orbit 作为 Local MCP Server

Local MCP Server 是 Registry 的投影视图，不是第二套能力实现。它只负责把允许外露的 capability 适配到 MCP：

- **Resource**：稳定、只读、可缓存的上下文投影；
- **Tool**：有动作语义、可能有副作用的能力；
- **Prompt**：受控的任务模板与最佳实践入口。

Server 不能直接把数据库表、ORM 实体、内部 DTO 暴露成 resource；所有资源都必须来自 capability projection。

#### 3.3.3 Orbit 作为 External MCP Client

Orbit 接入外部 MCP server 时，也不让 Agent 直接“穿透”到外部服务，而是走外部代理层：

- Registry 为外部 server 上的每个允许能力创建 `external capability record`；
- 为其补充本地 metadata：信任等级、允许工作区、允许项目、所需确认、成本限制、数据出境类别；
- 内部 Agent 调用时，只能通过 Orbit 的 `integration.*` capability；
- 外部返回结果先进入 Orbit 的候选层 / 草稿层 / 动作预览层，再由本地能力决定是否对象化、是否写入、是否二次外发。

这样 Orbit 不是“插件市场外壳”，而是一个带治理能力的本地控制面。

### 3.4 MCP 暴露策略：Resource / Tool / Prompt 三分法

#### A. Resource：只暴露视图，不暴露真相层

适合暴露为 resource 的只有：摘要、快照、证据包、引用包、对象关系投影、时间线片段、只读统计。资源设计原则：

- 永远只读；
- 永远按 workspace / project / object scope 裁剪；
- 返回 `ObjectRef / SnapshotRef / CitationRef / Cursor` 等稳定外部契约；
- 默认脱敏，不返回内部状态机、权限字段、数据库主键、调试字段；
- 允许分页、分片、TTL 与版本号。

#### B. Tool：只暴露意图化命令，不暴露通用 CRUD

Orbit 不对外开放 `create_object(type, payload)`、`run_sql(query)`、`update_link(table, id)` 这类万能接口。Tool 必须是**意图明确、边界清晰**的命令，如：

- `research.import_candidate_source`
- `writing.create_draft_from_brief`
- `task.propose_followups`
- `note.save_meeting_summary`

这样既保证产品语义，也避免外部 Agent 学会依赖内部对象模型。

#### C. Prompt：暴露配方，不暴露系统主提示词

Prompt 只用于暴露任务配方与推荐调用顺序，例如“如何围绕某研究空间生成决策 memo”“如何读取项目简报后提议任务”。它们是 capability-aware 的 recipe，不是 Orbit 内部 system prompt、策略规则或安全指令的原文外泄。Prompt 可引用 resource / tool，但不能提升权限。

### 3.5 应用内 Agent 与外部 Agent 的共享接口

共享的不是“完全相同的数据面”，而是**相同的能力定义 + 不同的投影视图**：

- **同一能力 ID**：例如 `research.source_bundle.get` 同时服务应用内 Agent 与 MCP resource。
- **不同上下文注入**：内部 Agent 可收到更多本地 session context，外部 Agent 只收到经 scope 裁剪的投影。
- **相同策略执行器**：权限校验、确认、审计、出境控制走同一个 Runtime。
- **相同结果契约**：都返回能力定义声明的输出 schema，而不是各自私有格式。

这意味着外部 Agent 不是“二等公民”，但也绝不是“超级管理员”。它与应用内 Agent 共享能力语义，不共享内部豁免权。

## 4. Agent 行为与自动化机制

### 4.1 调用链统一经过 Capability Runtime

无论调用来自 UI 按钮、快捷指令、内部 Agent、自动化规则还是外部 MCP client，请求都进入同一个 Runtime：

`Actor -> Capability Runtime -> Policy Engine -> Approval Engine -> Handler -> Audit Sink`

其中：

- **Actor**：用户、应用内 Agent、外部 Agent、后台任务；
- **Policy Engine**：校验 scope、工作区、项目、数据等级、出境限制；
- **Approval Engine**：根据副作用与敏感等级决定是否挂起确认；
- **Handler**：只调应用服务层，不直连数据库；
- **Audit Sink**：记录请求、决策、执行结果、外发摘要。

### 4.2 用户确认模型

确认不是单一弹窗，而是分级机制：

1. **静默通过**：纯只读、低风险、无出境。
2. **会话内一次授权**：同一 session 内反复执行的低风险写操作。
3. **每次确认**：创建、覆盖、批量变更、外部写入。
4. **双阶段确认**：删除、发布、批量导出、调用敏感外部系统、涉及支付或密钥操作。

确认卡必须展示：

- 调用者是谁；
- 将访问哪些对象 / 范围；
- 是否会向外部模型或外部服务发送数据；
- 将产生哪些副作用；
- 是否可撤销 / 如何回滚。

### 4.3 敏感能力隔离

敏感能力不应与普通 capability 共处同一执行平面。建议拆成三层：

- **Open Lane**：只读查询、摘要、投影生成；
- **Guarded Lane**：普通写操作，经过 scope + confirm；
- **Vault Lane**：密钥读取、发布、删除、批量导出、工作区级管理，只允许本地 broker 代执行。

外部 Agent 永远不能直接拿到 Vault Lane capability；即使能发起请求，也只能生成待审批 ticket，由本地用户或本地 Agent broker 接手完成。

### 4.4 外部能力消费的安全回流

Orbit 作为 MCP client 从外部拿回的数据，必须先回到本地对象化前置层：

- 搜索结果 -> `candidate_source`
- GitHub issue 建议 -> `action_proposal`
- 发布结果 -> `publish_receipt`
- 云文档内容 -> `import_draft`

外部返回不是长期真相；只有经过本地能力确认与对象化，才进入知识网络、写作稿件或任务系统。

## 5. 数据模型 / 接口 / 能力边界

### 5.1 外部可见契约对象

为了避免数据库与内部对象模型裸露，对外只允许出现稳定契约对象：

| 契约对象 | 含义 |
|---|---|
| `ObjectRef` | 外部可引用对象标识，不等于数据库主键 |
| `CapabilityRef` | capability 唯一标识与版本 |
| `SnapshotRef` | 某次资源视图快照 |
| `CitationRef` | 可追溯引用锚点 |
| `DraftRef` | 草稿或候选产物引用 |
| `ApprovalTicket` | 待确认操作 |
| `AuditReceipt` | 审计回执 |
| `EgressReceipt` | 数据出境记录 |

外部看到的是这些契约对象及其 schema，不是 `articles`、`links`、`object_index`、`events` 等内部实现表。

### 5.2 权限模型

权限模型由四层组成：

1. **Actor Identity**：用户本人、应用内 Agent persona、外部 Agent client、后台任务。
2. **Grant**：谁在什么上下文下被授予什么能力；支持 workspace / project / object 三级作用域。
3. **Scope**：采用 `domain.verb.resource` 风格，例如 `research.read.bundle`、`writing.write.draft`、`integration.invoke.github`。
4. **Constraint**：时间窗口、单次预算、最大结果数、允许出境的目标供应商、是否必须人工确认。

关键设计决策：

- 权限授予默认最小化，外部 Agent 默认无写权限；
- `object-scope grant` 优先于全局 grant，避免“读一个项目”变成“读全库”；
- scope 不直接映射数据库 CRUD，而映射产品语义动作；
- 所有授权都可撤销、可过期、可审计。

### 5.3 审计模型

审计不是只记“调用过什么工具”，而是记完整决策链。至少要记录：

- `capability_invoked`
- `policy_evaluated`
- `approval_requested`
- `approval_granted / denied`
- `execution_succeeded / failed`
- `objects_read / objects_written`
- `egress_performed`
- `external_server_called`
- `rollback_requested / completed`

同时遵守隐私最小化：

- 默认只记录对象引用、字段类别、摘要，不复制完整正文；
- 涉及模型调用时记录发送范围与目标供应商，不在审计日志里重复存敏感原文；
- 用户可查看、导出、删除自己相关的审计记录；
- 开发 / 诊断环境不能默认接触真实用户内容。

### 5.4 如何避免把数据库和内部对象模型裸露给外部 Agent

这是本专题的硬边界，设计上必须同时做到五件事：

1. **不暴露通用数据库接口**：禁止 SQL、禁止 ORM 查询 DSL、禁止“任意对象 CRUD”。
2. **不暴露内部 schema 名称**：对外只给产品语义对象与 capability 契约，不给内部表结构。
3. **不暴露写时耦合关系**：外部 Agent 不负责维护 `links / events / object_index`，只提交意图化命令，由 Orbit 内部完成投影更新。
4. **只暴露物化投影**：resource 基于 projection / snapshot / bundle，而不是实时拼装内部对象树。
5. **区分 candidate 与 committed**：任何外部输入先到候选层或草稿层，不能直接成为 committed object。

因此 Orbit 对外呈现的是一个“产品 API 面”，不是一个“内部数据结构面”。这也是长期可演进的前提：内部对象模型可以持续重构，但 capability 契约保持稳定。

## 6. 与其他专题的依赖关系

| 依赖专题 | 关系说明 |
|---|---|
| **04（全源阅读与转译转写）** | 04 提供文章、转写、转译、锚点与内容片段等高价值输入对象；15 负责把这些输入相关能力封装成 `resource/tool`，并定义哪些可对内外 Agent 只读开放、哪些只能以受控写命令消费。 |
| **05（研究工作台）** | 05 依赖 15 提供候选来源导入、证据包资源、外部检索代理、研究产物导入等能力边界；15 同时接受 05 对“候选层先于正式入库”的硬约束。 |
| **07（写作工作台）** | 07 需要通过 15 暴露草稿生成、引用包读取、导出预览、发布前确认等能力；15 保证外部 Agent 可协助写作，但不能越过写作对象模型直接改正文与引用关系。 |
| **09（对象图谱 / 全局对象系统）** | 09 是 capability projection 的底层前提：所有对外可见 resource 都来自对象化后的稳定投影，而不是表级拼接；同时 15 规定外部写操作不得直接维护图谱关系，必须回到 09 的对象化管线。 |
| **11（身份、密钥、隐私与同步信任层）** | 15 的鉴权、scope、密钥托管、数据出境控制、审计保留期与设备信任都依赖 11 提供底座；没有 11，MCP 只能是功能演示，不能成为可上线的产品能力。 |
| **14（Agent 编排层）** | 14 负责 Orchestrator、Tool Registry、子 Agent 隔离、上下文压缩与安全网关；15 在其之上把“工具集合”提升为“产品级 capability contract + MCP 暴露层 + 外部代理层”。两者关系是 14 负责执行框架，15 负责能力边界与开放协议。 |

## 7. 风险、边界与设计决策

1. **MCP 不是开放数据库协议**：明确拒绝“为了方便 Agent 而开放通用 CRUD / SQL / 任意对象更新”。
2. **共享接口不等于共享权限**：内部 Agent 与外部 Agent 共用 capability 定义，但权限、上下文和数据面必须分层。
3. **Prompt 不能成为越权后门**：任何 prompt 模板都不能隐式授予额外 scope，也不能绕过确认与审计。
4. **外部能力必须 broker 化**：Orbit 作为 MCP client 时，外部 server 只是能力来源，不是信任终点；所有结果必须回流本地治理层。
5. **敏感能力必须隔离执行**：删除、发布、批量导出、密钥访问不直接暴露给外部 Agent，是产品级安全底线。
6. **审计不能变成对用户的全面监控**：记录的是 capability 调用事实与数据出境回执，不是把用户人生和内容全文复制进审计库。
7. **稳定契约优先于内部实现稳定**：未来 Orbit 的对象模型、表结构、缓存与同步方式都可以演进，但对外 capability 契约应保持稳定、可版本化、可弃用迁移。

最终设计决策是：**Orbit 的开放性建立在“统一 capability contract + 最小权限 + 审批前置 + 审计闭环 + 候选层隔离”之上，而不是建立在“把内部数据和工具尽量暴露给 Agent”之上。**
