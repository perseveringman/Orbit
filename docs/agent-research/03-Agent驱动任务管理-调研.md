# 03-Agent 驱动任务管理：Hermes / Claude Code 调研报告

> **调研目标**：从 Hermes Agent 与 Claude Code 的架构实践中，提炼对 Orbit「Agent 驱动任务管理」设计方案（03）的启发与借鉴，明确适用与不适用的边界，给出可落地的具体建议。

---

## 1. Orbit 设计方案摘要

Orbit 03 方案的核心理念是**让 Agent 代替用户维护任务系统本身**。用户只需完成四件事：表达意图、确认关键决策、进入专注、做结果判断；而澄清、拆分、排程、追踪、回顾、再组织则默认由 Agent 持续完成。

### 规划域对象与三件套模型

方案定义了七类规划域核心对象——Vision（愿景）、Directive（行为规则）、Project（项目）、Milestone（里程碑）、Task（任务）、Review（回顾）、Resource/Support Link（支撑材料关系），并在逻辑层坚持"对象 + 关系 + 事件"的最小不可约模型，在物理层接入全局对象系统（类型化表 + `object_index` + `links` + `events`）。

### Today / Focus / Review 执行链

- **Today** 是 Agent 动态生成的每日承诺集合，而非用户手工清单；
- **Focus** 是当前唯一执行对象，Agent 自动加载上下文、关联材料与输出去向；
- **Review** 是事实压缩为决策的回顾层（日/周/项目三级），必须产出可执行建议。

三者构成同一条执行链，通过事件驱动串联，而非三个孤立页面。

### 多 Agent 分工

方案设计了三个 Agent 角色：Planner Agent（澄清、拆分、排程、重排、下一步计算）、Focus Agent（上下文压缩、材料加载、打断管理、完成判定辅助）、Review Agent（事实压缩、回顾生成、建议输出）。三者共享同一事实层，长期稳定背景只来自 Vision、Directive 和用户确认过的规则。

### 闭环与联动

任务系统不是孤岛，而是"愿景→项目→行动→输出→回顾→再决策"的执行中枢，必须与阅读、研究、写作、Journal 等知识对象形成双向流动。

---

## 2. Hermes 可借鉴之处

### 2.1 工具注册表与 Toolset 分发机制

Hermes 采用全局单例 `ToolRegistry`，每个工具通过 `registry.register()` 声明名称、所属 toolset、schema、handler、可用性检查函数等元数据。工具按 toolset 分组（web、terminal、file、browser、vision 等），并支持白名单/黑名单模式的动态启用。更独特的是其**概率采样分布系统**（`toolset_distributions.py`），为不同场景（research、terminal_tasks、browser_tasks 等）预定义各 toolset 的命中概率，用于 RL 训练数据多样化。

**对 Orbit 的启发**：Orbit 的 Planner / Focus / Review 三个 Agent 角色可以借鉴 toolset 分组思想——为每个角色预定义不同的能力集合（Planner 拥有 `task.clarify`、`task.decompose`、`task.schedule` 等能力，Focus Agent 拥有 `task.start_focus`、`task.link_support` 等能力），实现"角色即能力边界"。toolset 的动态启用/禁用机制也适合 Orbit 根据用户当前状态（规划态、执行态、回顾态）动态调整 Agent 可用能力。

### 2.2 批处理运行器与 Cron 调度系统

Hermes 拥有完善的 `batch_runner.py`（1287 行），支持 JSONL 格式定义 prompt 列表、multiprocessing 多进程并行、checkpoint 断点续传、工具调用统计与推理覆盖率追踪。此外，其 Cron 调度系统支持 once / interval / cron 三种模式，由 Gateway 每 60 秒 tick 一次调度器，输出保存到文件系统。

**对 Orbit 的启发**：Orbit 的 Review Agent 需要在固定节点（日末、周末、项目完成时）自动触发回顾生成。Hermes 的 Cron 调度模式直接可用——日回顾对应 interval 或 cron 调度，周回顾和项目复盘对应事件触发。batch_runner 的 checkpoint 机制也值得借鉴：当 Agent 对大量输入材料（高亮、笔记、研究产物）做自动分类和关联时，需要支持中断恢复，避免重复计算。

### 2.3 精细的工具级并行安全检测

Hermes 在 `run_agent.py` 中实现了精细的并行安全策略：将工具分为 `_PARALLEL_SAFE_TOOLS`（可安全并行）、`_PATH_SCOPED_TOOLS`（需检测路径重叠）和 `_NEVER_PARALLEL_TOOLS`（绝不并行），最多 8 线程并行。路径作用域工具会检测操作路径是否重叠，只有无冲突时才允许并发。

