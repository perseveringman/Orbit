# 08 - 全局日志与 Journal 调研报告

> **调研对象**：Hermes Agent (Python) 与 Claude Code (TypeScript) 在日志记录、会话历史、审计追踪方面的设计  
> **对标文档**：Orbit 设计方案 08《全局日志与 Journal》  
> **目标**：从两个成熟 Agent 项目中提取对 Orbit 日志系统与 Journal 设计有实质借鉴意义的架构模式与实现策略

---

## 1. Orbit 设计方案摘要

Orbit 的全局日志系统定位为整个 Agent-first 应用的**事实时间层**，而非传统意义上的行为埋点或产品 telemetry 管道。其核心主张是：把用户在 Orbit 内的关键动作、对象变化、关系建立、回顾判断与少量受控外部上下文，编织成可回放的时间面。Journal 是这套时间层面向用户的主界面，回答"今天实际上发生了什么"。

设计方案提出了**五层日志模型**：

| 层级 | 对象 | 角色 |
|------|------|------|
| L1 | `event` | 最小不可约事实 |
| L2 | `action_log` | 面向 Journal 的可读操作块（由 L1 物化） |
| L3 | `day_note` | 用户对当天的手写记录 |
| L4 | `journal_summary` | 日/周/月的回顾摘要（可重算的派生快照） |
| L5 | `behavior_insight` | 有证据的模式洞察（可过期的解释） |

五条硬原则支撑整个设计：先存事实再生解释、全局记录但不无限采集、用户可见优先、隐私分级先于智能利用、日志服务闭环不服务审计感。方案同时定义了三条平行日志管线（用户行为日志、安全审计日志、技术诊断日志），以及四级隐私控制（全局记录模式、对象级可见性、Agent 读取策略、同步与出境策略）。

数据模型上，方案给出了 `events`、`action_logs`、`journal_summaries`、`behavior_insights` 四张核心表的完整 schema，并明确 `day_note` 复用 06 的统一 Note 模型。整体设计强调：**只有 L1/L3 是事实层，L2/L4/L5 都必须可回链到来源且允许删除、重建、失效。**

---

## 2. Hermes 可借鉴之处

### 2.1 SQLite + FTS5 全文搜索：为日志层提供强查询基础

Hermes 选择 SQLite 作为对话历史的存储引擎，并通过 FTS5 虚拟表实现跨会话的全文搜索能力。其消息表包含 `role`、`content`、`tool_call_id`、`tool_calls`、`tool_name`、`timestamp`、`token_count`、`finish_reason` 等完整字段，FTS5 表通过触发器自动同步，支持按关键词跨越所有历史会话检索消息内容。

**对 Orbit 的启发**：Orbit 的 `events` 表将承载大量语义事件，L2 的 `action_logs` 需要基于 event 进行聚合查询，L4 的 `journal_summary` 需要溯源到具体的 action log。SQLite + FTS5 提供了一个经过验证的本地优先全文搜索方案，完全符合 Orbit 的 local-first 架构。特别是 Hermes 的 WAL（Write-Ahead Logging）模式支持并发读 + 单写入，这对 Orbit 在前台渲染 Journal 的同时后台持续写入 event 的场景非常适用。建议 Orbit 的 event 层直接采用 SQLite + FTS5 架构，为 Journal 的跨时间范围搜索、按对象搜索、按主题搜索提供底层基础设施。

### 2.2 会话谱系（Session Lineage）：压缩不丢失历史链

Hermes 在上下文压缩发生时，不是简单覆盖当前会话，而是创建新会话并通过 `parent_session_id` 链接旧会话，形成完整的压缩链。旧会话标记 `end_reason='compression'`，新会话继承上下文摘要。这使得任何一次压缩都不会导致历史断裂——你可以沿着 parent 链一路追溯到最初的原始对话。

**对 Orbit 的启发**：Orbit 的 `journal_summary` 是对一天/一周事实的压缩，`behavior_insight` 是对多天模式的提炼。两者都涉及"原始事实 → 压缩表达"的过程。Hermes 的 session lineage 模式提供了一个清晰的"压缩溯源"范式：每次压缩生成新记录，但保留指向来源的链接。Orbit 的 `journal_summary` 已经设计了 `source_action_log_ids_json` 字段来实现类似的溯源，建议进一步借鉴 Hermes 的做法，在 `behavior_insight` 的 `evidence_json` 中也明确记录完整的推导链路，包括中间 summary 版本号，这样用户驳回 insight 时系统可以精确定位哪个环节的推导出了问题。

### 2.3 结构化压缩摘要模板：让 Agent 生成可回溯的摘要

