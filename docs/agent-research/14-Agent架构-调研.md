# 14-Agent架构 调研：基于 Hermes/Claude Code 的深度分析

> **调研范围**：Hermes Agent（Python，767+ .py 文件）与 Claude Code（TypeScript，1884+ .ts/.tsx 文件）的 Agent 架构全景对比，聚焦核心循环、工具系统、上下文管理、多 Agent 编排四大维度对 Orbit Agent 架构的启发。
>
> **对应设计方案**：`docs/orbit-reboot/14-Agent架构.md`

---

## 1. Orbit 设计方案摘要

Orbit 的 Agent 架构定位为"**系统级编排层**"——不是外挂聊天框，而是深度嵌入项目、阅读、研究、写作、Journal 与对象网络的执行基础设施。核心设计判断是：**借鉴 Hermes/Claude Code 的 Agent 运行原则，但不照搬 CLI/gateway 的产品外形。**

架构总体采用"**Orchestrator 中枢 + 领域 Agent 执行 + Capability Registry 管控 + Memory/Search/Safety 共享底座**"结构：

- **Orchestrator** 担任意图路由、上下文装配、Agent 分发、执行模式选择、结果归档和风险兜底六大职责，本身不承担领域知识。
- **七个领域 Agent**（Planner、Reader、Research、Writing、Review、Graph、Ops）各自按产品专题划分，拥有独立的对象域、能力域与越界禁令。
- **Capability Registry** 是以"能力"而非"命令"为单位的注册表，每个 capability 携带 risk_level、approval_policy、execution_mode、scope_limit、cost_profile、data_boundary 等丰富元数据。
- **五层记忆体系**（L0 Turn Scratch → L1 Session → L2 Object → L3 User Long-term → L4 Procedural → L5 Archive/Search）让回忆服务于对象网络而非吞掉对象网络。
- **Session Lineage 与 Compression** 提供六种谱系关系和五级压缩策略，会话不是线性聊天而是可追溯工作谱系。
- **Safety Gate** 在能力执行前做上下文安全扫描、策略校验、审批判定、脱敏出境与审计记录，审批分 A0-A3 四档。
- **异步学习回路** 把学习沉淀后置，产出经候选层过滤的可审计改进。

方案的核心理念是：**一等公民不是聊天消息，而是 Agent Session、Agent Task、对象上下文、能力调用、审批记录、异步任务、压缩摘要与审计日志。**

---

## 2. Hermes 的可借鉴之处（分子维度详述）

### 2.1 核心循环：稳定骨架 + 灵活钩子

Hermes 的主循环 `AIAgent.run_conversation()` 采用经典的 `while count < max_iterations` 有界循环模式，核心代码位于 `run_agent.py:7354`。其设计有三个值得 Orbit 借鉴的子维度：

**（a）迭代预算的线程安全设计**。`IterationBudget` 类实现了线程安全的迭代计数器，支持 `consume()` 和 `refund()` 操作。当子 Agent 执行 `execute_code` 等复合操作时可退还迭代次数，避免预算浪费。这种"可退还的预算"模式对 Orbit 的 Orchestrator 非常有价值——当领域 Agent 的某个 capability 调用被审批拒绝时，应当退还对应的 token 预算和迭代计数。

**（b）十种回调钩子构成的观察者体系**。Hermes 在 `AIAgent.__init__` 中定义了 `tool_progress_callback`、`tool_complete_callback`、`stream_delta_callback`、`thinking_callback`、`step_callback`、`status_callback` 等十种回调。这种钩子驱动的生命周期管理让主循环保持纯净，同时允许 CLI、Gateway、RL 训练等不同入口注入完全不同的副作用处理。Orbit 应借鉴这种"主循环只管编排逻辑，外部行为通过钩子注入"的思路——Orchestrator 的每一步（意图识别、上下文装配、Agent 分发、结果归档）都应提供标准化钩子，让项目页、Reader、Research Space 等不同产品入口注入自己的展示和交互逻辑。

**（c）检查点管理与协作式中断**。每次迭代开始执行 `_checkpoint_mgr.new_turn()`，并通过 `_interrupt_requested` 标志位实现协作式中断。中断时会级联通知 `_active_children` 中的所有子 Agent。Orbit 的 Orchestrator 也需要类似机制——当用户在项目页发起"暂停当前计划生成"时，Orchestrator 必须能中断 Planner Agent 及其可能委派的 Research Agent，并保存断点以便后续恢复。

### 2.2 工具体系：注册表 + 分类 + 安全入口

Hermes 的工具系统以 `ToolRegistry` 单例注册表为核心（`tools/registry.py:48-287`），通过模块导入时的自注册模式发现工具。其可借鉴之处包括：

**（a）分层预算控制**。Hermes 实现了三层工具结果预算系统：`PINNED_THRESHOLDS`（如 `read_file` 不截断）→ `tool_overrides` → `DEFAULT_RESULT_SIZE_CHARS`（100K 字符），加上每轮聚合预算 `MAX_TURN_BUDGET_CHARS`（200K）。超限时结果被持久化到沙箱文件，只返回预览和路径引用。Orbit 应将此模式适配为：能力调用的结果如果超出上下文预算，自动压缩为摘要并将完整结果存入对象层，让后续 Agent 可以按需回溯。

