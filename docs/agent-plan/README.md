# Orbit Agent 架构开发计划

> **基于 20 篇 Hermes/Claude Code 调研文档**，结合 Orbit 现有 `@orbit/agent-core` 代码库（~1584 行），规划从当前基础实现到产品级 Agent 系统的完整开发路径。

---

## 一、现状评估

### 当前 @orbit/agent-core 能力

| 模块 | 文件 | 行数 | 成熟度 | 评估 |
|------|------|------|--------|------|
| 类型系统 | `types.ts` | 287 | ⭐⭐⭐ | 类型定义全面（6层记忆、4级风险、4档审批、6种谱系），是好的基础 |
| Orchestrator | `orchestrator.ts` | 371 | ⭐⭐ | 同步 Promise 模式，关键词路由，基础 while 循环 |
| 工具注册表 | `tool-registry.ts` | 165 | ⭐⭐ | 简单 Map 注册，静态风险声明，无并发控制 |
| Safety Gate | `safety-gate.ts` | 139 | ⭐ | 12 条正则 + 风险映射，无责任链/脱敏/审计 |
| 记忆管理 | `memory-manager.ts` | 171 | ⭐ | 纯内存实现，简单字符串匹配，无 FTS |
| 上下文压缩 | `context-compressor.ts` | 149 | ⭐⭐ | 头尾保护 + 中间压缩，但只有一级策略 |
| 领域 Agent | `domain-agents.ts` | 130 | ⭐ | 纯静态配置，无专业化逻辑 |
| LLM 适配器 | `llm-adapter.ts` | 120 | ⭐⭐ | 接口定义清晰，但无流式支持 |

**总评**：类型基础扎实，但执行层全面停留在"最小可行"阶段。需要从"同步请求-响应"全面升级为"异步事件流管道"。

### 与调研结论的差距

| 调研建议 | 当前状态 | 差距 |
|----------|----------|------|
| AsyncGenerator 事件流管道 | 同步 Promise | 🔴 需要架构级重构 |
| 输入敏感行为声明 | 静态 riskLevel/approvalPolicy | 🔴 需重新设计接口 |
| 5层 Safety Gate 责任链 | 12条正则 + 风险映射 | 🔴 需要全面实现 |
| SQLite + FTS5 记忆存储 | InMemoryMemoryStore | 🔴 需持久化方案 |
| 5级压缩 + 恢复预算 | 单级头尾压缩 | 🟡 框架在，需分级 |
| 混合意图路由 | 关键词匹配 | 🟡 需添加 LLM 层 |
| Agent 间通信协议 | 无 | 🔴 需全新设计 |
| 异步任务中心 | 无 | 🔴 需全新设计 |

---

## 二、里程碑总览

```
Phase 0 (P0 基石层)
├── M1: 事件流管道架构 ──────────────────┐
├── M2: 声明式能力注册表 ──────────┐     │
└── M3: Safety Gate 责任链 ────┐   │     │
                                │   │     │
Phase 1 (P1 核心层)             │   │     │
├── M4: 多层记忆系统 ──────────┤   │     │
├── M5: 会话谱系与压缩引擎 ───┤   │     │
└── M6: 混合多 Agent 编排 ────┘   │     │
                                    │     │
Phase 2 (P2 产品层)                 │     │
└── M7: 异步任务与领域 Agent ──────┘─────┘
```

### 依赖关系

```
M1 (事件流) ← M2 (能力注册) ← M3 (Safety Gate)
                    ↑               ↑
                    M6 (多Agent编排) │
                    ↑               │
            M4 (记忆) ← M5 (压缩) ─┘
                    ↑
                    M7 (异步任务 + 领域Agent)
```

| 里程碑 | 标题 | 优先级 | 预计新增/重构代码量 | 依赖 |
|--------|------|--------|-------------------|------|
| **M1** | 事件流管道架构 | P0 | ~1200行 新增 + ~400行 重构 | 无 |
| **M2** | 声明式能力注册表 | P0 | ~800行 新增 + ~300行 重构 | M1 |
| **M3** | Safety Gate 责任链 | P0 | ~900行 新增 + ~150行 重构 | M1, M2 |
| **M4** | 多层记忆系统 | P1 | ~1500行 新增 + ~200行 重构 | M1 |
| **M5** | 会话谱系与压缩引擎 | P1 | ~1000行 新增 + ~150行 重构 | M1, M4 |
| **M6** | 混合多 Agent 编排 | P1 | ~1200行 新增 + ~400行 重构 | M1, M2, M3, M4 |
| **M7** | 异步任务与领域 Agent | P2 | ~2000行 新增 + ~200行 重构 | M1-M6 |