Hermes 的 ContextCompressor 使用了一个 8 节结构化模板来引导 LLM 生成压缩摘要：Goal、Constraints & Preferences、Progress（Done/In Progress/Blocked）、Key Decisions、Relevant Files、Next Steps、Critical Context、Tools & Patterns。这不是自由文本摘要，而是有固定结构的信息提取。

**对 Orbit 的启发**：Orbit 的 `journal_summary` 需要 Agent 把一天的 action logs 压缩成人类可读的回顾。自由文本摘要容易丢失关键信息或引入幻觉。建议为 Orbit 的日/周/月摘要设计专用的结构化模板，例如：

- **当日关键行动**（对应 Hermes 的 Progress）
- **涉及的项目与研究**（对应 Relevant Files）
- **完成与阻塞**（对应 Done/Blocked）
- **值得回顾的决策**（对应 Key Decisions）
- **值得关注的模式信号**（为 behavior_insight 提供候选）

这样生成的 summary 既结构化易于程序解析，又有固定维度方便用户扫描。

### 2.4 跨会话搜索 + LLM 摘要：智能历史检索范式

Hermes 的 `session_search` 工具先通过 FTS5 检索相关消息片段，再用 Gemini Flash 对检索结果生成总结。这种"检索 + LLM 理解"的两阶段模式意味着跨会话信息不是简单的文本匹配返回，而是经过语义理解的智能摘要。

**对 Orbit 的启发**：当用户或 Agent 需要回答"过去两周我在这个项目上做了什么"时，Orbit 可以采用类似的两阶段模式：先从 action_logs 表检索相关记录（FTS5 + 时间范围 + 对象过滤），再用 Agent 生成结构化的回顾摘要。这既避免了让 Agent 直接读取大量原始 event 导致上下文膨胀，又比纯关键词搜索提供了更有语义的回答。

### 2.5 记忆系统的安全扫描机制

Hermes 对所有写入记忆的内容执行安全扫描，检测提示词注入、角色劫持、系统提示词覆盖、SSH 后门、API 密钥泄露等威胁模式。虽然这主要针对 Agent 记忆，但其思路对日志系统同样重要。

**对 Orbit 的启发**：Orbit 的 event 流中可能包含 Agent 生成的内容（如 `actor_type='agent'`），这些内容在被写入 action_log 或 journal_summary 前，应经过类似的安全扫描，防止 Agent 在日志层注入恶意内容。特别是 behavior_insight 由 Agent 生成且可能影响后续决策——对其进行写入前的安全检查是合理的防御层。

---

## 3. Claude Code 可借鉴之处

### 3.1 分级告警与自动压缩：精细的上下文生命周期管理

Claude Code 设计了四级上下文告警机制（warning → error → autoCompact → blocking），每一级有独立的 token 缓冲阈值（如 `WARNING_THRESHOLD_BUFFER_TOKENS = 20_000`、`AUTOCOMPACT_BUFFER_TOKENS = 13_000`）。当上下文接近阈值时，系统自动触发压缩而非等到溢出后被动截断。

**对 Orbit 的启发**：Orbit 的 event 表会持续增长，action_log 的物化视图和 journal_summary 的生成都需要消耗计算资源。Claude Code 的分级告警思路可以启发 Orbit 设计一套**日志容量管理策略**：

- **正常阶段**：event 持续写入，action_log 实时物化；
- **预警阶段**：当单日 event 数量超过阈值（如 500 条），提示用户当天活动密集，摘要可能需要更多概括；
- **自动压缩阶段**：当 event 存储超过配置的容量上限，自动执行 retention 策略——将过期 crumb 级事件归档或删除，保留 core 级事件；
- **硬限制阶段**：达到设备存储上限时，强制执行最低保留策略。

这种分级管理避免了"要么全存要么全删"的粗暴策略。

### 3.2 Transcript 持久化：轻量级会话完整记录

Claude Code 将完整对话记录保存在 `.claude/{sessionId}.jsonl` 文件中，每条消息一行 JSON。这种 JSONL 格式既便于追加写入（append-only），又便于按行解析和流式处理。压缩后的摘要消息会标记 `isCompactSummary: true` 和 `isVisibleInTranscriptOnly: true`，区分原始消息和派生消息。

**对 Orbit 的启发**：Orbit 的 event 层虽然以 SQLite 为主存储，但 Claude Code 的 transcript 思路可以启发 Orbit 为每个 Journal day 维护一份**事件溪流文件**（event stream file），以 JSONL 格式追加写入当天所有 event。这份文件的用途不是替代数据库，而是：