**（b）工具并行安全的白名单机制**。`_PARALLEL_SAFE_TOOLS`（只读工具集）和 `_PATH_SCOPED_TOOLS`（路径域工具需检查路径重叠）的分类方式简洁有效。8 个 worker 的 `ThreadPoolExecutor` 并发执行安全工具。Orbit 的 Capability Registry 可以借鉴此思路，在 capability 元数据中增加 `concurrency_safety` 字段（`safe` / `path_scoped` / `exclusive`），让 Orchestrator 在同一 run 内安全地并发调度多个只读 capability。

**（c）危险命令的正则检测 + 智能审批**。`approval.py` 包含 30+ 条危险模式正则，加上使用辅助 LLM 评估风险的智能审批机制和四级审批选项（once/session/always/deny）。虽然 Orbit 治理的是"产品动作"而非"shell 命令"，但 Hermes 的"审批必须在工具入口生效"原则应完整保留——在 capability registry 的 `invoke()` 入口统一拦截，而不是在各个 Agent 内部分散处理。

### 2.3 记忆与上下文：分层 + 搜索 + 压缩

**（a）SQLite + FTS5 全文搜索的跨会话检索**。Hermes 的 `hermes_state.py` 使用 SQLite WAL 模式存储消息，并通过 FTS5 虚拟表实现跨会话消息搜索。更精妙的是，`session_search_tool.py` 在搜索结果上调用 Gemini Flash 生成智能摘要，而非返回原始文本片段。Orbit 的 L5 Session Archive/Search 层应借鉴此模式：用 FTS5 做初筛，用轻量模型做摘要回传，确保跨会话回忆是经过理解的，而非简单的文本拼接。

**（b）记忆注入的边界包裹**。Hermes 在系统提示词中用 `<memory-context>` 标签包裹记忆内容，并且系统提示词中的记忆使用冻结快照（`_memory_store.format_for_system_prompt()`），不随对话实时变化。这避免了模型误判记忆内容的来源。Orbit 的五层记忆注入都应有明确的 XML 标签边界，并标注每条记忆的来源层级和置信度。

**（c）十级上下文窗口回退探测**。`model_metadata.py` 的 `get_model_context_length()` 实现了从显式配置到持久缓存到 API 探测到注册表查询到默认值的十级回退链。这种"对任何模型都能优雅降级"的思路适用于 Orbit 的多模型支持策略——即使用户配置了非主流模型，系统也应能通过逐级回退确定可用的上下文窗口大小。

**（d）会话谱系与分裂压缩**。压缩后创建新会话（`parent_session_id` 链接旧会话），旧会话标记为 `"compression"` 结束原因。Hermes 还实现了迭代压缩——二次压缩时基于上一次摘要增量更新而非从头生成。Orbit 的 Session Lineage 设计（`continues_from`、`delegated_from`、`compressed_into` 等六种谱系关系）可以在此基础上进一步细化，将"压缩"拆分为 Turn Summary、Session Summary、Workspace Digest 等多级压缩。

### 2.4 多 Agent 编排：隔离 + 预算 + 深度限制

**（a）子 Agent 的严格隔离模型**。`delegate_tool.py` 的 `_build_child_agent()` 为每个子 Agent 创建完全独立的会话历史、受限的工具集和聚焦的系统提示词。`DELEGATE_BLOCKED_TOOLS` 明确禁止子 Agent 使用 `delegate_task`、`memory`、`send_message` 等敏感工具。`MAX_DEPTH = 2` 硬编码最大嵌套深度，`MAX_CONCURRENT_CHILDREN = 3` 限制并发子 Agent 数量。这种"空上下文启动、能力裁剪、预算独立、输出只回传摘要"的原则正是 Orbit 设计方案中明确要继承的。

**（b）MoA（Mixture of Agents）跨模型投票**。Hermes 独有的 `mixture_of_agents_tool.py` 调用多个前沿模型（Claude Opus、Gemini Pro、GPT-5.4 Pro、DeepSeek V3.2）并聚合结果。虽然 Orbit 不需要复制此机制，但其"多模型交叉验证"的思路对 Research Agent 的证据评估有启发——当外部检索返回争议性结论时，可以用多模型投票提高判断置信度。

**（c）MCP Sampling 反向调用**。Hermes 的 MCP 集成实现了完整的 Sampling 支持——MCP 服务器可以反向调用 LLM，带滑动窗口限速（`max_rpm`）和 token 上限（`max_tokens_cap`）。这意味着外部能力可以"借用"宿主 Agent 的推理能力。Orbit 通过 Capability Registry 挂接 MCP 连接器时，应评估是否需要支持 Sampling 协议以实现更智能的外部能力交互。

### 2.5 安全与凭证管理

**（a）凭证清洗**。MCP 错误返回前自动用正则剥离敏感信息（`ghp_*`、`sk-*`、`Bearer` 等）。Orbit 的 Safety Gate 应在所有能力调用的错误输出路径上增加类似的凭证脱敏处理。