**对 Orbit 的启发**：Orbit 的自动化规则中涉及大量并行操作——自动链接（为高亮、研究产物建立 support links）、自动分类（判断新输入应关联到哪个项目）、自动排程（重算 Today 列表）。这些操作中，读操作（查询对象、关系、事件）可安全并行，写操作（创建 link、修改任务状态）需要冲突检测。Hermes 的路径作用域思想可以推广为 Orbit 的"对象作用域"——操作不同对象的写入可以并行，操作同一对象的写入必须串行。

### 2.4 Delegate Tool 的深度限制与工具集隔离

Hermes 的 `delegate_tool.py` 为子 Agent 设置了明确的边界：最大嵌套深度 2 层、最大并发 3 个子 Agent、受限的工具集（默认仅 terminal / file / web）、独立的会话历史和系统提示词。关键是 `DELEGATE_BLOCKED_TOOLS` 阻止了子 Agent 再次委托、访问记忆或发送消息，防止递归失控。

**对 Orbit 的启发**：Orbit 的 Planner Agent 在拆分复合项目时可能需要"子 Agent"——例如，把"研究+写作"项目拆分为研究阶段和写作阶段时，可以委托专门的研究理解子 Agent 去分析已有材料，委托写作结构子 Agent 去建议大纲。Hermes 的深度限制和工具集隔离确保了这种委托不会失控。Orbit 应参考此设计为子 Agent 设置明确的能力边界和最大迭代次数。

### 2.5 多平台网关与统一消息抽象

Hermes 的 Gateway 系统支持 14 个平台（Discord、Telegram、Slack、WhatsApp、飞书、钉钉、Email、SMS 等），通过 `MessageEvent` 统一抽象不同平台的消息格式。

**对 Orbit 的启发**：虽然 Orbit 当前不需要 14 个平台，但"统一消息抽象"的理念值得借鉴——用户的任务意图可能来自多种渠道（App 内输入、语音、邮件转发、微信/飞书消息），Orbit 应在 `task.capture` 能力层定义统一的输入抽象，使任务捕获不绑定特定前端。

### 2.6 MCP 集成中的 Sampling 反向调用

Hermes 的 MCP 实现支持 Sampling——MCP 服务器可以反向调用 LLM，配有滑动窗口限速、模型白名单和工具轮次上限。这意味着外部工具不仅是被动执行者，还能主动请求 AI 推理。

**对 Orbit 的启发**：Orbit 未来接入外部知识服务（搜索引擎、论文数据库、RSS 聚合器）时，Sampling 模式允许这些服务在执行过程中请求 Orbit 的 Agent 做判断（例如"这篇论文是否与用户当前研究相关？"），形成更智能的双向交互。

---

## 3. Claude Code 可借鉴之处

### 3.1 多态任务类型系统与完整 CRUD

Claude Code 定义了 7 种具体任务类型（LocalShellTaskState、LocalAgentTaskState、RemoteAgentTaskState、InProcessTeammateTaskState 等），所有任务共享统一的 `TaskStateBase`（id、type、status、description、startTime、endTime、outputFile 等），并通过 TypeScript 联合类型保证类型安全。任务生命周期统一为 5 态（pending → running → completed / failed / killed）。更关键的是，Claude Code 提供了完整的任务 CRUD 工具（TaskCreate、TaskGet、TaskList、TaskUpdate、TaskStop、TaskOutput），使任务管理本身成为 Agent 可操作的一等工具。

**对 Orbit 的启发**：Orbit 03 方案定义了 7 阶段的任务生命周期（Captured → Clarifying → Ready → Scheduled → Focused → Done/Blocked/Dropped → Reviewed），但尚未明确如何让 Agent "程序化地" 操作任务。Claude Code 的做法——把任务 CRUD 作为 Tool 暴露给 Agent——直接对应 Orbit 的 `task.capture`、`task.clarify`、`task.schedule` 等能力接口。Orbit 应确保这些能力不仅是内部 API，而是 Agent 可直接调用的标准化工具，每个工具有明确的输入 schema 和输出类型。

### 3.2 Coordinator 四阶段工作流与 LLM 驱动编排

Claude Code 的 Coordinator 模式是其多 Agent 架构的核心——主会话变为 Coordinator，通过约 370 行系统提示词定义协调行为，驱动 4 阶段工作流：Research（Workers 并行调查代码库）→ Synthesis（Coordinator 综合发现、制定实施方案）→ Implementation（Workers 按方案执行）→ Verification（Workers 验证变更）。关键设计原则包括：Worker 完成后主动通知 Coordinator，而非 Coordinator 轮询；不在 Worker 间建立直接通信；启动 Agent 后立即告知用户。

