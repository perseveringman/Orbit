# Agent Plan 架构审查与改进建议

> **审查日期**：2026-04-10  
> **审查范围**：M1–M7 全部里程碑文档 + 现有 `@orbit/agent-core` 代码  
> **审查前提**：AI 生成代码，无人工时间成本约束；关注架构完整性而非工作量

---

## 一、关键缺失（建议新增里程碑）

### 🔴 P0 — 缺少多 LLM Provider 抽象层

**现状**：`llm-adapter.ts` 仅支持 OpenAI 格式，默认 `gpt-4o`。但计划中多处隐含需要不同模型：

| 使用场景 | 所需模型 | 里程碑 |
|----------|----------|--------|
| 意图路由 | `gpt-4o-mini` / `claude-haiku`（轻量、低延迟） | M6 |
| 上下文压缩摘要 | 需要 LLM 调用生成 summary | M5 |
| 各领域 Agent 执行 | 不同 Agent 可能需要不同模型（推理 vs 速度） | M7 |
| 学习回路经验提炼 | 可能需要高推理能力模型 | M7 |

**问题**：整个计划没有一个里程碑专门处理多 Provider 适配（OpenAI / Anthropic / Google / 本地模型），也没有模型选择策略（根据任务类型自动选模型）。`LLMAdapter` 接口也缺少 `chatCompletionStream()` 流式方法，但 M1 的 `AgentStreamDeltaEvent` 已经定义了流式事件。

**建议**：新增 **M0.5：多 LLM Provider 抽象 + 流式响应支持**，作为 M1 的前置或并行里程碑：

- 扩展 `LLMAdapter` 接口，增加 `chatCompletionStream()` 返回 `AsyncGenerator`
- 定义 `ModelSelector` 策略接口，支持按任务类型 / Agent 域 / 延迟要求自动选模型
- Provider 注册表：OpenAI / Anthropic / Google / 本地模型的统一适配
- 回退链：主 Provider 不可用时自动切换备用

```
新依赖关系：
M0.5 (LLM 抽象) ← M1 (事件流) ← M2, M4 ...
```

---

### 🔴 P0 — 缺少前端事件消费层

**现状**：7 个里程碑全部聚焦 `@orbit/agent-core` 后端，但完全没有涉及前端如何消费 Agent 产出。

**缺失的前端能力**：

| 能力 | 说明 | 关联里程碑 |
|------|------|-----------|
| 事件流传输 | WebSocket / SSE / Electron IPC？ | M1 |
| 审批交互 UI | 暂停-恢复的用户操作界面 | M3 |
| Agent 执行可视化 | 多 Agent 协作时的进度展示 | M6 |
| 异步任务面板 | 后台任务进度、取消、重试 | M7 |
| 跨端推送 | M7 提到跨端同步但无前端方案 | M7 |

**建议**：新增 **M-Frontend：Agent 交互层**，或在每个 M 中增加前端集成子任务。至少需要定义：

1. `@orbit/agent-core` 的事件流如何桥接到 Electron renderer / Web 前端
2. 审批 UI 的交互协议（请求格式、响应格式、超时处理）
3. 事件流的前端状态管理方案（如何映射到 UI 状态）

---

## 二、架构层面问题

### 🔴 缺少统一的可观测性 / Tracing 基础设施

M1 定义了事件流，M3 有审计日志，但缺少统一的 **distributed tracing** 方案。

**问题场景**：M6/M7 的多 Agent 编排出问题时（Coordinator → Research Agent → 子任务 → 工具调用），仅靠事件流的 `runId` 和审计日志很难重建完整的因果链。事件流是"广播"式的，缺少 span 层级的 parent-child 关系。

**建议**：

- 在 `BaseEvent` 中增加 `traceId` + `parentSpanId` 字段（或保持可选）
- 定义 Span 生命周期与事件流的映射关系
- 可选集成 OpenTelemetry SDK（不强制），本地模式下用内存 Tracer

---

### 🔴 M4 的 `better-sqlite3` 与 Orbit 现有 DB 层的集成方案未明确

M4 要引入 `better-sqlite3` 作为记忆存储，M5 要新增 3 张 SQLite 表，但未回答以下关键问题：

