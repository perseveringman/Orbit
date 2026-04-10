# 15 - 应用能力 MCP 化：基于 Hermes Agent 与 Claude Code 的调研分析

> **调研范围**：Hermes Agent（Python, 767+ .py 文件）与 Claude Code（TypeScript, 1884+ .ts/.tsx 文件）在 MCP 集成、工具协议化、能力暴露方面的设计实践，及其对 Orbit「应用能力 MCP 化」方案的启发。

---

## 1. Orbit 设计方案摘要

Orbit 方案 15 的核心理念是：**MCP 只是能力分发协议，Capability 才是 Orbit 的真实边界**。整套设计围绕三个统一展开——统一能力面、统一执行面、统一治理面，使得阅读、研究、写作、项目管理等所有域能力都必须先注册为带元数据、权限和审计策略的 Capability，再通过协议适配层对外暴露。

在角色模型上，Orbit 同时扮演三重身份：

- **Capability Registry**：系统唯一的能力登记与策略中心，所有能力在此注册并绑定 scope、审批、审计策略。
- **Local MCP Server**：将被允许外露的 capability 按 MCP 的 resource / tool / prompt 三种原语暴露给内部或外部 Agent。
- **External MCP Client**：作为 MCP 客户端接入 GitHub、搜索、发布等外部服务，并将其能力纳入 Orbit 的统一编排与审计体系。

方案对能力暴露做了精细的分域设计（Workspace Query、Content Capture、Research、Writing、Planning、Graph/Memory、Integration、Sensitive Ops 共 8 个域），并制定了严格的暴露策略：Resource 只暴露物化投影而非真相层，Tool 只暴露意图化命令而非通用 CRUD，Prompt 只暴露任务配方而非系统主提示词。执行面则通过 Capability Runtime 统一拦截所有调用（无论来自 UI、内部 Agent、外部 Agent 还是自动化规则），经 Policy Engine → Approval Engine → Handler → Audit Sink 全链路治理。

方案还定义了四级用户确认模型（静默通过、会话授权、每次确认、双阶段确认）、三层敏感能力隔离（Open Lane / Guarded Lane / Vault Lane）、以及外部数据安全回流机制（所有外部返回必须先到候选层/草稿层，经本地对象化后才能成为 committed object）。

这是一个野心很大的方案：它不只是要"接一个 MCP 协议"，而是要把 Orbit 所有可执行能力收敛为统一契约，在此基础上实现产品级的安全开放。

---

## 2. Hermes Agent 可借鉴之处

### 2.1 完整的 MCP 规范实现——尤其是 Sampling 反向调用

Hermes 在 `tools/mcp_tool.py`（2186 行）中实现了目前开源项目中最完整的 MCP 客户端之一。除标准的工具发现、调用、动态刷新外，Hermes 独特地实现了 **MCP Sampling 协议**——允许 MCP 服务器反向请求宿主 LLM 完成推理任务。其 `SamplingHandler` 支持滑动窗口限速（`max_rpm`）、模型白名单解析（`_resolve_model`）、token 上限约束（`max_tokens_cap`）和工具轮次限制（`max_tool_rounds`），形成了一个带完整安全约束的反向调用通道。

**对 Orbit 的启发**：Orbit 作为 Local MCP Server 暴露能力时，也会面临外部 Agent 需要"借用" Orbit 内部 LLM 能力的场景（例如外部工作流需要 Orbit 帮助摘要一段内容）。Hermes 的 Sampling 实现证明了这种反向调用在工程上是可行的，但**必须有严格的限速、模型限制和 token 预算**。Orbit 可以将 Sampling 纳入 Capability Registry 的管辖，作为一种特殊的 `integration.sampling` 能力，受 Vault Lane 级别的治理约束。

### 2.2 配置驱动的 MCP 服务器管理与自动重连

Hermes 采用 YAML 配置声明所有 MCP 服务器连接，每个服务器在独立的 asyncio Task 中运行，并实现了指数退避自动重连（最多 5 次，退避上限 60 秒）。同时支持 `tools/list_changed` 通知监听，实现工具定义的热更新。

**对 Orbit 的启发**：Orbit 作为 External MCP Client 接入多个外部服务时，需要类似的连接生命周期管理。Hermes 的实践表明，**每个外部 MCP 服务器应作为独立的连接单元管理，拥有独立的健康检查、重连策略和工具刷新机制**。Orbit 可以在 Registry 层为每个外部 server 维护连接状态、健康度评分和最后刷新时间，当连接不可用时自动降级对应的 `integration.*` capability。