**对 Orbit 的启发**：Orbit 的 Planner / Focus / Review 三角色分工可以映射为 Coordinator 模式的变体。当用户说"我想系统研究 Agent-first 产品设计，并写一篇文章"时，工作流可以是：Research 阶段（Planner Agent 并行调度：从阅读库抽取已有材料、从研究空间获取对比矩阵、从 Journal 提取相关灵感）→ Synthesis 阶段（Planner Agent 综合所有发现，生成项目结构和里程碑建议）→ 用户确认 → Implementation 阶段（Focus Agent 逐个驱动执行）→ Verification 阶段（Review Agent 检查阶段性交付）。Claude Code 将 Coordinator 的行为完全用提示词定义而非硬编码，这种灵活性对 Orbit 极有价值——不同项目类型可以有不同的编排提示词。

### 3.3 声明式工具行为特征与并发安全

Claude Code 的每个工具都必须声明自己的行为特征：`isConcurrencySafe(input)`（是否可安全并发）、`isReadOnly(input)`（是否只读）、`isDestructive(input)`（是否有破坏性）。`StreamingToolExecutor` 基于这些声明做实时调度——并发安全的工具立即并行执行，非安全的工具排队等待。

**对 Orbit 的启发**：Orbit 的能力接口（`task.capture`、`task.clarify`、`task.compute_next` 等）同样应声明行为特征。例如：`task.compute_next` 是只读的（安全并发），`task.complete` 是写操作（需要排队），`task.decompose` 可能是破坏性的（修改任务结构需要确认）。这种声明式设计使 Agent 编排层不需要硬编码每个能力的安全约束，而是由能力自身告知。

### 3.4 双向 SendMessage 协议与语义寻址

Claude Code 的 Agent 间通信支持双向消息传递，通过 `SendMessageTool` 实现，支持语义寻址（按 Agent 名称发送）、广播（`"*"` 发送给所有 Teammate）和结构化消息类型（shutdown_request、plan_approval_response 等）。传输层覆盖内存队列、文件邮箱、WebSocket 和 UDS 四种方式。

**对 Orbit 的启发**：Orbit 的 Planner / Focus / Review 三个 Agent 需要通信——Focus Agent 完成任务后应通知 Review Agent 记录事件，Review Agent 产出新任务建议后应通知 Planner Agent 排程。Claude Code 的 SendMessage 协议提供了很好的参考：按角色名语义寻址（`to: "review-agent"`）、结构化消息（`type: "task_completed"` 或 `type: "review_suggestion"`）。Orbit 可以简化传输层（初期只需内存队列），但应保留语义寻址和结构化消息的设计。

### 3.5 多层配置叠加（CLAUDE.md）与 Hooks 系统

Claude Code 支持 5 层 CLAUDE.md 配置叠加（本地 → 项目 → 用户 → 企业 → 团队），以及结构化 Hooks 系统——钩子可以在工具调用前/后拦截、修改输入/输出，支持 `allow / reject / block / proceed` 四种决策。

**对 Orbit 的启发**：Orbit 的 Directive（行为规则）与 Hooks 概念天然契合。用户确认的 Directive（如"每天最多 3 个承诺"、"写作任务优先在上午安排"）可以实现为 Agent 的 Hooks——在 `task.schedule` 执行前检查是否违反规则，在 `task.compute_next` 计算后过滤不符合 Directive 的建议。多层配置叠加也适用于 Orbit：全局 Directive → 项目级 Directive → 临时规则的优先级叠加。

### 3.6 任务依赖管理（blocks / blockedBy）

Claude Code 的任务系统支持显式依赖声明——每个任务有 `blocks` 和 `blockedBy` 字段，以及 hooks 系统在任务创建/更新时触发依赖检查。

**对 Orbit 的启发**：Orbit 03 方案已定义了 `depends_on` 关系，但可以借鉴 Claude Code 的做法——将依赖管理不仅作为关系存储，还作为 hooks 触发器。当一个任务被标记为 Done 时，自动检查其 `blocks` 列表中是否有任务因此变为 Ready，并通知 Planner Agent 更新 Today 候选集。

---

## 4. 不适用的设计

### 4.1 Hermes 的 RL 训练工具链

Hermes 内置了完整的强化学习训练工具（基于 Atropos、W&B 集成、LoRA 微调），用于 Agent 自我进化。这对 Orbit 不适用——Orbit 是个人知识管理系统，不需要在端侧做模型训练。Orbit 的"进化"应通过积累用户确认的 Directive、Review 结论和行为模式，而非模型参数更新。