| 问题 | 影响 |
|------|------|
| 记忆 DB 与 Orbit 主 DB 是同一文件还是独立文件？ | 影响事务边界、备份策略、迁移复杂度 |
| `@orbit/db-schema` 现有的 migration 机制是什么？M4/M5 的新表如何纳入？ | 影响升级兼容性 |
| Electron 主进程 vs renderer 进程的 DB 访问策略？ | `better-sqlite3` 是原生模块，renderer 进程无法直接使用 |
| `better-sqlite3` 是 peerDependency 还是直接 dependency？ | M4 文档写了 peerDependency，但 agent-core 目前无任何 native 依赖 |

**建议**：在 M4 文档的「存储后端设计」章节补充上述问题的明确决策。

---

### 🟡 缺少全局降级策略矩阵

各里程碑零散提到了 fail-closed、回退链等，但缺少一个统一的降级设计。在产品级系统中，需要明确以下场景的行为：

| 故障场景 | 当前计划中的应对 | 缺失 |
|----------|----------------|------|
| LLM API 全部不可用 | M6 回退到关键词路由 | Agent 执行本身如何降级？仅返回错误？ |
| SQLite 文件损坏 / 不可用 | 无 | 记忆系统应能降级回 InMemory，不阻塞核心功能 |
| 网络完全断开 | 无 | M7 异步任务、M2 MCP 工具的行为？ |
| LLM 返回格式错误 | M6 路由有 JSON 解析回退 | 其他 LLM 调用点（压缩摘要、学习回路）无回退 |
| 审批超时 | 无 | 会话永久 suspended？需要超时策略 |

**建议**：在 README.md 或新增 `DEGRADATION-MATRIX.md` 文档，统一定义各子系统的降级行为。

---

## 三、优先级调整建议

### 🟡 M3 Safety Gate 过度工程化（建议降级为 P1）

M3 设计了 5 层责任链 + 脱敏引擎 + 数据出境控制 + 审计回放。对于一个**尚未上线的产品**，作为 P0 优先级过高：

- 当前 12 条正则 + 基础审批在 MVP 阶段足以覆盖核心安全需求
- 数据出境控制（EgressController）在没有真实外部 MCP 工具接入之前是空转
- 凭证脱敏引擎（RedactionEngine）在 local-first 架构下，数据基本不出境，优先级低
- 5 层责任链的性能基准测试（< 5ms per call）在 MVP 阶段不是瓶颈

**建议拆分**：

| 内容 | 调整后优先级 | 理由 |
|------|-------------|------|
| SafetyChain 框架 + ContextScanner（迁移现有 12 条正则） | 保持 P0 | 架构升级的最小集 |
| CapabilityPolicyChecker（迁移现有 checkCapability） | 保持 P0 | 已有逻辑的重构 |
| ApprovalGate + 暂停-恢复机制 | 保持 P0 | M5/M6 依赖审批恢复 |
| DataEgressController + RedactionEngine | **降为 P1** | 等有真实出境场景再做 |
| AuditTrail + 审计回放 | **降为 P1** | 可先用事件流 + 日志文件替代 |

这样 M3-P0 的工作量从 11-17 天缩减到约 5-7 天，且不影响后续里程碑的依赖。

---

## 四、并行度优化

当前依赖图的隐含约束过强。在 AI 无时间成本的前提下，真正的瓶颈是**集成复杂度**，应最大化并行。

### 当前依赖关系

```
M1 ← M2 ← M3
M1 ← M4 ← M5
M1, M2, M3, M4 ← M6
M1-M6 ← M7
```

### 建议调整后的并行方案

```
Phase 0（可完全并行）:
  M0.5 (LLM 抽象)  ─┐
  M1   (事件流)     ─┤── 三者可并行开发，M1 完成后集成
  M4   (记忆系统)   ─┘   M4 仅依赖 M1 的事件类型定义，可先用 mock

Phase 1（两组并行）:
  组 A: M2 (能力注册) → M3-lite (安全最小集)
  组 B: M5 (压缩引擎)
  ── 组 A 和 组 B 可完全并行

Phase 2:
  M6 (多 Agent 编排) ── 等 Phase 1 完成
  M-Frontend (前端集成) ── 可与 M6 并行

Phase 3:
  M7 (异步任务 + 领域 Agent)
  M3-full (Safety Gate 完整版) ── 与 M7 并行
```

**效果**：原本严格串行的 7 个里程碑，调整为 4 个 Phase，每个 Phase 内部并行。