### 2.3 凭证清洗与安全防护

Hermes 在 MCP 层实现了凭证清洗机制（`_sanitize_error`），通过正则匹配自动从错误返回中剥离 `ghp_*`、`sk-*`、`Bearer` 等敏感 token。这是一个容易被忽视但极其重要的安全细节——MCP 服务器的报错信息可能意外泄露凭证。

**对 Orbit 的启发**：Orbit 的 Capability Runtime 在返回错误给外部 Agent 时，必须经过一道凭证/敏感信息清洗层。这应该是 Audit Sink 的一部分——在 `execution_failed` 事件记录完整错误后，对外返回的错误信息经过脱敏处理。

### 2.4 工具集概率采样与分域分发

Hermes 的 `toolset_distributions.py` 实现了独特的概率采样分布系统——针对不同场景（research、terminal_tasks、browser_tasks 等）定义不同的工具集启用概率。虽然这主要服务于 RL 训练数据生成，但其**按场景裁剪工具可见性**的思路与 Orbit 的分域能力暴露高度契合。

**对 Orbit 的启发**：Orbit 的 Registry 在为不同 Actor 生成 toolset 时，可以借鉴 Hermes 的分发思路——不是简单的全开/全关，而是**根据 Actor 身份、任务类型、工作区上下文动态裁剪可见能力集**。例如，Research Agent 看到的是 research 域 + workspace query 域的能力子集，而 Writing Agent 看到的是 writing 域 + content capture 域的子集。这种动态裁剪减少了 LLM 的决策负担，也降低了误调用风险。

### 2.5 多后端执行环境抽象

Hermes 通过 `BaseEnvironment` + `ProcessHandle` 协议抽象了 6 种执行后端（Local / Docker / Modal / SSH / Daytona / Singularity），每种后端实现统一的命令执行接口。这种"执行环境可插拔"的设计允许同一个 Agent 在不同安全等级的环境中运行。

**对 Orbit 的启发**：Orbit 的敏感能力隔离（Open / Guarded / Vault Lane）可以借鉴这种执行环境分层思路。不同 Lane 的 capability handler 可以运行在不同的隔离级别——Open Lane 直接在进程内执行，Guarded Lane 在受限沙箱中执行，Vault Lane 由独立的 broker 进程代执行。

---

## 3. Claude Code 可借鉴之处

### 3.1 声明式工具定义与行为内省

Claude Code 的工具系统要求每个工具必须声明 `isConcurrencySafe`、`isReadOnly`、`isDestructive` 等行为特征，并提供强类型的 `inputSchema`（Zod）和 `checkPermissions` 方法。这些声明不仅用于权限判断，还驱动并发调度——`StreamingToolExecutor` 根据 `isConcurrencySafe` 声明自动决定并发执行还是排队等待。

**对 Orbit 的启发**：Orbit 的 Capability Interface 已经包含了 `kind`（query/command/mutation/integration）、`confirmationPolicy`、`dataAccessClass` 等字段，与 Claude Code 的行为声明高度同构。关键的借鉴点是：**这些声明不应只是静态元数据，而应直接驱动运行时行为**。例如，`kind: query` 的 capability 应自动允许并发执行，`kind: mutation` 应自动排队串行化，`dataAccessClass: sensitive` 应自动触发确认流程。这种"声明即策略"的模式大幅减少了 Policy Engine 的规则编写量。

### 3.2 MCP Annotations 到行为声明的映射

Claude Code 在集成外部 MCP 工具时，自动将 MCP annotations（`readOnlyHint`、`destructiveHint`、`openWorldHint`）映射为内部的行为声明（`isConcurrencySafe`、`isDestructive`、`isOpenWorld`），使外部工具无缝融入现有的权限和调度体系。同时利用 `_meta['anthropic/searchHint']` 和 `_meta['anthropic/alwaysLoad']` 控制延迟加载行为。

**对 Orbit 的启发**：Orbit 作为 External MCP Client 接入外部服务器时，应该建立类似的 **annotations → capability metadata 映射规则**。外部 MCP 工具的 `readOnlyHint` 应映射到 Orbit 的 `kind: query`，`destructiveHint` 应映射到 `confirmationPolicy: per-invocation` 或更高级别。这使得外部能力在 Orbit 内部也能享受与内部能力一致的治理待遇，无需为每个外部工具单独编写策略规则。