1. 作为 event 的写前日志（WAL 补充），在 SQLite 写入失败时提供恢复来源；
2. 作为导出的原始格式——用户导出"真相层"时直接给出 JSONL 文件；
3. 作为 Agent 的流式读取源——Agent 可以按行扫描当天事件流，而不必发起复杂的 SQL 查询。

Claude Code 的 `isCompactSummary` 标记也值得借鉴：Orbit 的 action_log 和 journal_summary 作为派生层，在持久化时应明确标记其"派生"属性，方便导出时区分事实与解释。

### 3.3 多层 CLAUDE.md 配置叠加：为日志隐私分级提供范式

Claude Code 的 5 层配置叠加机制（Managed → Managed Rules → User Global → User Rules → Project/Local）提供了一种"多层策略从严到宽依次生效"的管理模式。每一层都有明确的优先级，高层策略可以覆盖低层设置。配置文件标记为不同类型（Project、Local、TeamMem、AutoMem、User），不同类型有不同的同步和可见性规则。

**对 Orbit 的启发**：Orbit 的四级隐私控制（全局记录模式、对象级可见性、Agent 读取策略、同步与出境策略）可以借鉴这种**分层策略叠加**模式。具体而言：

- **平台级策略**：Orbit 预设的最低隐私底线（如永远不记录密码、剪贴板密钥），类似 Managed CLAUDE.md；
- **用户全局策略**：用户在设置中配置的全局记录偏好，类似 User Global；
- **项目级策略**：用户为某个项目设置的特殊隐私规则，类似 Project CLAUDE.md；
- **对象级策略**：单个 note/session/research 的 `normal | sensitive | sealed` 标记，类似 Local 配置。

策略的生效规则应为**从严取交集**：如果用户全局策略允许 Agent 读取，但对象级标记为 `sealed`，则以 `sealed` 为准。这与 Claude Code 的层级覆盖逻辑一致。

### 3.4 OpenTelemetry 遥测集成：技术诊断日志的标准方案

Claude Code 将成本追踪与 Token 计数通过 OpenTelemetry counters 发出（`getCostCounter()?.add(cost, { model })`、`getTokenCounter()?.add(usage.input_tokens, { model, type: 'input' })`），实现了结构化的可观测性。这与应用层的对话日志完全分离——OTel 数据流向监控后端，对话数据留在本地。

**对 Orbit 的启发**：Orbit 设计中明确将"技术诊断日志"独立为一条管线，且规定"不进入 Journal、不可给 Agent、可选上传但绝不含正文"。Claude Code 的 OTel 方案恰好是这条管线的标准实现：崩溃、耗时、错误码、队列状态等技术指标通过 OTel 发出，走独立的收集通道，与用户行为日志管线彻底隔离。建议 Orbit 的技术诊断日志直接采用 OTel 标准，避免自建遥测轮子。

### 3.5 压缩后资源恢复预算：摘要不是终点

Claude Code 在执行上下文压缩后，预留了一套资源恢复预算（`POST_COMPACT_MAX_FILES_TO_RESTORE = 5`、`POST_COMPACT_TOKEN_BUDGET = 50_000`），用于在压缩后重新加载关键文件和技能上下文。这意味着压缩不是一个"丢信息"的过程，而是"压缩 + 恢复关键上下文"的两步动作。

**对 Orbit 的启发**：Orbit 的 Agent 在生成 journal_summary 或 behavior_insight 后，可能需要基于这些摘要继续工作（如在 Review 页面引用、在 Today 页面建议）。Claude Code 的"压缩后恢复"思路提示我们：当 Agent 从摘要层切换到行动建议时，可以有一个受控的"上下文恢复预算"——允许 Agent 在摘要基础上按需回查最多 N 条原始 action_log，而不是要么只看摘要、要么全量加载事实层。这比 Orbit 方案中的静态读取顺序（summary → action_log → event）更灵活。

---

## 4. 不适用的设计

### 4.1 Hermes 的单体 Agent 类与事件记录耦合（不适用）

Hermes 的核心 Agent 类超过 7,500 行，所有逻辑（包括消息记录、压缩、工具调用、记忆管理）集中在一个类中。消息追加、会话管理与 Agent 执行逻辑深度耦合。这种架构导致日志记录逻辑散布在 Agent 运行时的各个角落，难以独立维护和测试。

**不适用原因**：Orbit 的日志系统是一个独立的"事实时间层"，应该是所有模块（阅读、研究、写作、任务）的**旁路观察者**，而不是嵌入在某个核心类内部的副作用。Orbit 应保持日志系统的独立性，通过事件总线或发布-订阅模式接收各模块的事件，而不是让各模块直接调用日志写入 API。