---

## 五、技术细节问题

### 5.1 M4 — CJK 分词方案不足

当前方案使用 `segmentCJK()` 按字符间插空格：

```typescript
// 当前方案
function segmentCJK(text: string): string {
  return text.replace(/([\u4e00-\u9fff\u3400-\u4dbf])/g, ' $1 ');
}
```

**问题**：这会导致「人工智能」被拆为「人 工 智 能」四个独立 token，搜索「人工智能」需要用 `"人 工 智 能"` 短语匹配，严重影响中文搜索相关性。

**建议**：Orbit 是中英文产品，中文搜索质量是核心体验。直接引入 `jieba-wasm`（~1.5MB，纯 WASM 无 native 依赖）作为初始方案，而非将其留作"未来升级路径"。

### 5.2 M6 — 路由缓存精确匹配过于严格

当前方案：`messageNormalized` 精确匹配 + `surface` 相同 + `anchorType` 相同。

**问题**：「plan my week」和「plan for my week」不会命中缓存，实际上它们应该路由到同一个 Agent。

**建议**：可采用两级缓存：
1. 精确匹配（零成本，命中率低）
2. 简单文本归一化（去停用词 + stemming，命中率高，仍零 LLM 成本）

不需要 embedding 相似度（过重），但至少做基础归一化。

### 5.3 M5 — `messages_json` 作为 TEXT 列的容量风险

`agent_sessions.messages_json` 存储完整消息历史为 JSON TEXT 列。

**问题**：一个长会话（200 条消息，每条含工具调用结果）可能产生 > 1MB 的 JSON。SQLite 单行大 TEXT 列会影响查询性能（即使不 SELECT 该列，page 读取也可能涉及溢出页）。

**建议**：
- 增加 `CHECK(length(messages_json) < 2097152)`（2MB 硬上限）
- 或将消息独立到 `agent_session_messages` 表（M5 文档中已考虑但否决，理由是避免 join。建议重新评估，因为分表后可以按需加载最近 N 条消息）

### 5.4 M7 — 缺少 LLM API Rate Limiting

`TaskScheduler` 管理并发任务执行，但未考虑 LLM API 的速率限制。

**问题**：3 个并发异步任务 + 前台会话 + 路由 LLM 调用 = 同时 5+ 个 LLM 请求。可能触发 OpenAI/Anthropic 的 RPM 限流。

**建议**：在 M0.5（LLM Provider 抽象）中增加全局 rate limiter，所有 LLM 调用经由统一出口。

### 5.5 M1 — 流式响应与事件流的断层

M1 定义了 `AgentStreamDeltaEvent`，但 `LLMAdapter` 接口仅有 `chatCompletion()` 返回完整响应。M1 附录 B 将「LLM 流式响应」列为「不在 M1 范围」，但 M6 的路由层和 M5 的压缩层都需要调用 LLM——如果没有流式支持，用户在等待压缩摘要时将看不到任何进度反馈。

**建议**：将 `LLMAdapter.chatCompletionStream()` 纳入 M1 范围（或 M0.5），避免后续里程碑被迫回头补充。

---

## 六、总结：建议的里程碑调整

| 调整 | 内容 | 理由 |
|------|------|------|
| ➕ 新增 M0.5 | 多 LLM Provider 抽象 + 流式响应 + Rate Limiting | M1/M5/M6/M7 均隐含依赖 |
| ➕ 新增 M-Frontend | 事件流消费 + 审批 UI + Agent 可视化 | 7 个 M 无一涉及前端 |
| ➕ 新增文档 | `DEGRADATION-MATRIX.md` 全局降级策略 | 各 M 零散处理，缺少统一视角 |
| 🔄 拆分 M3 | M3-lite (P0) + M3-full (P1) | 脱敏/出境/审计对 MVP 非必需 |
| 🔄 调整并行度 | 4 Phase 并行方案替代严格串行 | 最大化 AI 产出效率 |
| 🔧 M4 分词 | `jieba-wasm` 替代 `segmentCJK()` | 中文搜索是核心体验 |
| 🔧 M1 流式 | `chatCompletionStream()` 纳入 M1 | 后续 M 不必回头补充 |

---

> 📝 本文档应随各里程碑的实施进展持续更新，每完成一个 M 后回顾此审查中的相关建议是否已解决。