**（b）ContextVar 会话隔离**。Hermes 使用 Python 的 `ContextVar` 实现会话级凭证隔离，确保 Gateway 场景下多个并发会话不会泄露彼此的凭证。Orbit 的多 Agent 并发执行也需要类似的隔离机制。

---

## 3. Claude Code 的可借鉴之处（分子维度详述）

### 3.1 核心循环：异步生成器管道 + 流式架构

Claude Code 的核心循环采用 `async generator` 管道模式，数据通过 `yield` 在层级间流式传递。`QueryEngine.submitMessage()` → `query()` → `queryLoop()` → `runTools()` 构成四层编排管道。

**（a）流式事件管道（AsyncGenerator<StreamEvent>）**。与 Hermes 的回调驱动不同，Claude Code 的每一层都 `yield` 事件，构成背压控制的流式管道。消费端通过 `for await (const event of query(params))` 自然处理所有事件类型（`stream_request_start`、工具执行进度、最终消息）。这种模式的优势在于：数据流方向明确、背压自然控制、层间解耦彻底。**Orbit 的 Orchestrator 应采用类似的事件流架构**——从意图识别到 Agent 执行到结果归档，每一步都发出结构化事件，让前端可以实时展示进度，让审计日志可以完整捕获执行轨迹。

**（b）四层编排架构的清晰分工**。SDK 层（`QueryEngine`）处理外部接口和权限管理；生命周期层（`query()`）管理上下文和清理；核心循环层（`queryLoop()`）驱动 LLM 调用和工具执行；工具编排层（`runTools()`）处理并发分区和执行调度。每一层只关注自己的职责，通过 `yield*` 委托下一层。Orbit 可以参考此分层：SDK 层处理来自不同产品入口（项目页、Reader、Research Space）的调用适配；Orchestrator 层负责意图路由和 Agent 分发；Agent 执行层驱动 capability 调用；Capability 层处理具体执行逻辑。

**（c）AbortController 取消机制**。Claude Code 使用原生的 `AbortController` / `AbortSignal` 实现取消传播，比 Hermes 的 `_interrupt_requested` 标志位轮询更优雅和高效。信号可以穿透整个调用链，从 QueryEngine 一直传播到底层工具执行。Orbit 的执行取消应采用类似的信号传播机制，确保"用户在项目页点击取消"能立即级联到正在执行的所有 capability 和子 Agent。

### 3.2 工具系统：声明式行为内省 + 并发调度

**（a）工具的行为特征声明**。Claude Code 的 `Tool<Input, Output, Progress>` 接口要求每个工具声明 `isConcurrencySafe(input)`、`isReadOnly(input)`、`isDestructive(input)` 三个行为特征方法。注意这些方法接受 `input` 参数——同一个 BashTool 对于 `grep` 命令返回 `isReadOnly: true`，对于 `rm` 命令返回 `isReadOnly: false`。这种"输入敏感的行为声明"比 Hermes 的静态白名单更精细。**Orbit 的 Capability Registry 应借鉴此模式**——同一个 `research.search.external` 能力在不同参数（搜索公开数据 vs 搜索付费数据库）下可能有不同的 risk_level 和 approval_policy。

**（b）StreamingToolExecutor 并发队列调度器**。`StreamingToolExecutor` 基于工具的 `isConcurrencySafe` 声明实现了智能并发调度：并发安全的工具（如多个 grep）立即并行执行，有写操作的工具排队串行执行。这比 Hermes 的"事先判断整批工具是否可并行"更灵活——可以在同一批调用中混合并发和串行工具。Orbit 的 Orchestrator 在同一 run 内调度多个 capability 时应采用类似的混合调度策略。

**（c）工具的 fail-closed 默认值**。`buildTool()` 工厂函数的默认值设计遵循"安全第一"原则：`isConcurrencySafe: false`、`isReadOnly: false`。这意味着新工具如果忘记声明行为特征，会被保守地当作有写操作的串行工具处理。Orbit 的 Capability Registry 也应采用 fail-closed 默认——新注册的 capability 默认为 `R3-external-write` + `A2-单次审批`，只有显式声明后才降级。

**（d）MCP Annotations 到行为声明的自动映射**。Claude Code 将 MCP 工具的 `annotations.readOnlyHint` 自动映射为 `isConcurrencySafe` 和 `isReadOnly`，将 `annotations.destructiveHint` 映射为 `isDestructive`。这意味着外部 MCP 工具可以无缝融入内部的并发调度和权限检查体系。Orbit 通过 capability registry 挂接 MCP 连接器时，应实现类似的 annotation 映射，让外部能力自动获得合适的 risk_level 和 approval_policy。

### 3.3 上下文管理：精细分级 + prompt caching + 自动压缩