### 4.2 Hermes 的外部记忆插件生态（不适用）

Hermes 支持 8+ 外部记忆提供商（Honcho、Mem0、ChromaDB 等），每个提供商有独立的同步和查询接口。这种开放式插件生态适合"让用户自选最佳记忆方案"的场景。

**不适用原因**：Orbit 的 Journal 系统强调 local-first、用户可控、隐私分级。将日志和记忆托管给第三方提供商直接违反了"隐私分级先于智能利用"的硬原则。Orbit 不应在日志层引入外部记忆插件，而应自建完整的本地存储和查询能力。

### 4.3 Claude Code 的 JSONL 作为主存储（不适用于 event 层）

Claude Code 以 JSONL 文件作为对话历史的主存储，最大 100 条，采用异步批量刷写。这对"轻量启动、短期对话"的 CLI 工具完全够用。

**不适用原因**：Orbit 的 event 层需要支持跨时间范围查询、按对象过滤、按隐私级别访问控制——这些都是关系型数据库的强项而非平文件的强项。JSONL 可以作为辅助的事件溪流文件，但不能替代 SQLite 作为 event 的主存储。100 条的上限对于一天可能产生数百条 event 的场景更是远远不够。

### 4.4 Claude Code 的 Anthropic 深度绑定（不适用）

Claude Code 的上下文管理深度依赖 Anthropic 特有能力（prompt caching、extended thinking、1M 上下文窗口、cache_control 标记）。这些优化只对 Claude 模型有效。

**不适用原因**：Orbit 的 Agent 架构（14 号方案）应支持多模型后端。日志系统的 Agent 读取逻辑、摘要生成、洞察提取不应假设底层是特定模型。建议日志系统的 Agent 接口保持模型无关，通过抽象层适配不同 LLM 的上下文窗口和缓存策略。

### 4.5 两个项目均缺少的用户侧 Journal 交互（无法借鉴）

Hermes 和 Claude Code 都是面向开发者的 Agent 工具，它们的"日志"概念局限于对话历史和技术遥测。两者都没有"用户手写日记"、"日视角事实工作台"、"行为洞察回顾"等面向普通用户的 Journal 交互概念。Orbit 的 Journal 页面设计（Day Note 区、Action Timeline 区、Summary & Object Strip 区、Insight & Review Hook 区）在这两个项目中找不到直接对标物。

---

## 5. 具体建议

### 建议一：event 层采用 SQLite + FTS5 + JSONL 双轨存储

借鉴 Hermes 的 SQLite + FTS5 方案和 Claude Code 的 JSONL transcript 方案，为 Orbit 的 event 层设计双轨存储：

- **主存储**：SQLite 数据库，按 Orbit 方案中的 `events` 表 schema，WAL 模式支持并发读写。为 `event_type`、`surface`、`object_uid`、`day_key` 建立组合索引，FTS5 虚拟表覆盖 `payload_json` 中的文本字段，支持全文搜索。
- **辅助溪流**：每日一个 JSONL 文件（`journal/{YYYY-MM-DD}.events.jsonl`），append-only 写入，用于快速导出、Agent 流式扫描和灾难恢复。

双轨的一致性通过"先写 JSONL 再写 SQLite"保证：JSONL 作为写前日志，SQLite 写入成功后 JSONL 保留但可选清理。

### 建议二：为 journal_summary 设计结构化生成模板

借鉴 Hermes 的 8 节压缩摘要模板和 Claude Code 的 9 维分析框架，为 Orbit 的日/周/月摘要设计专用结构化模板：

```
## 当日摘要模板
- 关键行动（完成了什么、推进了什么、阻塞了什么）
- 涉及对象（项目、研究空间、阅读材料、文档）
- 输入→输出转化（什么阅读变成了笔记，什么研究变成了行动）
- 时间分配概览（深度工作时段、碎片时段、会话时长）
- 值得关注的信号（为 behavior_insight 候选提供素材）
```

模板中的每个字段都应附带 `source_action_log_ids`，确保摘要的每一句话都可追溯到具体的 action log。Agent 生成摘要时必须填充所有结构化字段，而非生成自由文本。

### 建议三：实现分级日志容量管理

借鉴 Claude Code 的四级上下文告警机制，为 Orbit 的日志系统设计分级容量管理：