### 4.2 Hermes 的 14 平台网关

Hermes 的 14 个消息平台适配器（Discord、Telegram、Slack、WhatsApp 等 900KB+ 代码）是其"全栈 AI 基础设施"定位的产物。Orbit 作为个人工具，不需要也不应该承担如此重的多平台适配负担。Orbit 应聚焦于核心 App 体验和少量关键入口（如快捷入口、语音输入、邮件转发），而非广覆盖。

### 4.3 Hermes 的单体 Agent 类（7500 行）

Hermes 的核心 `Agent` 类膨胀到约 7500 行、53 个构造函数参数，所有逻辑集中在单一类中。这种"一个类统治一切"的架构虽然初期灵活，但长期维护困难。Orbit 应避免这种设计，采用更模块化的架构（如 Claude Code 的管道式分层）。

### 4.4 Claude Code 的 Anthropic 深度绑定

Claude Code 与 Anthropic API 深度绑定（prompt caching、extended thinking 等专有特性），这对 Orbit 不适用。Orbit 的 Agent 层应保持模型无关性——通过抽象的 LLM 接口层，支持未来切换不同模型提供商，避免供应商锁定。

### 4.5 Claude Code 的终端 UI 极致体验

Claude Code 自研了 Ink 渲染引擎（React 式终端 UI + Yoga 布局 + 完整 Vim 模式），这是为开发者终端场景定制的极致体验。Orbit 作为面向普通用户的知识管理系统，不需要终端 UI，而应聚焦于图形化界面和自然语言交互。

### 4.6 代码驱动编排（ThreadPool 硬编码）的局限性

Hermes 的多 Agent 编排完全由代码控制（硬编码深度限制 2 层、并发上限 3、ThreadPoolExecutor），确定性强但灵活性不足。对于 Orbit 这种需要根据不同项目类型、用户习惯和当前状态动态调整编排策略的系统，纯代码驱动过于僵硬。Orbit 应采用 Claude Code 的 LLM 驱动编排思想（提示词定义协调行为），但同时保留关键约束的代码级守护（如用户确认点、Vision 只读等硬性规则）。

---

## 5. 具体建议

### 建议一：将能力接口实现为声明式 Agent Tool

**来源**：Claude Code 的 TaskCreate/Get/List/Update 工具 + 行为特征声明

Orbit 的 `task.capture`、`task.clarify`、`task.decompose`、`task.schedule`、`task.compute_next`、`task.start_focus`、`task.complete`、`task.review_period`、`task.confirm_change`、`task.link_support` 这 10 个能力接口，应全部实现为标准化的 Agent Tool，每个 Tool 具备：

- **输入 Schema**：明确的参数定义（如 `task.schedule` 需要 task_id、time_window、priority_hint）；
- **行为声明**：`isReadOnly`（如 `task.compute_next` 是只读的）、`isConcurrencySafe`（如多个 `task.link_support` 操作不同对象可安全并行）、`requiresConfirmation`（如 `task.decompose` 需要用户确认）；
- **事件产出**：每次调用自动写入对应 event（如调用 `task.complete` 自动产生 `completed` 事件）；
- **Hooks 集成**：支持 pre/post hooks，使 Directive 规则可以在工具调用前后拦截和修改行为。

这样，Planner / Focus / Review 三个 Agent 无需硬编码操作逻辑，而是通过调用标准 Tool 完成工作，Agent 的行为可通过更换提示词灵活调整。

### 建议二：采用 Coordinator 模式实现三角色编排

**来源**：Claude Code 的 Coordinator 四阶段工作流

不要把 Planner / Focus / Review 实现为三个独立运行的后台服务，而是采用 Coordinator 模式：一个主 Agent（Coordinator）根据当前阶段调度不同角色的子 Agent。核心编排逻辑用系统提示词定义，而非硬编码。建议的阶段映射：

1. **捕获阶段**（Captured → Clarifying）：Coordinator 调度 Planner 子 Agent 做自动分类和归属建议；
2. **规划阶段**（Clarifying → Ready → Scheduled）：Coordinator 调度 Planner 子 Agent 做拆分、排程、Today 生成；
3. **执行阶段**（Scheduled → Focused → Done/Blocked）：Coordinator 调度 Focus 子 Agent 加载上下文并辅助执行；
4. **回顾阶段**（Done → Reviewed）：Coordinator 调度 Review 子 Agent 压缩事实、生成回顾与建议。

每种项目类型（研究型、写作型、学习型、日常型）可以有不同的 Coordinator 提示词，定义不同的编排策略。