**（a）四级告警的上下文窗口管理**。Claude Code 实现了 `warning → error → autoCompact → blocking` 四级告警机制。`AUTOCOMPACT_BUFFER_TOKENS = 13,000` 定义了自动压缩触发的缓冲区，`WARNING_THRESHOLD_BUFFER_TOKENS = 20,000` 定义了用户可见告警的缓冲区。这种分级机制让系统在上下文即将溢出时有多次缓冲机会，而非突然崩溃。Orbit 应实现类似的分级机制：在 L1 Session Memory 接近上限时先触发 Turn Summary 微压缩，再触发 Session Summary 宏压缩，最后才进入 Lineage Handoff 重新启动会话。

**（b）混合 Token 计算**。`tokenCountWithEstimation()` 从最后一条有 API usage 数据的消息开始，对之前的部分使用 API 精确值，对之后的部分使用粗估（`chars / 4`），两者混合得出总量。这比 Hermes 的纯粗估（全部 `chars / 4`）更准确，同时避免了每条消息都调用 tokenizer 的性能开销。Orbit 应采用类似的混合策略，特别是在 Orchestrator 需要判断"当前上下文还能容纳多少个 capability 调用结果"时。

**（c）压缩后资源恢复预算**。Claude Code 在压缩后预留 `POST_COMPACT_TOKEN_BUDGET = 50,000` 用于恢复关键文件和技能上下文，每个文件上限 5,000 token，最多恢复 5 个文件。这确保了压缩不会丢失当前任务的关键上下文。Orbit 的 Lineage Handoff 也应设计类似的"恢复预算"——跨会话续接时不仅注入摘要，还应预留预算让 Agent 主动回读最关键的对象状态。

**（d）PTL（Prompt Too Long）重试截断**。当 API 返回 prompt 过长错误时，`truncateHeadForPTLRetry()` 计算精确的 token 差距并丢弃对应的头部轮次，或默认丢弃头部 20%。这是一种优雅的故障恢复机制。Orbit 应在 API 层实现类似的自动降级——如果因为对象上下文注入过多导致 prompt 过长，自动裁剪低优先级的对象上下文而非直接报错。

**（e）五层 CLAUDE.md 配置叠加**。从 Managed（策略设置）→ User 全局 → User Rules → 项目级 → 本地级的五层配置叠加机制，每一层有明确的类型标记（Project、Local、TeamMem、AutoMem、User）。这种多层配置让同一 Agent 在不同项目和不同团队中表现出不同的行为。Orbit 的 L3 User Long-term Memory 和 L4 Procedural Memory 可以借鉴此分层——用户级偏好、项目级规则、团队级策略应该有清晰的优先级和覆盖关系。

### 3.4 多 Agent 编排：LLM 驱动的 Coordinator 模式

**（a）显式的 Coordinator 角色与四阶段工作流**。Claude Code 的 Coordinator Mode 通过约 370 行精心设计的系统提示词定义了 Research → Synthesis → Implementation → Verification 四阶段工作流。Coordinator 不是通过代码逻辑显式调度 Worker，而是通过自然语言提示词定义协调规则，由 LLM 自主决定何时启动 Worker、如何分配任务、何时合成结果。这种"LLM 驱动编排"的模式比 Hermes 的"代码驱动编排"更灵活——Coordinator 可以根据任务语义动态调整并发策略和阶段划分。**Orbit 的 Orchestrator 应采用混合模式**：核心的安全检查、预算管控、审批流程由代码逻辑严格控制，但意图路由和 Agent 分发可以引入 LLM 驱动的语义理解。

**（b）双向 SendMessage 协议与语义寻址**。Claude Code 的 Agent 间通信通过 `SendMessageTool` 实现，支持按名称寻址（`to: "teammate-name"`）、广播（`to: "*"`）、UDS 本地对等连接和 Bridge 远程控制。消息格式支持纯文本和结构化类型（`shutdown_request`、`plan_approval_response` 等）。Worker 完成后通过 XML `<task-notification>` 主动通知 Coordinator，而非 Coordinator 轮询。Orbit 的 Agent 间通信应设计类似的双向消息协议，特别是 Planner Agent 需要与 Research Agent 协作时——Planner 可以向 Research 发送"验证这条假设"的消息，Research 完成后主动回传证据包。

**（c）多态任务类型系统**。Claude Code 的 `TaskState` 派生出 7 种具体任务类型（`local_bash`、`local_agent`、`remote_agent`、`in_process_teammate`、`local_workflow`、`monitor_mcp`、`dream`），每种类型有独立的状态扩展字段。统一的 5 态生命周期（`pending → running → completed/failed/killed`）和完整的 CRUD 工具（`TaskCreate/Get/List/Update/Stop/Output`）让任务管理成为一等公民。Orbit 的 `agent_tasks` 表设计应借鉴此多态模式，为不同类型的任务（前台同步、后台异步、需审批、跨端继续）定义清晰的状态机和扩展字段。

**（d）进程内 Teammate 隔离与 worktree 隔离**。Claude Code 支持 `in-process`、`tmux`、`iTerm2` 三种本地执行后端，以及 `worktree` 文件系统隔离和 `remote` CCR 远程隔离。`InProcessTeammateTaskState` 包含 `awaitingPlanApproval`、`permissionMode`、`pendingUserMessages` 等精细的协作状态。Orbit 的子 Agent 隔离可以参考此分级：轻量级任务使用进程内隔离（共享内存但独立上下文），重量级任务使用独立进程或远程执行。