| 阶段 | 触发条件 | 动作 |
|------|----------|------|
| 正常 | event 总量 < 配置阈值的 70% | 正常记录，无额外操作 |
| 预警 | 70% - 90% | 提示用户存储接近上限，建议导出历史数据 |
| 自动清理 | 90% - 100% | 自动执行 retention 策略：清理过期 crumb、归档 30 天前的非 core 事件 |
| 硬限制 | 100% | 仅保留 core 级事件和 day_note，暂停 crumb 和 audit 级事件写入 |

同时，retention 策略应区分 `retention_class`：`core` 事件长期保留、`crumb` 事件 7-30 天后自动清理、`audit` 事件按合规要求保留。这与 Orbit 方案中的保留策略表一致，但增加了动态容量管理的自动化层。

### 建议四：Agent 读取 Journal 采用"摘要优先 + 受控回查"模式

借鉴 Hermes 的"FTS5 检索 + LLM 摘要"两阶段模式和 Claude Code 的"压缩后恢复预算"，为 Orbit 的 Agent 读取 Journal 设计"摘要优先 + 受控回查"模式：

1. **默认读取 journal_summary**：Agent 在 system prompt 或 memory context 中只注入最近若干天的 journal_summary，消耗固定的 token 预算；
2. **按需回查 action_log**：当 Agent 需要更多细节时（如用户追问"那天具体做了什么"），允许 Agent 调用 `journal.get_day` 工具获取 action_log 层，但设置每次回查的条目上限（类似 Claude Code 的 `POST_COMPACT_MAX_FILES_TO_RESTORE = 5`）；
3. **极少数场景读取 event**：仅在需要精确重建事件链路时，Agent 可调用 `event.query` 工具，但必须指定 object_uid 或时间范围，禁止无条件全量读取；
4. **密封内容永不可达**：无论 Agent 处于哪一级读取，`sealed` 标记的内容始终不可见。

这种分级读取既保护了用户隐私，又避免了 Agent 上下文被大量原始事件淹没。

### 建议五：技术诊断日志采用 OTel 标准，彻底与用户日志解耦

借鉴 Claude Code 的 OpenTelemetry 集成方案，Orbit 的第三条日志管线（技术诊断日志）应直接采用 OTel SDK：

- **Metrics**：用 OTel Counter/Histogram 记录 API 延迟、event 写入耗时、摘要生成耗时、错误计数；
- **Traces**：用 OTel Span 追踪"event 写入 → action_log 物化 → summary 生成"的完整链路，便于排查性能瓶颈；
- **Logs**：用 OTel LogRecord 记录崩溃、异常、队列积压等诊断信息。

OTel 数据通过独立的 Exporter 发送到可选的监控后端（如用户自建的 Grafana 或 Orbit 官方的匿名遥测服务），与用户行为日志管线在代码层面和数据流层面完全隔离。这样 Orbit 的"技术诊断日志不进入 Journal、不可给 Agent"的规则可以通过架构强制执行，而非依赖运行时检查。

---

## 6. 总结

Hermes 和 Claude Code 虽然都不具备 Orbit Journal 这样面向普通用户的"事实时间层"概念，但它们在底层基础设施层面提供了丰富的实现参考：

- **Hermes** 的贡献集中在**存储与查询层**——SQLite + FTS5 的全文搜索、会话谱系的压缩溯源、结构化摘要模板、跨会话的"检索 + LLM 摘要"两阶段模式、以及记忆写入的安全扫描机制。这些都是 Orbit event/action_log/summary 三层数据流动的底层支撑能力。

- **Claude Code** 的贡献集中在**运行时管理与标准化**——分级上下文告警的容量管理思路、JSONL transcript 的轻量持久化、多层配置叠加的策略管理范式、OpenTelemetry 的标准化遥测集成、以及压缩后恢复预算的上下文智能管理。这些更多启发 Orbit 日志系统的运维层面和隐私策略实现。

两个项目均**不适用**的部分也很明显：Hermes 的单体架构耦合和外部记忆插件生态与 Orbit 的 local-first 隐私模型冲突，Claude Code 的 Anthropic 深度绑定和轻量 JSONL 主存储不满足 Orbit 的多模型适配和复杂查询需求。

总体而言，Orbit 的全局日志与 Journal 系统在概念层面远超两个对标项目——它不仅是开发者工具的对话历史管理，而是一个完整的**个人工作事实基础设施**。两个项目的实现经验可以加速 Orbit 在存储引擎、容量管理、摘要生成、Agent 读取策略和遥测隔离等工程层面的落地，但 Journal 的核心体验（Day Note、Action Timeline、Behavior Insight、隐私分级的用户控制）仍需要 Orbit 自己原创设计，因为这些在现有 AI Agent 生态中尚无成熟先例。