**预计总量**：从 ~1584 行扩展到 ~10,000+ 行的产品级 Agent 系统

---

## 三、各里程碑概述

### M1：事件流管道架构 🔴 P0

**核心变更**：将 Orchestrator.execute() 从 `Promise<Output>` 转为 `AsyncGenerator<TypedEvent>`

- 定义完整事件类型体系（OrchestratorEvent, AgentEvent, CapabilityEvent, SafetyEvent）
- 实现三层 AsyncGenerator 管道（Orchestrator → Agent → Capability）
- AbortController 取消传播
- 保留 execute() 向后兼容

📄 [M1-事件流管道架构.md](./M1-事件流管道架构.md)

### M2：声明式能力注册表 🔴 P0

**核心变更**：ToolRegistry → CapabilityRegistry，支持输入敏感行为声明

- Capability<Input, Output> 泛型接口
- 输入敏感的 riskLevel(input), concurrencySafety(input)
- StreamingCapabilityExecutor 混合并发调度
- MCP Annotations 自动映射
- fail-closed 默认值

📄 [M2-声明式能力注册表.md](./M2-声明式能力注册表.md)

### M3：Safety Gate 责任链 🔴 P0

**核心变更**：从 12 条正则升级为 5 层责任链

- ContextScanner（威胁检测）→ PolicyChecker（能力策略）→ ApprovalEngine（审批判定）→ EgressController（脱敏出境）→ AuditTrail（执行审计）
- 数据出境三态控制（allow/ask/deny）
- 审批暂停-恢复机制
- 凭证脱敏引擎

📄 [M3-SafetyGate责任链.md](./M3-SafetyGate责任链.md)

### M4：多层记忆系统 🟡 P1

**核心变更**：InMemoryMemoryStore → SQLiteMemoryStore + 六层记忆实现

- SQLite + FTS5 持久化存储
- L2 Object Memory（从对象层拉取结构化事实）
- L5 Archive/Search（跨会话搜索 + 摘要回传）
- 智能回忆引擎（多层联合检索 + token 预算分配）
- 记忆注入协议（XML 边界 + 来源标注）

📄 [M4-多层记忆系统.md](./M4-多层记忆系统.md)

### M5：会话谱系与压缩引擎 🟡 P1

**核心变更**：单级压缩 → 五级压缩 + 会话持久化 + 上下文窗口管理

- 会话持久化（SQLite）+ 谱系图查询
- 五级压缩引擎（微压缩 → Turn Summary → Session Summary → Workspace Digest → Lineage Handoff）
- 四级上下文窗口告警
- 50K token 恢复预算
- 混合 token 计算

📄 [M5-会话谱系与压缩引擎.md](./M5-会话谱系与压缩引擎.md)

### M6：混合多 Agent 编排 🟡 P1

**核心变更**：关键词路由 → 混合编排（确定性 + LLM）+ Agent 间通信

- HybridIntentRouter（规则 + LLM 双层路由）
- Coordinator 模式（四阶段工作流）
- AgentMessage 通信协议（对象引用传递）
- IterationBudget 可退还预算
- 子 Agent 隔离（能力裁剪 + 预算独立 + 深度限制）

📄 [M6-混合多Agent编排.md](./M6-混合多Agent编排.md)

### M7：异步任务与领域 Agent 实现 🔵 P2

**核心变更**：静态 Agent 配置 → 7 个专业化 Agent + 异步任务中心

- AsyncJob 数据模型 + TaskScheduler
- 7 个 Agent 的专业化实现（独立执行逻辑、输出格式、协作接口）
- 学习回路（经验提炼 → 候选层 → 审核 → 正式记忆）
- 定时任务支持