### 3.3 声明式权限规则 + ML 分类器的分层审批

Claude Code 实现了四层权限决策：Deny 规则（fail-closed）→ Allow 规则（快速通道）→ ML 分类器（auto 模式）→ 用户确认。其中 ML 分类器（transcript classifier）通过分析对话上下文判断操作安全性，比纯正则匹配更智能。同时 Hooks 系统可以拦截、修改甚至拒绝工具调用，提供了精细的定制能力。

**对 Orbit 的启发**：Orbit 的四级确认模型（静默/会话授权/每次/双阶段）目前是静态配置在 capability 定义中的。可以借鉴 Claude Code 的思路，引入**上下文感知的动态审批**——同一个 capability 在不同上下文下可能需要不同级别的确认。例如，`note.create_from_external` 在可信外部 Agent 的常规研究工作流中可以静默通过，但在陌生 Agent 首次调用时需要每次确认。这种动态升降级机制需要一个类似 ML 分类器或规则引擎来驱动。

### 3.4 Coordinator 模式与 LLM 驱动编排

Claude Code 的 Coordinator 模式是其多 Agent 编排的核心——通过约 370 行的系统提示词定义 4 阶段工作流（Research → Synthesis → Implementation → Verification），由 LLM 自主决定何时启动 Worker、如何分配任务、何时合成结果。Worker 完成后通过 XML 格式的 task-notification 主动通知 Coordinator，Coordinator 不主动轮询。

**对 Orbit 的启发**：Orbit 的 Agent 编排层（方案 14）需要决定编排控制权的归属。Claude Code 的经验表明，**对于复杂知识工作（如研究闭环），LLM 驱动编排比代码驱动编排更灵活**——Coordinator 可以根据研究进展动态调整策略，而不需要预先硬编码所有分支。但 Orbit 应该在此基础上加一层约束：Coordinator 的编排决策也必须经过 Capability Runtime 的策略校验，防止 LLM 编排出越权的工具调用序列。

### 3.5 技能隔离与 Token 预算控制

Claude Code 的技能执行采用 Fork 子 Agent 模式——每个技能在独立上下文中运行，拥有工具白名单（`allowedTools`）和 Token 预算（`calculateSkillBudget`）。执行完毕后记录使用统计（执行时间、Token 数、成功率），供后续优化。

**对 Orbit 的启发**：当外部 Agent 通过 MCP 调用 Orbit 的复合能力（例如"围绕某研究空间生成决策 memo"这种 Prompt 模板），Orbit 内部可能需要编排多个 capability 完成。这种编排执行应该像 Claude Code 的技能一样**受到 Token 预算和工具白名单的约束**，防止一次外部调用触发无限制的内部能力链。`budgetClass` 字段已经存在于 Orbit 的 capability 定义中，关键是要在 Runtime 层真正实施预算控制。

### 3.6 多传输层双向通信协议

Claude Code 的 `SendMessageTool` 支持多种传输方式（进程内队列、文件邮箱、WebSocket、UDS）和结构化消息类型（shutdown_request、plan_approval_response 等），实现了 Agent 间的语义寻址和双向通信。

**对 Orbit 的启发**：Orbit 的应用内 Agent 与外部 Agent 虽然通过 MCP 协议通信，但某些场景需要更丰富的协议语义——例如外部 Agent 发起的写操作挂起等待用户确认时，需要一个 `approval_pending` → `approval_granted/denied` 的双向交互流。Orbit 的 `ApprovalTicket` 机制可以借鉴 Claude Code 的结构化消息设计，定义一套标准的审批交互协议。

---

## 4. 不适用的设计

### 4.1 Hermes 的单体 Agent 类架构

Hermes 的核心 `Agent` 类达到 7500 行、构造函数有 53 个参数，所有逻辑集中在一个类中。这种"一个类统治一切"的架构虽然在快速原型阶段有效，但与 Orbit 追求的模块化、分层治理理念相悖。Orbit 的 Capability Runtime 需要清晰的分层（Registry / Policy Engine / Approval Engine / Handler / Audit Sink），不能把所有逻辑堆在一个中心类里。

### 4.2 Hermes 的开放技能市场模式

Hermes 构建了包含 4 个外部来源（official / github / clawhub / lobehub）的开放技能市场，支持在线下载、安装和版本管理。但 Orbit 是一个**本地优先的知识管理工具**，其能力边界是明确的产品域能力（阅读、研究、写作等），不需要也不应该引入外部不可控的技能市场。外部能力应通过 MCP 协议以受控方式接入，而非通过技能市场动态安装。