### 建议三：实现基于 Directive 的 Hooks 系统

**来源**：Claude Code 的 Hooks（pre/post tool use）+ 权限规则系统

将用户确认的 Directive 转化为结构化的 Hooks 规则。例如：

```
Directive: "每天最多 3 个正式承诺"
→ Hook: pre_task.schedule → 检查当日 Scheduled 数量 → 超限则 reject 并建议替换

Directive: "写作任务优先安排在上午"  
→ Hook: post_task.compute_next → 若返回写作任务且当前非上午 → 降低优先级、标注原因

Directive: "不在深度工作时段处理回复类任务"
→ Hook: pre_task.start_focus → 若任务类型为"回复"且处于深度时段 → block 并建议延后
```

这样 Directive 不只是 Agent 参考的文本，而是真正可执行的行为约束，对应 Orbit 方案中"Directive 是执行规则"的定位。

### 建议四：引入对象作用域并发控制

**来源**：Hermes 的路径作用域并行检测 + Claude Code 的 isConcurrencySafe 声明

为 Orbit 的自动化操作设计并发控制策略：

- **只读操作**（查询对象、关系、事件，`task.compute_next`）：可安全并行，无限制；
- **对象级写操作**（修改任务状态、建立 link）：同一对象串行，不同对象可并行；
- **全局写操作**（重算 Today、跨项目优先级调整）：独占执行，阻塞其他写操作；
- **需确认操作**（升级为项目、改写 Directive、删除任务）：排入确认队列，等待用户响应后才执行。

Orbit 的每个能力接口应像 Claude Code 的工具一样，自行声明并发安全级别，编排层据此做自动调度。

### 建议五：任务事件流作为 Agent 间通信的事实总线

**来源**：Claude Code 的 XML task-notification 机制 + Hermes 的 10 种回调类型

Orbit 的 `events` 表不仅是历史记录，还应作为 Agent 间通信的事实总线。当 Focus Agent 记录 `focus_ended` 事件时，Review Agent 应能订阅此类事件并自动触发回顾流程；当 Planner Agent 记录 `scheduled` 事件时，Today 视图应实时更新。

建议实现一个轻量级的事件订阅机制：

- Agent 可以声明关注的事件类型（如 Review Agent 订阅 `completed`、`focus_ended`、`blocked`）；
- 事件产生后，编排层检查订阅关系并通知相关 Agent；
- 通知格式参考 Claude Code 的结构化消息（包含事件类型、涉及对象 ID、摘要、时间戳）。

这种设计使三个 Agent 角色无需彼此直接耦合——它们通过事件总线间接协作，保持了方案中"共享同一事实层"的设计原则，同时避免了 Agent 间的直接依赖。

---

## 6. 总结

通过对 Hermes Agent 和 Claude Code 的深度分析，可以提炼出对 Orbit 03 方案最核心的三个架构启发：

**第一，Agent 驱动任务管理的关键不是"更智能的 Agent"，而是"更好的 Tool 接口"。** Claude Code 的成功在于它把任务管理的每个操作都实现为声明式、类型安全、可内省的 Tool，Agent 通过调用这些 Tool 工作，而非直接操作底层数据。Orbit 的 10 个能力接口应遵循同样的设计哲学——输入严格校验、行为自声明、事件自动产出、Hooks 可拦截。

**第二，多 Agent 编排应以 LLM 驱动为主、代码守护为辅。** Hermes 的纯代码驱动编排（ThreadPool、深度限制）确定性强但不够灵活；Claude Code 的 Coordinator 提示词驱动编排灵活但需要护栏。Orbit 应取两者之长——用提示词定义不同项目类型的编排策略（灵活性），用代码硬编码用户确认点、Vision 只读、并发安全约束（安全性）。

**第三，事件系统是整个架构的粘合剂。** Hermes 的 10 种回调类型和 Claude Code 的 XML task-notification 都在解决同一个问题——如何让异步协作的多个组件保持对"发生了什么"的共识。Orbit 方案中的 `events` 表天然适合承担这个角色，但需要从"历史记录"升级为"实时事实总线"，成为 Agent 间协作、UI 更新、Review 生成的统一数据源。

总体而言，Orbit 03 方案的设计思路——Agent 降低系统维护成本、事件驱动状态变迁、Today/Focus/Review 执行链闭环——在 Hermes 和 Claude Code 的工程实践中都找到了对应的验证和可借鉴的具体实现模式。关键在于：不照搬任何一方的完整架构，而是根据 Orbit 作为个人知识管理系统的独特定位，选择性地吸收最适合的设计元素，构建属于自己的 Agent 驱动任务管理体系。