### 3.5 安全模型：责任链 + ML 分类器

**（a）多层权限检查的责任链**。Claude Code 的工具执行经过 `validateInput()` → `checkPermissions()` → `canUseTool()` → `tool.call()` 四层检查，任一环节拒绝则终止执行。每一层有明确的职责：输入校验、工具级权限、会话级策略、最终执行。Orbit 的 Safety Gate 应采用类似的责任链模式——上下文安全扫描 → 能力策略判断 → 审批判定 → 脱敏出境 → 执行审计，每层独立可配置。

**（b）六级权限模式（plan → full auto）**。Claude Code 定义了从 plan mode（只能读取和搜索）到 full auto（自动执行所有操作）的六级权限渐进。用户可以根据信任程度选择合适的级别。Orbit 可以将此映射为领域 Agent 的权限级别——新注册的 Agent 默认 plan mode（只能建议不能执行），经过验证后逐步提升到更高权限。

---

## 4. 不适用于 Orbit 的设计

### 4.1 Hermes 中不应采纳的设计

**（a）7500 行单体 Agent 类**。Hermes 的 `run_agent.py` 将几乎所有核心逻辑（主循环、API 调用、工具执行、上下文压缩、记忆管理、流式处理、中断处理）集中在一个 `AIAgent` 类中，`__init__` 接受 53 个参数。这种"一个类统治一切"的做法导致模块间耦合极重、测试困难、维护成本高。Orbit 应坚持方案中的分层架构，Orchestrator、Domain Agent、Capability Registry、Memory Layer 各司其职。

**（b）终端命令为中心的审批模型**。Hermes 的 `approval.py` 主要围绕"危险 shell 命令"设计正则规则（`rm -rf`、`chmod 777`、`fork bomb`、`curl | sh` 等），这是 CLI 工具的安全需求。Orbit 需要治理的是"产品动作"——对象改写、数据出境、发布、同步与成本，而非 shell 命令本身。

**（c）MEMORY.md / USER.md 作为长期记忆主载体**。Hermes 的内置记忆存储在纯文本文件中（2,200 / 1,375 字符上限），内容由 Agent 自由写入。这种"Agent 自主决定记住什么"的模式在 Orbit 中不够可控——长期真相应来自对象层与用户确认，而非 Agent 的自由笔记。

**（d）CLI / Gateway 的产品形态**。Hermes 的 14+ 消息平台网关、终端 REPL 交互、`prompt_toolkit` TUI、CLI 子命令系统——这些都是面向"终端/聊天"场景的产品实现，Orbit 作为应用级产品不应照搬。

**（e）同步主循环 + 异步桥接的混合模型**。Hermes 的主循环是同步的 `while` 循环，遇到异步工具时通过 `ThreadPoolExecutor` + `asyncio.run()` 桥接。这种混合模型增加了复杂性并可能导致死锁。Orbit 应从一开始就采用纯异步架构。

### 4.2 Claude Code 中不应采纳的设计

**（a）Anthropic 深度绑定**。Claude Code 专为 Claude 模型优化，利用 prompt caching、extended thinking 等 Anthropic 独家特性，API 调用直接使用原生 Anthropic SDK。Orbit 需要保留多模型灵活性（类似 Hermes 的 10+ 提供商支持），不应将架构锁定在单一模型供应商上。

**（b）React + Ink 终端 UI 引擎**。Claude Code 投入了巨大工程量打造的 Ink 渲染引擎（Yoga 布局 + 虚拟 DOM + Vim 状态机）是为"终端中的 IDE 体验"服务的。Orbit 是应用级产品，有自己的 UI 层（Web/Desktop），不需要终端 UI 引擎。

**（c）纯 LLM 驱动的编排**。Claude Code 的 Coordinator 完全通过 370 行提示词定义行为，由 LLM 自主决定任务分配和并发策略。这种模式的不确定性较高——LLM 可能做出不合理的调度决策，且难以审计和复现。Orbit 的核心流程（安全检查、预算管控、审批）必须由确定性代码控制。

**（d）JSONL 文件作为会话存储**。Claude Code 的对话历史存储在 `.claude/{sessionId}.jsonl` 文件中，100 条历史上限，无跨会话搜索能力。这对于 Orbit 的"跨会话延续同一主题"场景远远不够——Orbit 需要 Hermes 式的结构化数据库存储 + FTS5 全文搜索。

**（e）无批处理和 Cron 调度**。Claude Code 没有独立的批处理系统和定时任务调度器。Orbit 的 Ops Agent 需要支持"定时抓取"、"批量转写"、"定期研究更新"等异步任务场景，需要自建调度能力（可参考 Hermes 的 Cron 系统设计）。

---

## 5. Orbit Agent 架构的推荐方案（融合两者优点）

### 5.1 核心循环：异步事件流管道 + 确定性控制逻辑