### 4.3 Claude Code 的 Anthropic 深度绑定

Claude Code 与 Anthropic API 深度绑定，利用 prompt caching、extended thinking 等专有特性优化体验。Orbit 作为一个面向用户的本地应用，应保持模型无关性。Capability Interface 的设计不应依赖任何特定 LLM 提供商的专有能力。

### 4.4 Hermes 的 RL 训练闭环

Hermes 内置了完整的 RL 训练工具链（基于 Atropos），包括环境发现、配置管理、训练启停和 W&B 集成。这是 Hermes 作为 AI 基础设施平台的独特定位，但对 Orbit 来说属于过度工程——Orbit 的 Agent 编排不需要自我进化能力，而应聚焦在通过 capability 治理实现可靠执行。

### 4.5 两者的通用 Shell 执行工具

Hermes 的 6 后端 terminal tool 和 Claude Code 的 BashTool 都提供了通用 Shell 命令执行能力。Orbit 作为知识管理应用，**绝不应该暴露通用 Shell 执行 capability**。这与方案 15 的硬边界完全一致："禁止 SQL、禁止 ORM 查询 DSL、禁止任意对象 CRUD"。

---

## 5. 具体建议

### 建议一：以 Claude Code 的行为声明模式设计 Capability Interface，实现"声明即策略"

在 Orbit 的 Capability Interface 中，将 `kind`、`dataAccessClass`、`confirmationPolicy`、`egressPolicy` 等字段从纯元数据提升为**运行时策略驱动器**。具体来说：

- `kind: query` 的 capability 自动标记为并发安全、只读，Runtime 可并行调度多个 query 调用。
- `kind: mutation` + `dataAccessClass: sensitive` 自动触发 Guarded Lane 执行和 `per-invocation` 确认。
- `exposure: brokered-external` 的 capability 自动经过出境控制检查。

这需要在 Capability Runtime 入口处实现一个**策略推导引擎**，根据 capability 声明自动生成执行策略，减少手动配置。参考 Claude Code 的 `buildTool()` 工厂函数的 fail-closed 默认值设计——未声明的字段默认走最严格路径（默认不安全、默认有写操作、默认需要确认）。

### 建议二：建立 MCP Annotations ↔ Capability Metadata 的双向映射层

Orbit 同时扮演 MCP Server 和 MCP Client，需要在两个方向上实现 annotations 映射：

**作为 MCP Client 接入外部服务器时**（入方向）：
- 外部工具的 `readOnlyHint: true` → 内部 `kind: query` + `confirmationPolicy: silent`
- 外部工具的 `destructiveHint: true` → 内部 `confirmationPolicy: per-invocation` + `dataAccessClass: sensitive`
- 外部工具无 annotation → 默认走 `confirmationPolicy: per-invocation`（fail-closed）

**作为 MCP Server 暴露能力时**（出方向）：
- 内部 `kind: query` → MCP annotation `readOnlyHint: true`
- 内部 `kind: mutation` → MCP annotation `destructiveHint: true`
- 内部 `egressPolicy: restricted` → MCP annotation `openWorldHint: false`

这种双向映射使 Orbit 在 MCP 生态中既能正确消费外部能力的安全声明，也能向外部 Agent 准确传达自身能力的行为特征。

### 建议三：实现类似 Hermes Sampling 的受控反向调用机制

当 Orbit 作为 Local MCP Server 服务外部 Agent 时，某些场景需要允许 MCP 服务器端（Orbit）反向请求外部 Agent 的 LLM 能力。例如，外部 Agent 调用 `research.generate_summary` 时，Orbit 可能需要使用 Agent 自带的模型来完成摘要生成（因为 Orbit 本身可能只有本地小模型）。

借鉴 Hermes 的 `SamplingHandler` 设计，Orbit 应该：
- 将 Sampling 能力注册为 `integration.sampling.request` capability，受 Vault Lane 级别治理。
- 对每个 Sampling 请求施加限速（滑动窗口 RPM）、Token 预算和模型白名单约束。
- 所有 Sampling 请求和响应都记入审计日志，包括发送的内容范围和返回的结果摘要。
- 默认不启用，需要用户在 Orbit 设置中显式授权。

### 建议四：为外部 MCP 连接实现独立的连接生命周期管理