📄 [M7-异步任务与领域Agent.md](./M7-异步任务与领域Agent.md)

---

## 四、架构演进路径

### Phase 0 完成后
```
@orbit/agent-core
├── types.ts                 // 扩展事件类型
├── events.ts                // 🆕 事件类型定义
├── orchestrator.ts          // 重构为 AsyncGenerator
├── agent-executor.ts        // 🆕 Agent 执行引擎
├── capability-registry.ts   // 🆕 替代 tool-registry
├── capability-executor.ts   // 🆕 流式能力执行器
├── safety/
│   ├── safety-gate.ts       // 重构为责任链
│   ├── context-scanner.ts   // 🆕 
│   ├── policy-checker.ts    // 🆕
│   ├── approval-engine.ts   // 🆕
│   ├── egress-controller.ts // 🆕
│   └── audit-trail.ts       // 🆕
├── memory-manager.ts        // 保留接口
├── context-compressor.ts    // 保留
├── domain-agents.ts         // 保留
├── llm-adapter.ts           // 扩展流式支持
└── tool-registry.ts         // 标记 deprecated，提供适配层
```

### Phase 1 完成后
```
@orbit/agent-core
├── ...Phase 0 所有文件...
├── memory/
│   ├── memory-manager.ts    // 重构
│   ├── sqlite-store.ts      // 🆕
│   ├── recall-engine.ts     // 🆕
│   └── injection.ts         // 🆕
├── session/
│   ├── session-store.ts     // 🆕
│   ├── lineage-manager.ts   // 🆕
│   └── compression-engine.ts // 🆕 替代 context-compressor
├── orchestration/
│   ├── orchestrator.ts      // 重构
│   ├── intent-router.ts     // 🆕
│   ├── context-assembler.ts // 🆕
│   ├── coordinator.ts       // 🆕
│   ├── agent-messenger.ts   // 🆕
│   └── iteration-budget.ts  // 🆕
```

### Phase 2 完成后（最终形态）
```
@orbit/agent-core
├── ...Phase 0-1 所有文件...
├── tasks/
│   ├── async-job.ts         // 🆕
│   ├── task-scheduler.ts    // 🆕
│   └── checkpoint.ts        // 🆕
├── agents/
│   ├── base-agent.ts        // 🆕
│   ├── planner-agent.ts     // 🆕
│   ├── reader-agent.ts      // 🆕
│   ├── research-agent.ts    // 🆕
│   ├── writing-agent.ts     // 🆕
│   ├── review-agent.ts      // 🆕
│   ├── graph-agent.ts       // 🆕
│   └── ops-agent.ts         // 🆕
├── learning/
│   ├── learning-loop.ts     // 🆕
│   └── candidate-store.ts   // 🆕
```

---

## 五、关键设计原则

贯穿所有里程碑的设计原则：

1. **事件流优先**：所有异步操作通过 AsyncGenerator 事件流暴露，不用回调或轮询
2. **声明即策略**：能力的行为声明直接驱动安全检查和并发调度，无需额外配置
3. **Fail-Closed 安全**：未声明行为的能力默认为最高风险、需审批、独占执行
4. **对象驱动记忆**：记忆的真相来自对象层和用户确认，不是 Agent 自由笔记
5. **可审计可回滚**：每个执行步骤都有结构化审计日志，关键操作可回滚
6. **渐进式迁移**：每个里程碑保持向后兼容，旧接口通过适配层继续工作

---

> 📋 **详细文档目录**
>
> | 里程碑 | 文档 |
> |--------|------|
> | M1 | [M1-事件流管道架构.md](./M1-事件流管道架构.md) |
> | M2 | [M2-声明式能力注册表.md](./M2-声明式能力注册表.md) |
> | M3 | [M3-SafetyGate责任链.md](./M3-SafetyGate责任链.md) |
> | M4 | [M4-多层记忆系统.md](./M4-多层记忆系统.md) |
> | M5 | [M5-会话谱系与压缩引擎.md](./M5-会话谱系与压缩引擎.md) |
> | M6 | [M6-混合多Agent编排.md](./M6-混合多Agent编排.md) |
> | M7 | [M7-异步任务与领域Agent.md](./M7-异步任务与领域Agent.md) |