**融合策略**：采用 Claude Code 的异步生成器管道架构作为数据流骨架，但在关键控制点（安全检查、预算管控、审批判定）使用确定性代码逻辑而非 LLM 驱动。

```
ProductSurface.trigger()                    // 来自项目页/Reader/Research Space
  → Orchestrator.startSession()             // 创建 session + run
    → IntentRouter.classify()               // 确定性规则 + LLM 辅助
    → ContextAssembler.compile()            // 从对象层拉取上下文包
    → AgentDispatcher.dispatch()            // 选择领域 Agent + 设定预算
      → DomainAgent.execute()               // async generator 管道
        → yield* CapabilityExecutor.run()   // 能力调用 + Safety Gate 拦截
          → yield CapabilityEvent            // 流式事件
      → yield AgentEvent                     // Agent 级事件
    → ResultArchiver.archive()              // 结果写回对象层
    → CompressionEngine.compact()           // 按需压缩
  → yield OrchestratorEvent                  // 最终事件流
```

每一层都是 `AsyncGenerator<TypedEvent>`，支持背压控制、流式展示、完整审计。Hermes 的十种回调钩子被替换为类型化事件（`CapabilityStarted`、`ApprovalRequired`、`TaskCompleted` 等），让不同产品入口可以按需订阅。

### 5.2 工具/能力系统：声明式 Capability Registry

**融合策略**：采用 Claude Code 的强类型声明式工具定义作为能力注册范式，同时保留 Hermes 的动态注册灵活性用于 MCP 外部能力。

```typescript
interface Capability<Input, Output> {
  // 身份
  id: string                              // e.g. "project.plan.generate"
  domain: Domain                          // planning | reading | research | ...

  // 契约
  inputSchema: ZodSchema<Input>
  outputSchema: ZodSchema<Output>

  // 行为声明（输入敏感，借鉴 Claude Code）
  riskLevel(input: Input): RiskLevel      // R0-read | R1-internal-write | R2-external-read | R3-external-write
  approvalPolicy(input: Input): ApprovalPolicy
  concurrencySafety(input: Input): 'safe' | 'path_scoped' | 'exclusive'
  executionMode: 'sync' | 'async' | 'resumable'

  // 治理元数据（借鉴 Orbit 设计方案）
  scopeLimit: 'object' | 'space' | 'project' | 'global'
  costProfile: CostProfile
  dataBoundary: 'local' | 'exportable' | 'sensitive'

  // 执行（async generator，借鉴 Claude Code）
  execute(input: Input, context: ExecutionContext): AsyncGenerator<CapabilityEvent, Output>

  // 失败安全默认值（借鉴 Claude Code 的 fail-closed）
  static DEFAULTS = {
    riskLevel: () => 'R3-external-write',
    approvalPolicy: () => 'required',
    concurrencySafety: () => 'exclusive',
  }
}
```

Registry 过滤逻辑（借鉴 Hermes 的 registry 思路 + Orbit 设计方案的要求）同时考虑：当前入口、用户权限、设备能力、对象作用域、隐私策略、审批状态、模型预算。

### 5.3 上下文与记忆：对象驱动 + 分级压缩

**融合策略**：存储层采用 Hermes 的 SQLite + FTS5 结构化方案（支持跨会话搜索），上下文管理采用 Claude Code 的四级告警和混合 Token 计算，记忆分层采用 Orbit 设计方案的五层体系。

关键设计决策：
- **L0-L1**（Turn/Session）：内存缓冲 + 事件流，类似 Claude Code 的即时处理
- **L2**（Object Memory）：从对象层实时拉取结构化事实，不同于 Hermes 的冻结快照——对象层数据是"活的"
- **L3-L4**（Long-term/Procedural）：SQLite 持久化，带来源对象引用和置信度评分，接受 Hermes 的 FTS5 搜索能力
- **L5**（Archive/Search）：压缩摘要 + 搜索索引，搜索结果经轻量模型摘要后返回（借鉴 Hermes 的 session_search + Gemini Flash 摘要模式）

压缩策略融合两家所长：
1. **微压缩**（零 LLM 成本）：借鉴 Hermes 的工具结果裁剪 + Claude Code 的图片/文档剥离
2. **Turn Summary**：单轮内压缩，保留关键参数与结论
3. **Session Summary**：借鉴 Claude Code 的 9 维分析框架（Request → Next Step），增加"对象影响"和"审批记录"两个 Orbit 特有维度
4. **Lineage Handoff**：压缩后不仅注入摘要，还预留恢复预算（借鉴 Claude Code 的 `POST_COMPACT_TOKEN_BUDGET`）让 Agent 回读关键对象

### 5.4 多 Agent 编排：混合驱动的 Orchestrator

**融合策略**：采用 Claude Code 的 Coordinator 四阶段工作流理念，但核心控制逻辑用确定性代码实现（借鉴 Hermes 的代码驱动编排），只在意图路由和任务细化等需要语义理解的环节引入 LLM 驱动。