借鉴 Hermes 的 `MCPServerTask` 独立事件循环和 Claude Code 的批量并发连接策略，Orbit 的 External MCP Client 应该：

- 每个外部 MCP 服务器以独立的连接单元管理，拥有独立的健康检查和重连策略。
- 本地服务器（stdio 协议）和远程服务器（HTTP/SSE 协议）使用不同的并发初始化策略（参考 Claude Code 的本地 ×5、远程 ×10 并发连接）。
- 连接状态实时反映到 Registry——连接断开时自动将对应的 `integration.*` capability 标记为 `degraded`，防止 Agent 调用不可用的外部能力。
- 支持 `tools/list_changed` 通知监听，实现外部工具定义的热更新，无需重启应用。
- 在连接层实现错误信息的凭证清洗（借鉴 Hermes 的 `_sanitize_error`），防止外部服务的报错信息泄露 Orbit 持有的 token。

### 建议五：引入上下文感知的动态审批升降级机制

Orbit 方案 15 定义的四级确认模型是静态的——每个 capability 的 `confirmationPolicy` 在定义时就固定了。建议借鉴 Claude Code 的分层审批策略（规则 → ML 分类器 → 用户确认），引入动态审批：

- **信任积累**：可信外部 Agent 在多次成功、低风险调用后，其确认级别可以自动从 `per-invocation` 降级为 `session-once`。
- **风险升级**：当同一 session 内的写操作累计超过阈值，或检测到异常调用模式（如短时间内大量读取不同项目的数据），自动将确认级别从 `silent` 升级为 `per-invocation`。
- **上下文因子**：相同的 `note.create_from_external` 在"用户正在进行的研究项目"上下文中可以 session-once，但在"用户不活跃时的后台调用"中必须 per-invocation。

动态审批的决策应记入审计日志，用户可以查看和调整审批策略。这比静态策略更安全（能应对意外场景），也比完全的每次确认更高效（减少打断）。

---

## 6. 总结

通过深入分析 Hermes Agent 和 Claude Code 两个项目，我们可以看到它们在工具协议化和能力暴露方面代表了两种截然不同但各有优势的路径：

**Hermes** 追求**协议完整性与开放性**——其 MCP 实现覆盖了 Sampling、OAuth PKCE、动态工具发现、凭证清洗等完整规范，工具集分发支持概率采样，6 种执行后端适配各种部署环境。它像一个开放的基础设施平台，给下游最大的灵活性。

**Claude Code** 追求**系统一致性与工程深度**——其工具系统要求每个工具声明行为特征并直接驱动运行时策略，MCP annotations 无缝映射到内部类型系统，权限审批从声明式规则到 ML 分类器形成多层防线。它像一座精心设计的花园，每个部件都经过深思熟虑。

Orbit 的「应用能力 MCP 化」方案在设计理念上比两者都更进一步——它不只是要"集成 MCP"，而是要构建一个**以 Capability 为核心的统一治理体系**，MCP 只是这个体系的分发协议之一。这个定位是正确的，因为 Orbit 作为知识管理应用，其安全边界和产品语义比通用 AI 工具更加明确。

从两个项目中，Orbit 可以获得的最关键启发是：

1. **从 Claude Code 学"声明即策略"**：让 Capability 的元数据声明直接驱动 Runtime 行为，而不是在 Policy Engine 中重复编写规则。
2. **从 Hermes 学"协议完整性"**：MCP 规范的完整实现（尤其是 Sampling、动态工具发现、凭证清洗）是产品级可靠性的前提。
3. **从 Claude Code 学"Annotations 双向映射"**：作为 MCP 生态的双重参与者（Server + Client），Orbit 需要在两个方向上正确传达和消费能力的行为语义。
4. **从两者的差异中学"取舍"**：Hermes 的开放性（技能市场、多模型）和 Claude Code 的受控性（fork 隔离、工具白名单）代表了能力暴露的两个极端——Orbit 应该取受控的一端，因为知识管理的安全性远重于扩展性。

最终，Orbit 的 MCP 化成功与否不取决于接了多少个 MCP 服务器或暴露了多少个工具，而取决于**能否让外部 Agent 只通过明确定义、可解释、可撤销、可审计的接口与 Orbit 协作**。这正是方案 15 开篇所定义的目标，也是 Hermes 和 Claude Code 各自在不同程度上追求但尚未完全实现的愿景。Orbit 有机会在知识管理这个垂直领域，做出比两者更完整的实践。