```
确定性代码控制：                           LLM 驱动：
├── 安全检查（Safety Gate）              ├── 意图路由（判断是规划/阅读/研究/...）
├── 预算管控（IterationBudget）          ├── 任务细化（拆分子任务和依赖）
├── 审批流程（A0-A3 四档）               ├── 上下文选择（从对象网络中选取相关对象）
├── 能力裁剪（子 Agent 白名单）           └── 结果合成（整合多个 Agent 的输出）
├── 深度限制（MAX_DEPTH）
└── 并发控制（concurrencySafety 声明）
```

Agent 间通信借鉴 Claude Code 的双向 `SendMessage` 协议，但用 Orbit 的对象系统作为消息载体——Agent 之间不是传递纯文本消息，而是传递"对象引用 + 摘要 + 操作请求"。

### 5.5 Safety Gate：产品动作为核心

**融合策略**：责任链架构借鉴 Claude Code（`validateInput → checkPermissions → canUseCapability → execute`），但审批对象从 Hermes 的"shell 命令"和 Claude Code 的"文件操作"转变为 Orbit 的"产品动作"。

```
SafetyGate.check(capabilityCall):
  1. 上下文安全扫描 — 检查外部内容中的注入文本（借鉴 Hermes 的 106 条正则模式）
  2. 能力策略判断 — 当前 capability 是否允许在此入口、此对象范围执行（借鉴 Claude Code 的声明式权限）
  3. 审批判定 — 根据 risk_level 和 approval_policy 决定 A0-A3 哪档
  4. 脱敏出境 — 云模型默认只发摘要（Orbit 特有需求）
  5. 执行审计 — 结构化 trace 记录（借鉴 Claude Code 的 OTel 遥测）
```

---

## 6. 具体建议与行动项

### 行动项 1：设计并实现 Orchestrator 的异步事件流管道

**优先级**：P0  
**依据**：Claude Code 的 `AsyncGenerator` 管道模式是整个架构的骨架，决定了数据流方向、层间解耦方式和外部接口形态。  
**具体步骤**：
- 定义 `OrchestratorEvent`、`AgentEvent`、`CapabilityEvent`、`SafetyEvent` 等核心事件类型
- 实现 Orchestrator → Agent → Capability 的三层 `AsyncGenerator` 管道
- 每个产品入口（项目页、Reader、Research Space）通过事件订阅接入，而非直接耦合 Orchestrator 内部逻辑
- 审计日志系统作为事件流的"旁路订阅者"自动捕获所有执行轨迹

### 行动项 2：构建声明式 Capability Registry 并实现 fail-closed 默认

**优先级**：P0  
**依据**：Capability Registry 是 Orchestrator、Safety Gate、Agent 三方的交汇点，是整个架构的"合同层"。  
**具体步骤**：
- 定义 Capability 接口，包含输入敏感的行为声明方法（`riskLevel(input)`、`approvalPolicy(input)`、`concurrencySafety(input)`）
- 实现 fail-closed 默认值（新能力默认为 R3 + 需审批 + 独占执行）
- 设计 MCP 外部能力的自动 annotation 映射（`readOnlyHint` → `R0-read`，`destructiveHint` → `R3-external-write`）
- Registry 过滤逻辑同时考虑入口、权限、设备、作用域、隐私策略、审批状态、预算七个维度

### 行动项 3：实现五层记忆体系的 L2 Object Memory 与 L5 Archive/Search

**优先级**：P1  
**依据**：L2 是 Orbit 区别于 Hermes/Claude Code 的核心差异点（"对象化回忆"），L5 是跨会话延续的基础设施。  
**具体步骤**：
- L2 Object Memory：设计从 `object_index + links + events` 实时拉取结构化事实的接口，定义每个对象类型的"关键事实提取规则"
- L5 Archive/Search：基于 SQLite FTS5 实现跨会话搜索，搜索结果经轻量模型（如 Gemini Flash 或同等能力的快速模型）摘要后返回
- 记忆注入使用 XML 标签包裹并标注来源层级：`<memory layer="L2" source="project:xxx" confidence="0.9">`

### 行动项 4：设计 Agent 间双向通信协议

**优先级**：P1  
**依据**：Orbit 的七个领域 Agent 之间存在丰富的协作需求（Planner ↔ Research、Reader ↔ Research、Review ↔ Graph），需要比 Hermes 的单向返回值更丰富的通信机制。  
**具体步骤**：
- 定义 `AgentMessage` 协议，支持对象引用传递（而非纯文本），消息类型包括 `task_request`、`evidence_pack`、`approval_response`、`status_notification`
- 实现语义寻址（按 Agent 名称）和广播（通知所有相关 Agent），路由通过 Orchestrator 中转
- Worker Agent 完成后主动通知 Orchestrator（借鉴 Claude Code 的 `<task-notification>` XML 格式），Orchestrator 不轮询

### 行动项 5：实现 Session Lineage 与分级压缩引擎

**优先级**：P1  
**依据**：方案中定义的六种谱系关系和五级压缩策略是"让会话成为连续工作而非重新聊天"的核心保障。  
**具体步骤**：
- 实现 `continues_from`、`delegated_from`、`spawned_by_object`、`blocked_by_approval`、`resumed_from_job`、`compressed_into` 六种谱系关系的数据模型和查询接口
- 压缩引擎分三级：微压缩（工具结果裁剪 + 媒体剥离，零 LLM 成本）→ 宏压缩（LLM 生成结构化摘要，11 维分析框架）→ Lineage Handoff（创建新会话 + 恢复预算）
- 压缩后预留 50K token 恢复预算，用于回读关键对象和未决任务

### 行动项 6：构建 Safety Gate 责任链

**优先级**：P0  
**依据**：Safety Gate 是 Orbit 方案中"比 Orchestrator 更靠近执行"的关键安全层，所有外部写入、付费调用、隐私出境都必须通过。  
**具体步骤**：
- 实现五层责任链：上下文安全扫描 → 能力策略判断 → 审批判定 → 脱敏出境 → 执行审计
- 审批对象是"产品动作"而非"命令字符串"：对象改写、数据出境、发布、同步、成本消耗
- A0-A3 四档审批策略可按 capability、对象类型、用户权限三个维度配置
- 审批请求可暂停 run，批准后从原谱系恢复（需要与 Session Lineage 集成）

### 行动项 7：设计异步任务中心与调度能力

**优先级**：P2  
**依据**：Orbit 的 Ops Agent 需要支持后台执行（抓取、转写、翻译、检索、报告生成），且方案明确要求"长任务不阻塞前台会话"。  
**具体步骤**：
- 设计统一的 `async_job` 模型，支持队列、重试、取消、恢复、跨端同步
- 借鉴 Hermes 的批处理 checkpoint 机制实现故障恢复和断点续传
- 任务状态与 Orchestrator 事件流集成——后台任务完成时发出事件，原工作台收到通知并回写结果到对应对象
- 长期可考虑借鉴 Hermes 的 Cron 调度系统支持定时研究更新、定期回顾生成等场景

### 行动项 8：建立 Agent 迭代预算与可退还预算机制

**优先级**：P2  
**依据**：Hermes 的 `IterationBudget`（可退还迭代次数）和 Claude Code 的 `BudgetTracker`（Token 预算追踪）分别解决了不同粒度的预算管控需求。  
**具体步骤**：
- 为每个 `agent_run` 设定 Token 预算和迭代上限，Orchestrator 和子 Agent 各自独立计算
- 实现可退还预算——当 capability 调用被审批拒绝或因外部原因失败时，退还对应消耗
- 预算接近耗尽时触发四级告警（借鉴 Claude Code 的 warning → error → autoCompact → blocking）
- 在 Orchestrator 决定是否委派子 Agent 时，计入"委派开销"——创建子 Agent 的系统提示词、上下文注入和结果回传都消耗预算

---

## 7. 总结

本调研从 Hermes Agent 和 Claude Code 两个方向深入分析了 Agent 架构的核心设计决策，为 Orbit 的方案 14 提供了全面的技术参考。

**核心发现**：

1. **数据流架构上选 Claude Code**。异步生成器管道模式（`AsyncGenerator`）在数据流方向明确性、背压控制、层间解耦三个方面显著优于 Hermes 的回调驱动模式。Orbit 应以此作为 Orchestrator 的核心骨架。

2. **工具治理上融合两者**。Claude Code 的声明式行为内省（输入敏感的 `isConcurrencySafe`、`isReadOnly`、`isDestructive`）+ fail-closed 默认值是更优的工具定义范式；Hermes 的三层预算系统和凭证清洗是更务实的运行时保护。Orbit 的 Capability Registry 应同时具备两者优点。

3. **记忆系统上 Orbit 必须走自己的路**。Hermes 的 MEMORY.md 太自由，Claude Code 的 JSONL 太轻量，Orbit 的核心差异化在于"对象化回忆"——记忆的真相来源是结构化的对象层和用户确认，而非 Agent 的自由笔记或线性聊天历史。

4. **多 Agent 编排上采用混合驱动**。Claude Code 的 LLM 驱动 Coordinator 灵活但不确定，Hermes 的代码驱动编排确定但死板。Orbit 应在安全/预算/审批等硬约束上用代码控制，在意图理解/任务分配/结果合成等需要语义推理的环节用 LLM 驱动。

5. **安全模型上以产品动作为核心重构**。Hermes 围绕 shell 命令、Claude Code 围绕文件操作的安全模型都不适合 Orbit。Orbit 的 Safety Gate 应以"对象改写、数据出境、发布、同步、成本"为核心审批对象，用责任链架构实现五层安全检查。

**最终判断**：Orbit 的 Agent 架构不应简单复制 Hermes 或 Claude Code 的任何一个，而应在深入理解两者设计权衡的基础上，构建一个**以对象网络为中心、以事件流为骨架、以声明式能力治理为抓手、以混合驱动编排为策略、以可审计安全为底线**的产品级 Agent 系统。这个系统的核心价值不在于"Agent 能和用户聊什么"，而在于"Agent 能在产品中做什么、做了什么可追溯、做错了可回滚"。
