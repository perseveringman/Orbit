# M6：混合多 Agent 编排 — 深度开发计划

> **里程碑目标**：将 Orchestrator 从"关键词路由 + 简单委派"升级为"混合编排（确定性代码 + LLM 驱动）+ Agent 间通信 + 子 Agent 隔离与预算管控"的产品级多 Agent 协作系统。
>
> **预计新增/重构代码量**：~1200 行新增 + ~400 行重构
>
> **依赖**：M1（事件流管道）、M2（声明式能力注册表）、M3（Safety Gate 责任链）、M4（多层记忆系统）

---

## 目录

- [一、混合意图路由器 (HybridIntentRouter)](#一混合意图路由器-hybridintentrouter)
- [二、Coordinator 模式](#二coordinator-模式)
- [三、Agent 间通信协议 (AgentMessage Protocol)](#三agent-间通信协议-agentmessage-protocol)
- [四、子 Agent 隔离与预算控制](#四子-agent-隔离与预算控制)
- [五、上下文装配器 (ContextAssembler)](#五上下文装配器-contextassembler)
- [六、文件变更清单与测试策略](#六文件变更清单与测试策略)

---

## 一、混合意图路由器 (HybridIntentRouter)

### 1.1 设计动机

当前 `Orchestrator.routeIntent()` 仅有 14 行代码，通过 `KEYWORD_DOMAIN_MAP` 的关键词匹配 + `SURFACE_TO_DEFAULT_DOMAIN` 的 surface 回退实现路由。这种方案有三个根本局限：

1. **无法处理模糊意图**：用户说"帮我整理一下这篇论文的核心观点并生成一个行动计划"，这同时涉及 `reading`、`research`、`planning` 三个领域，关键词匹配会命中第一个匹配的领域（取决于关键词扫描顺序），而非用户真正的主要意图。
2. **无上下文感知**：同样的"分析一下"在 Research Space 应该路由到 `research`，在 Review 界面应该路由到 `review`——当前虽有 surface 回退，但关键词匹配优先，surface 信号被浪费。
3. **无法触发 Coordinator 模式**：当任务需要多 Agent 协作时（"研究竞品后生成对比报告并规划下一步"），需要识别出这是一个复合任务并启用 Coordinator，而非路由到单一 Agent。

### 1.2 三层路由架构

```
用户消息 + Surface + AnchorObjects
         ↓
┌─────────────────────────────────────────────────┐
│  Layer 1: 确定性规则路由（零延迟、零成本）          │
│  ├── 对象类型映射：当前锚定对象类型 → 领域 Agent    │
│  ├── Surface 强绑定：reader → reading（硬规则）     │
│  └── 精确指令匹配："/plan" → planning（显式命令）   │
│                                                    │
│  结果：RouteDecision | null                        │
└──────────────────────┬──────────────────────────────┘
                       │ null（规则无法判定）
                       ↓
┌─────────────────────────────────────────────────┐
│  Layer 2: LLM 辅助语义路由（~200ms、~100 tokens）   │
│  ├── 轻量 LLM 调用（GPT-4o-mini / Claude Haiku）   │
│  ├── 输入：用户消息 + Surface + 锚定对象摘要        │
│  ├── 输出：{ domain, confidence, isComplex }       │
│  └── 判定 isComplex=true 时启用 Coordinator        │
│                                                    │
│  结果：RouteDecision（含置信度）                     │
└──────────────────────┬──────────────────────────────┘
                       │ LLM 调用失败
                       ↓
┌─────────────────────────────────────────────────┐
│  Layer 3: 回退链（保底策略）                        │
│  ├── 关键词匹配（现有 KEYWORD_DOMAIN_MAP）          │
│  └── Surface 默认值（现有 SURFACE_TO_DEFAULT_DOMAIN）│
└─────────────────────────────────────────────────┘
```

### 1.3 确定性规则路由层

确定性路由层不调用 LLM，在纯代码逻辑中完成判定。它处理两类高确定性场景：

**（a）对象类型 → Domain Agent 映射**

当 session 中有 `anchorObjectIds` 时，通过对象类型直接推导最可能的 Agent：

```typescript
// intent-router.ts

const OBJECT_TYPE_DOMAIN_MAP: Record<string, AgentDomain> = {
  'task':        'planning',
  'project':     'planning',
  'milestone':   'planning',
  'article':     'reading',
  'book':        'reading',
  'highlight':   'reading',
  'research':    'research',
  'source':      'research',
  'evidence':    'research',
  'note':        'writing',
  'draft':       'writing',
  'journal':     'writing',
  'annotation':  'review',
  'review':      'review',
  'link':        'graph',
  'collection':  'graph',
};
```

当锚定对象指向 `task` 类型，且用户说"继续"时，无需 LLM 即可确定路由到 `planning`。

**（b）Surface 强绑定规则**

部分 Surface 与 Domain 存在强绑定关系（而非只是"默认值"），当用户未表达跨领域意图时，直接使用强绑定：

```typescript
const SURFACE_STRONG_BINDINGS: Partial<Record<AgentSurface, AgentDomain>> = {
  'reader':      'reading',    // Reader 中大多数操作是阅读相关
  'task-center': 'planning',   // 任务中心几乎全是规划操作
};
```

**（c）显式指令前缀**

用户消息以 `/plan`、`/research`、`/write` 等斜杠命令开头时，直接路由到对应领域：

```typescript
const EXPLICIT_COMMAND_MAP: Record<string, AgentDomain> = {
  '/plan':     'planning',
  '/read':     'reading',
  '/research': 'research',
  '/write':    'writing',
  '/review':   'review',
  '/graph':    'graph',
  '/ops':      'ops',
};
```

### 1.4 LLM 辅助路由层

当确定性规则无法判定时，调用轻量 LLM 进行语义理解。关键设计决策：

**（a）路由 prompt 设计**

```typescript
const ROUTE_SYSTEM_PROMPT = `You are an intent classifier for a personal knowledge management system.
Given a user message, the current surface context, and optionally the anchor object summary,
determine the most appropriate agent domain and whether this is a complex multi-step task.

Available domains:
- planning: Task breakdown, scheduling, prioritization, project management
- reading: Content retrieval, extraction, summarization from existing objects
- research: Information gathering from workspace and external sources, analysis
- writing: Drafting, editing, refining text content
- review: Evaluating content quality, providing structured feedback
- graph: Object relationships, linking, knowledge mapping
- ops: Import, export, sync, maintenance operations

Respond in JSON:
{
  "domain": "<primary domain>",
  "confidence": <0.0-1.0>,
  "isComplex": <true if task requires multiple agents to collaborate>,
  "reasoning": "<one sentence explanation>"
}`;
```

**（b）轻量模型选择**

路由调用必须使用轻量模型（`gpt-4o-mini` 或 `claude-haiku`），原因：
- 路由延迟预算 < 300ms，重量级模型无法满足
- 路由调用在每次用户交互都会触发，token 成本必须极低
- 路由判定的复杂度不需要重量级推理能力

```typescript
interface IntentRouterConfig {
  readonly routeModel: string;           // 默认 'gpt-4o-mini'
  readonly routeMaxTokens: number;       // 默认 150
  readonly routeTemperature: number;     // 默认 0（确定性输出）
  readonly complexityThreshold: number;  // isComplex 判定阈值，默认 0.7
  readonly cacheMaxSize: number;         // 路由缓存最大条目，默认 256
  readonly cacheTTLMs: number;           // 缓存 TTL，默认 300_000（5分钟）
}
```

### 1.5 路由缓存

相似意图在短时间内频繁出现（如用户连续对同一项目提问），每次都调用 LLM 路由是浪费。引入基于 LRU 的路由缓存：

```typescript
interface RouteCacheKey {
  readonly messageNormalized: string;  // 小写 + 去标点 + 截取前 100 字符
  readonly surface: AgentSurface;
  readonly anchorType?: string;        // 锚定对象的类型（如有）
}

interface RouteCacheEntry {
  readonly decision: RouteDecision;
  readonly timestamp: number;
  readonly hitCount: number;
}
```

缓存命中条件：`messageNormalized` 精确匹配 + `surface` 相同 + `anchorType` 相同 + 未过期。缓存不使用模糊匹配（如 embedding 相似度），因为路由缓存的场景是短期内的重复/类似操作，精确匹配足够且零成本。

### 1.6 路由回退链

当 LLM 路由调用失败时（网络超时、API 错误、JSON 解析失败），依次执行回退策略：

```typescript
async route(input: RouteInput): Promise<RouteDecision> {
  // 1. 确定性规则
  const ruleResult = this.ruleRoute(input);
  if (ruleResult) return ruleResult;

  // 2. 缓存查找
  const cached = this.cache.get(this.buildCacheKey(input));
  if (cached) return cached.decision;

  // 3. LLM 路由（带 try-catch）
  try {
    const llmResult = await this.llmRoute(input);
    this.cache.set(this.buildCacheKey(input), llmResult);
    return llmResult;
  } catch {
    // 4. 回退：关键词匹配
    const kwResult = this.keywordRoute(input.message);
    if (kwResult) return { domain: kwResult, confidence: 0.5, isComplex: false };

    // 5. 最终回退：surface 默认
    return {
      domain: SURFACE_TO_DEFAULT_DOMAIN[input.surface],
      confidence: 0.3,
      isComplex: false,
    };
  }
}
```

### 1.7 RouteDecision 接口

```typescript
interface RouteDecision {
  readonly domain: AgentDomain;
  readonly confidence: number;           // 0.0-1.0
  readonly isComplex: boolean;           // true → 启用 Coordinator
  readonly suggestedSubDomains?: readonly AgentDomain[];  // 复合任务的参与领域
  readonly reasoning?: string;           // LLM 的路由理由（调试用）
}
```

### 1.8 HybridIntentRouter 完整接口

```typescript
// intent-router.ts

export interface RouteInput {
  readonly message: string;
  readonly surface: AgentSurface;
  readonly anchorObjectIds: readonly string[];
  readonly anchorObjectTypes?: readonly string[];  // 从对象层解析
  readonly sessionHistory?: readonly AgentMessage[];  // 最近 3 条用于上下文推断
}

export class HybridIntentRouter {
  constructor(config: Partial<IntentRouterConfig>, llm: LLMAdapter);

  /** 主路由入口 */
  async route(input: RouteInput): Promise<RouteDecision>;

  /** 仅确定性规则（测试用） */
  ruleRoute(input: RouteInput): RouteDecision | null;

  /** 仅 LLM 路由（测试用） */
  async llmRoute(input: RouteInput): Promise<RouteDecision>;

  /** 仅关键词回退（测试用） */
  keywordRoute(message: string): AgentDomain | null;

  /** 缓存统计（调试用） */
  getCacheStats(): { size: number; hits: number; misses: number };

  /** 清空缓存 */
  clearCache(): void;
}
```

---

## 二、Coordinator 模式

### 2.1 设计动机

当前 `Orchestrator.execute()` 的执行逻辑是"单 Agent 独占"——路由到一个领域 Agent 后，整个 run 只有该 Agent 在工作。`delegate()` 方法虽然支持委派，但只是简单的嵌套调用，缺少：

- **任务分解能力**：无法将"研究竞品后写对比报告"拆分为 Research 子任务 + Writing 子任务
- **阶段控制**：无法确保 Research 完成后再启动 Writing
- **结果合成**：无法将多个 Agent 的输出整合为统一的响应
- **启动判断**：无法自动识别何时需要多 Agent 协作

Coordinator 模式的核心理念是：**对于复杂任务，引入一个特殊的"协调者"角色，由 LLM 驱动任务分解和阶段编排，但安全检查、预算管控、深度限制由确定性代码控制。**

### 2.2 Coordinator 何时启动

Coordinator 的启动由 HybridIntentRouter 的 `isComplex` 判定驱动：

```typescript
// orchestrator.ts (重构后)

async execute(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const routeDecision = await this.router.route({
    message: input.userMessage,
    surface: input.session.surface,
    anchorObjectIds: input.session.anchorObjectIds,
  });

  if (routeDecision.isComplex) {
    return this.executeCoordinated(input, routeDecision);
  } else {
    return this.executeSingleAgent(input, routeDecision);
  }
}
```

**启动条件（二选一满足即可）**：

1. **LLM 路由判定 `isComplex: true`**：当 LLM 识别出任务需要多个领域 Agent 协作时
2. **显式 Coordinator 指令**：用户消息以 `/coordinate` 或 `/multi` 前缀开头

**不启动条件**（即使任务看似复杂）：

- 预算不足以支撑 Coordinator 额外开销（Coordinator 本身需要 ~500 tokens 用于任务分解）
- 当前深度已达到 `MAX_DEPTH - 1`（Coordinator 内部还需要委派子 Agent）
- Session 已有进行中的 Coordinator run

### 2.3 Coordinator 的系统提示词设计

Coordinator 不是第 8 个领域 Agent，而是一个**元级编排角色**。其系统提示词定义了工作流程规则和约束：

```typescript
const COORDINATOR_SYSTEM_PROMPT = `You are the Coordinator for Orbit, a personal knowledge management system.
Your role is to orchestrate complex tasks that require multiple specialist agents.

## Available Specialist Agents

| Agent    | Strength                       | Can Do                              | Cannot Do                      |
|----------|--------------------------------|--------------------------------------|--------------------------------|
| planning | Task breakdown & scheduling    | Create/update tasks, prioritize      | Execute, delete, external ops  |
| reading  | Content retrieval & summary    | Read objects, extract, search        | Write, delete, external ops    |
| research | Information gathering & analysis | Workspace search, web search, compare | Delete, execute code, external write |
| writing  | Content creation & editing     | Draft, edit, create objects          | Delete, external ops           |
| review   | Quality evaluation & feedback  | Read, annotate, evaluate             | Write, delete, external ops    |
| graph    | Relationship management        | Link, traverse, map relationships    | Delete, external ops           |
| ops      | System operations              | Import, export, sync, maintenance    | Execute arbitrary code         |

## Your Workflow

You work in four phases:

### Phase 1: Research (Gather)
- Identify what information is needed to complete the task
- Delegate to 'research' and/or 'reading' agents to gather context
- Multiple research tasks can run in parallel if independent

### Phase 2: Synthesis (Analyze)
- Analyze the gathered information
- Identify patterns, conflicts, or gaps
- Determine the best approach for implementation

### Phase 3: Implementation (Execute)
- Delegate specific subtasks to the appropriate specialist agents
- Each subtask should be self-contained with clear deliverables
- Provide each agent with the relevant context from Phase 1-2

### Phase 4: Verification (Check)
- Review the outputs from all agents
- Ensure consistency and completeness
- Delegate to 'review' agent if quality check is needed

## Rules

1. ALWAYS decompose the task before executing. Never skip Phase 1.
2. Each subtask delegation MUST specify: target agent, task description, relevant object IDs, expected output format.
3. You CANNOT perform domain tasks yourself. You can only delegate and synthesize.
4. Respect agent boundaries—do not ask an agent to perform tasks outside its capabilities.
5. If a subtask fails, decide whether to retry with adjusted parameters or proceed without it.
6. Your final response must synthesize all agent outputs into a coherent answer for the user.
7. Minimize the number of delegations—prefer batching related queries to the same agent.

## Communication Format

When delegating, use the delegate_task tool with:
{
  "targetDomain": "<agent domain>",
  "task": "<clear task description>",
  "contextObjectIds": ["<relevant object IDs>"],
  "expectedOutput": "<what the agent should return>",
  "priority": "high|normal|low",
  "dependsOn": ["<previous subtask IDs if sequential>"]
}

When synthesizing results, structure your response as:
1. Executive summary (2-3 sentences)
2. Detailed findings/outputs from each agent
3. Recommendations or next steps
`;
```

### 2.4 四阶段工作流实现

Coordinator 的四阶段工作流由 LLM 自然语言驱动，但每个阶段的边界由确定性代码控制：

```typescript
// coordinator.ts

export interface CoordinatorConfig {
  readonly maxSubTasks: number;             // 单次 Coordinator run 最大子任务数，默认 8
  readonly maxParallelDelegations: number;  // 最大并发委派数，默认 3
  readonly phaseTimeoutMs: number;          // 每阶段超时，默认 60_000
  readonly synthesisModel: string;          // 合成阶段使用的模型，默认同主模型
}

interface SubTask {
  readonly id: string;
  readonly targetDomain: AgentDomain;
  readonly task: string;
  readonly contextObjectIds: readonly string[];
  readonly expectedOutput: string;
  readonly priority: 'high' | 'normal' | 'low';
  readonly dependsOn: readonly string[];
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly result?: string;
}

export class Coordinator {
  constructor(
    config: Partial<CoordinatorConfig>,
    orchestrator: Orchestrator,
    llm: LLMAdapter,
    budget: IterationBudget,
  );

  /**
   * 执行协调流程：
   * 1. 调用 LLM 进行任务分解 → SubTask[]
   * 2. 按依赖关系拓扑排序
   * 3. 并发/串行执行子任务（通过 Orchestrator.delegate）
   * 4. 收集结果，调用 LLM 合成最终响应
   */
  async execute(input: CoordinatorInput): Promise<CoordinatorOutput>;
}
```

**阶段执行流程**：

```
Phase 1: Research
├── LLM 分析任务，输出 research 类型的 SubTask[]
├── 确定性检查：每个 SubTask 的 targetDomain 是否合法
├── 并发执行独立的 research/reading 子任务
└── 收集结果，存入 SubTask.result

Phase 2: Synthesis
├── LLM 接收所有 Phase 1 结果
├── 分析信息，识别模式/冲突/缺口
└── 输出 implementation 类型的 SubTask[]（或直接输出结论）

Phase 3: Implementation
├── 确定性检查：子任务预算是否充足
├── 按依赖拓扑排序执行
├── 每个子任务通过 delegate() 执行
└── 收集结果

Phase 4: Verification
├── LLM 审查所有输出的一致性和完整性
├── 如需要，委派 review Agent 做质量检查
└── 合成最终响应
```

### 2.5 任务分解与依赖管理

LLM 驱动的任务分解通过一个专用 tool（`decompose_task`）实现，而非纯文本输出。这确保了分解结果的结构化：

```typescript
const DECOMPOSE_TASK_TOOL: ToolDefinition = {
  name: 'decompose_task',
  domain: 'planning',
  description: 'Break down a complex task into subtasks with dependencies',
  inputSchema: {
    type: 'object',
    properties: {
      subtasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id:              { type: 'string' },
            targetDomain:    { type: 'string', enum: AGENT_DOMAINS },
            task:            { type: 'string' },
            contextObjectIds:{ type: 'array', items: { type: 'string' } },
            expectedOutput:  { type: 'string' },
            priority:        { type: 'string', enum: ['high', 'normal', 'low'] },
            dependsOn:       { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'targetDomain', 'task', 'expectedOutput'],
        },
      },
    },
    required: ['subtasks'],
  },
  riskLevel: 'R0-read',
  approvalPolicy: 'A0-auto',
  executionMode: 'sync',
  scopeLimit: 'workspace',
  dataBoundary: 'local-only',
};
```

**依赖管理**通过拓扑排序实现：

```typescript
function topologicalSort(subtasks: SubTask[]): SubTask[][] {
  // 返回分层数组：每一层的任务可以并发执行
  // 第一层：无依赖的任务
  // 第二层：只依赖第一层任务的任务
  // ...
  const layers: SubTask[][] = [];
  const completed = new Set<string>();
  const remaining = [...subtasks];

  while (remaining.length > 0) {
    const layer = remaining.filter(t =>
      t.dependsOn.every(dep => completed.has(dep))
    );
    if (layer.length === 0) {
      throw new Error('Circular dependency detected in subtasks');
    }
    layers.push(layer);
    for (const t of layer) {
      completed.add(t.id);
      remaining.splice(remaining.indexOf(t), 1);
    }
  }
  return layers;
}
```

**关键约束（确定性代码控制）**：

- 子任务总数不超过 `maxSubTasks`（默认 8）
- 每一层并发数不超过 `maxParallelDelegations`（默认 3）
- 循环依赖检测：拓扑排序发现循环时立即中止
- 单个子任务的 token 预算 = 总预算 / 子任务数 × 权重（high=1.5, normal=1.0, low=0.5）

### 2.6 CoordinatorInput / CoordinatorOutput 接口

```typescript
interface CoordinatorInput {
  readonly session: AgentSession;
  readonly userMessage: string;
  readonly routeDecision: RouteDecision;
  readonly availableContext: readonly MemoryEntry[];
  readonly budget: IterationBudget;
}

interface CoordinatorOutput {
  readonly run: AgentRun;
  readonly responseMessage: AgentMessage;
  readonly subtaskRuns: readonly AgentRun[];
  readonly objectMutations: readonly string[];
  readonly pendingApprovals: readonly ApprovalRequest[];
  readonly phases: readonly PhaseRecord[];
}

interface PhaseRecord {
  readonly phase: 'research' | 'synthesis' | 'implementation' | 'verification';
  readonly startedAt: string;
  readonly completedAt: string;
  readonly subtaskIds: readonly string[];
  readonly tokenUsage: TokenUsage;
}
```

---

## 三、Agent 间通信协议 (AgentMessage Protocol)

### 3.1 设计动机

当前 `delegate()` 方法的通信模式是"单向投递 + 同步等待"——父 Agent 向子 Agent 发送任务描述（纯文本字符串），同步等待子 Agent 完成后获取 `AgentRun`。这种方式的局限：

1. **无中间状态通知**：Research Agent 发现关键发现时无法立即通知 Planner Agent
2. **无结构化数据传递**：Agent 间传递的是纯文本，无法传递对象引用、证据包等结构化数据
3. **无广播能力**：当 Coordinator 需要通知所有活跃子 Agent"取消当前任务"时，无法一次性广播
4. **子 Agent 无法主动报告**：子 Agent 完成时只能通过返回值被动地被父 Agent 发现

### 3.2 AgentMessage 类型定义

设计四种通信消息类型，覆盖 Agent 间协作的所有场景：

```typescript
// agent-messenger.ts

/** Agent 间通信消息类型 */
export const INTER_AGENT_MESSAGE_TYPES = [
  'task_request',        // 任务委派请求
  'evidence_pack',       // 证据/研究结果传递
  'approval_response',   // 审批结果通知
  'status_notification', // 状态变更通知
] as const;
export type InterAgentMessageType = (typeof INTER_AGENT_MESSAGE_TYPES)[number];

/** Agent 间通信消息 */
export interface InterAgentMessage {
  readonly id: string;
  readonly type: InterAgentMessageType;
  readonly from: AgentAddress;
  readonly to: AgentAddress;
  readonly payload: InterAgentPayload;
  readonly correlationId?: string;   // 关联的原始消息 ID（用于请求-响应对）
  readonly timestamp: string;
}

/** Agent 寻址 */
export type AgentAddress =
  | { readonly kind: 'agent'; readonly runId: string; readonly domain: AgentDomain }
  | { readonly kind: 'coordinator'; readonly runId: string }
  | { readonly kind: 'broadcast' };

/** 消息负载（联合类型） */
export type InterAgentPayload =
  | TaskRequestPayload
  | EvidencePackPayload
  | ApprovalResponsePayload
  | StatusNotificationPayload;
```

### 3.3 各消息类型详细定义

**（a）TaskRequestPayload — 任务委派请求**

Coordinator 或父 Agent 向子 Agent 发送任务委派请求：

```typescript
interface TaskRequestPayload {
  readonly type: 'task_request';
  readonly task: string;                          // 任务描述
  readonly objectRefs: readonly ObjectRef[];       // 相关对象引用
  readonly expectedOutput: string;                 // 期望的输出格式
  readonly constraints: TaskConstraints;           // 约束条件
}

interface ObjectRef {
  readonly objectId: string;
  readonly objectType: string;
  readonly summary: string;           // 对象摘要（避免子 Agent 重新读取）
  readonly operation: 'read' | 'write' | 'analyze';  // 期望的操作
}

interface TaskConstraints {
  readonly maxTokens?: number;
  readonly maxIterations?: number;
  readonly deadline?: string;          // ISO 8601 超时时间
  readonly requiredCapabilities?: readonly string[];
}
```

**（b）EvidencePackPayload — 证据包传递**

Research Agent 或 Reading Agent 将研究结果打包发送给请求者：

```typescript
interface EvidencePackPayload {
  readonly type: 'evidence_pack';
  readonly findings: readonly Finding[];
  readonly sourceObjectIds: readonly string[];
  readonly confidence: number;          // 整体置信度 0.0-1.0
  readonly summary: string;             // 证据包摘要
}

interface Finding {
  readonly id: string;
  readonly claim: string;               // 发现的核心主张
  readonly evidence: string;            // 支撑证据
  readonly sourceObjectId?: string;     // 来源对象
  readonly sourceUrl?: string;          // 外部来源 URL
  readonly confidence: number;          // 单条置信度
}
```

**（c）ApprovalResponsePayload — 审批结果通知**

Safety Gate 处理审批后，将结果回传给等待中的 Agent：

```typescript
interface ApprovalResponsePayload {
  readonly type: 'approval_response';
  readonly approvalRequestId: string;
  readonly decision: 'approved' | 'rejected' | 'expired';
  readonly reason?: string;
  readonly constraints?: Record<string, unknown>;  // 审批附加约束（如"只允许读取前 100 条"）
}
```

**（d）StatusNotificationPayload — 状态变更通知**

Agent 主动通知其状态变更（完成、失败、需要帮助）：

```typescript
interface StatusNotificationPayload {
  readonly type: 'status_notification';
  readonly status: 'completed' | 'failed' | 'blocked' | 'progress';
  readonly progress?: number;           // 0.0-1.0 进度（如有）
  readonly resultSummary?: string;      // 完成/失败时的结果摘要
  readonly error?: string;              // 失败原因
  readonly needsHelp?: string;          // 需要其他 Agent 协助的描述
}
```

### 3.4 对象引用传递机制

Agent 间通信的核心原则是**传递对象引用而非原始内容**。当 Research Agent 要将一篇文章的分析结果传给 Writing Agent 时，不是把全文复制到消息中，而是传递 `ObjectRef`：

```typescript
// 错误示范：传递原始内容
{
  type: 'evidence_pack',
  findings: [{ claim: '...', evidence: '<整篇文章全文，5000 字>' }]
}

// 正确做法：传递对象引用 + 摘要
{
  type: 'evidence_pack',
  findings: [{ claim: '...', evidence: '关键段落摘要', sourceObjectId: 'obj_abc123' }],
  sourceObjectIds: ['obj_abc123'],
  summary: '该文章的 3 个核心观点是...'
}
```

这样做的好处：
- **节省 token**：摘要通常只有原文的 1/10
- **保持一致性**：多个 Agent 引用同一对象时指向同一真相来源
- **支持延迟加载**：接收方 Agent 可以按需通过 `read-object` 能力回读原文

### 3.5 语义寻址与广播

**语义寻址**：消息的 `to` 字段支持按 Agent 域名 + runId 精确寻址：

```typescript
// 精确发送给某个正在运行的 Research Agent
const msg: InterAgentMessage = {
  id: generateId('iam'),
  type: 'task_request',
  from: { kind: 'coordinator', runId: 'run_coord_001' },
  to: { kind: 'agent', runId: 'run_research_002', domain: 'research' },
  payload: { /* ... */ },
  timestamp: new Date().toISOString(),
};
```

**广播**：Coordinator 需要通知所有活跃子 Agent 时使用 `broadcast`：

```typescript
// 广播取消通知
const cancelMsg: InterAgentMessage = {
  id: generateId('iam'),
  type: 'status_notification',
  from: { kind: 'coordinator', runId: 'run_coord_001' },
  to: { kind: 'broadcast' },
  payload: {
    type: 'status_notification',
    status: 'failed',
    error: 'Task cancelled by user',
  },
  timestamp: new Date().toISOString(),
};
```

### 3.6 通过 Orchestrator 中转路由

Agent 间的消息**不直接传递**，而是通过 `AgentMessenger` 中转。这是为了：

1. **审计追踪**：所有 Agent 间消息都经过中心节点，便于记录完整的通信日志
2. **安全拦截**：中转路由可以检查消息内容是否包含敏感数据
3. **预算计量**：消息传递本身消耗 token（摘要生成等），需要从总预算中扣减

```typescript
// agent-messenger.ts

export class AgentMessenger {
  private readonly activeAgents: Map<string, AgentRunHandle>;
  private readonly messageLog: InterAgentMessage[];

  constructor(safety: SafetyGate);

  /** 注册一个活跃的 Agent Run */
  registerAgent(runId: string, domain: AgentDomain): void;

  /** 注销（Agent 完成或失败时） */
  unregisterAgent(runId: string): void;

  /** 发送消息（中转路由） */
  async send(message: InterAgentMessage): Promise<void>;

  /** 获取某个 Agent 的待处理消息 */
  getInbox(runId: string): readonly InterAgentMessage[];

  /** 获取完整的消息日志（审计用） */
  getMessageLog(): readonly InterAgentMessage[];
}
```

### 3.7 Worker 完成后主动通知

借鉴 Claude Code 的 `<task-notification>` 模式，子 Agent 完成任务后主动发送结构化通知：

```typescript
/**
 * Worker Agent 完成时自动发送的通知格式
 * 注入到 Worker 的 system prompt 末尾
 */
const WORKER_COMPLETION_INSTRUCTION = `
When you complete your assigned task, structure your final response as:

<task-notification>
  <status>completed</status>
  <summary>Brief summary of what was accomplished</summary>
  <outputs>
    <output type="object_ref" id="obj_xxx">Description of created/modified object</output>
    <output type="finding">Key finding or conclusion</output>
  </outputs>
  <suggestions>
    <suggestion>Optional suggestion for follow-up actions</suggestion>
  </suggestions>
</task-notification>

If you cannot complete the task:

<task-notification>
  <status>failed</status>
  <reason>Why the task could not be completed</reason>
  <partial-results>Any partial results that may still be useful</partial-results>
  <needs-help>What additional information or capabilities would be needed</needs-help>
</task-notification>
`;
```

Orchestrator 解析子 Agent 的最终输出时，检测 `<task-notification>` XML 标记并自动转换为 `StatusNotificationPayload`，发送给 Coordinator。

---

## 四、子 Agent 隔离与预算控制

### 4.1 设计动机

当前 `delegate()` 的隔离机制极其薄弱——子 Agent 使用与父 Agent 相同的 `ToolRegistry`、`MemoryManager`、`SafetyGate` 实例，只有 `lineage` 字段标记了委派关系。问题：

1. **能力泄漏**：子 Agent 可以访问父 Agent 的所有工具，无能力裁剪
2. **预算失控**：子 Agent 可以消耗无限 token，无独立预算
3. **深度失控**：子 Agent 可以无限嵌套 delegate()，无深度检查
4. **上下文污染**：子 Agent 继承父 Agent 的 session messages，而非空上下文启动

### 4.2 子 Agent 创建协议

每个子 Agent 的创建必须遵循严格的隔离协议：

```typescript
// orchestrator.ts (重构后)

interface DelegateOptions {
  readonly targetDomain: AgentDomain;
  readonly task: string;
  readonly contextObjectIds: readonly string[];
  readonly parentRunId: string;
  readonly parentDepth: number;
  readonly budget: IterationBudget;
  readonly capabilityOverrides?: {
    readonly additionalAllowed?: readonly string[];
    readonly additionalBlocked?: readonly string[];
  };
}

async delegateIsolated(options: DelegateOptions): Promise<AgentRun> {
  // 1. 深度检查
  const maxDepth = this.dynamicMaxDepth(options.budget);
  if (options.parentDepth >= maxDepth) {
    throw new DelegationDepthExceededError(options.parentDepth, maxDepth);
  }

  // 2. 并发检查
  const activeChildren = this.getActiveChildRuns(options.parentRunId);
  if (activeChildren.length >= this.config.maxConcurrentDelegations) {
    throw new ConcurrencyLimitError(activeChildren.length);
  }

  // 3. 子预算分配
  const childBudget = options.budget.allocateChild({
    maxTokens: Math.floor(options.budget.remainingTokens * 0.4),
    maxIterations: Math.min(
      DOMAIN_AGENT_CONFIGS[options.targetDomain].maxIterations,
      options.budget.remainingIterations - 2  // 预留 2 次给父 Agent 合成
    ),
  });

  // 4. 能力裁剪
  const domainConfig = DOMAIN_AGENT_CONFIGS[options.targetDomain];
  const allowedTools = this.registry.getDefinitions({
    domain: options.targetDomain,
    allowList: domainConfig.allowedCapabilities,
    blockList: [
      ...domainConfig.blockedCapabilities,
      ...DELEGATE_BLOCKED_CAPABILITIES,   // 子 Agent 额外禁止的能力
      ...(options.capabilityOverrides?.additionalBlocked ?? []),
    ],
  });

  // 5. 空上下文启动 + 聚焦 system prompt
  const childSession: AgentSession = {
    id: generateId('ses'),
    workspaceId: input.session.workspaceId,
    surface: input.session.surface,
    anchorObjectIds: options.contextObjectIds,
    lineage: [{ type: 'delegated_from', sourceId: options.parentRunId }],
    status: 'active',
    messages: [],  // 空上下文！不继承父 Agent 的对话历史
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 6. 执行（带独立预算监控）
  const output = await this.executeWithBudget(
    { session: childSession, userMessage: options.task, availableContext: [] },
    childBudget,
    allowedTools,
    options.parentDepth + 1,
  );

  // 7. 退还未用预算给父 Agent
  options.budget.refundChild(childBudget);

  return output.run;
}
```

### 4.3 子 Agent 额外禁止的能力

借鉴 Hermes 的 `DELEGATE_BLOCKED_TOOLS`，子 Agent 在领域能力裁剪的基础上，额外禁止以下能力：

```typescript
const DELEGATE_BLOCKED_CAPABILITIES = [
  'delegate_task',       // 子 Agent 不能再委派（防止无限嵌套）—— 注意在 depth < maxDepth-1 时可放开
  'send_message',        // 子 Agent 不能直接发送 Agent 间消息（通过 task-notification 被动回传）
  'memory_write',        // 子 Agent 不能写入长期记忆（避免污染）
  'approve_request',     // 子 Agent 不能审批其他 Agent 的请求
  'session_create',      // 子 Agent 不能创建新 session
] as const;
```

**例外**：当 `parentDepth < maxDepth - 1` 时，可以有条件地放开 `delegate_task`，允许子 Agent 再委派一级（但孙子 Agent 绝对不可再委派）。

### 4.4 IterationBudget 实现

IterationBudget 是预算管控的核心数据结构，管理 token 消耗和迭代次数：

```typescript
// iteration-budget.ts

export interface BudgetConfig {
  readonly maxTokens: number;          // 总 token 预算
  readonly maxIterations: number;      // 总迭代上限
  readonly warningThreshold: number;   // 告警阈值（占比），默认 0.7
  readonly compactThreshold: number;   // 自动压缩阈值（占比），默认 0.85
  readonly abortThreshold: number;     // 中止阈值（占比），默认 0.95
}

export type BudgetAlertLevel = 'normal' | 'warning' | 'autoCompact' | 'abort';

export interface BudgetSnapshot {
  readonly totalTokens: number;
  readonly usedTokens: number;
  readonly remainingTokens: number;
  readonly totalIterations: number;
  readonly usedIterations: number;
  readonly remainingIterations: number;
  readonly alertLevel: BudgetAlertLevel;
  readonly childAllocations: readonly ChildBudgetAllocation[];
}

interface ChildBudgetAllocation {
  readonly childRunId: string;
  readonly allocatedTokens: number;
  readonly usedTokens: number;
  readonly returned: boolean;
}

export class IterationBudget {
  private usedTokens: number = 0;
  private usedIterations: number = 0;
  private readonly children: Map<string, ChildBudgetAllocation> = new Map();

  constructor(private readonly config: BudgetConfig);

  /** 消耗 token（每次 LLM 调用后调用） */
  consume(tokens: number, iterations: number = 1): void {
    this.usedTokens += tokens;
    this.usedIterations += iterations;
  }

  /** 退还 token（审批拒绝或子 Agent 未用完时） */
  refund(tokens: number, iterations: number = 0): void {
    this.usedTokens = Math.max(0, this.usedTokens - tokens);
    this.usedIterations = Math.max(0, this.usedIterations - iterations);
  }

  /** 为子 Agent 分配独立预算 */
  allocateChild(opts: { maxTokens: number; maxIterations: number }): IterationBudget {
    const childBudget = new IterationBudget({
      maxTokens: opts.maxTokens,
      maxIterations: opts.maxIterations,
      warningThreshold: this.config.warningThreshold,
      compactThreshold: this.config.compactThreshold,
      abortThreshold: this.config.abortThreshold,
    });
    // 从父预算中预扣
    this.usedTokens += opts.maxTokens;
    return childBudget;
  }

  /** 子 Agent 完成后退还未用预算 */
  refundChild(childBudget: IterationBudget): void {
    const unused = childBudget.remainingTokens;
    this.refund(unused);
  }

  /** 当前告警级别 */
  get alertLevel(): BudgetAlertLevel {
    const ratio = this.usedTokens / this.config.maxTokens;
    if (ratio >= this.config.abortThreshold) return 'abort';
    if (ratio >= this.config.compactThreshold) return 'autoCompact';
    if (ratio >= this.config.warningThreshold) return 'warning';
    return 'normal';
  }

  /** 剩余 token */
  get remainingTokens(): number {
    return Math.max(0, this.config.maxTokens - this.usedTokens);
  }

  /** 剩余迭代次数 */
  get remainingIterations(): number {
    return Math.max(0, this.config.maxIterations - this.usedIterations);
  }

  /** 是否可继续执行 */
  get canContinue(): boolean {
    return this.remainingTokens > 0 && this.remainingIterations > 0
      && this.alertLevel !== 'abort';
  }

  /** 获取快照（只读视图） */
  snapshot(): BudgetSnapshot;
}
```

### 4.5 三级预算告警机制

在 Orchestrator 的 agentic loop 中，每次 LLM 调用后检查预算状态：

```typescript
// orchestrator.ts (agentic loop 内)

budget.consume(response.usage.totalTokens);

switch (budget.alertLevel) {
  case 'warning':
    // 注入提示让 LLM 收敛：在下一条系统消息中追加
    conversation.push({
      id: generateId('msg'),
      role: 'system',
      content: '[Budget Warning] You have used 70% of your token budget. '
        + 'Please work towards completing your task efficiently.',
      timestamp: new Date().toISOString(),
    });
    break;

  case 'autoCompact':
    // 触发上下文压缩，释放空间
    const compressed = await this.compressor.compress(
      conversation,
      Math.floor(budget.remainingTokens * 0.6),
      async (text) => this.summarize(text),
    );
    conversation.splice(0, conversation.length, ...compressed.compressedMessages);
    break;

  case 'abort':
    // 强制中止，返回当前已有结果
    run.status = 'failed';
    run.completedAt = new Date().toISOString();
    return {
      run,
      responseMessage: {
        id: generateId('msg'),
        role: 'assistant',
        content: 'I have reached my budget limit. Here is what I was able to accomplish: '
          + this.summarizeSteps(steps),
        timestamp: new Date().toISOString(),
      },
      objectMutations,
      pendingApprovals,
    };
}
```

### 4.6 MAX_DEPTH 动态限制

深度限制不是固定值，而是根据当前预算和任务复杂度动态调整：

```typescript
private dynamicMaxDepth(budget: IterationBudget): number {
  const baseMaxDepth = this.config.maxDelegationDepth; // 默认 2

  // 预算不足时降低深度
  if (budget.remainingTokens < 5000) return 0;      // 不允许委派
  if (budget.remainingTokens < 15000) return 1;      // 最多一级

  // 预算充足时使用配置值
  return baseMaxDepth;
}
```

这确保了预算告急时不会创建新的子 Agent（因为子 Agent 的创建本身也需要消耗 token 用于系统提示词和上下文注入）。

### 4.7 MAX_CONCURRENT 并发控制

并发控制通过 Orchestrator 维护的活跃子 Agent 注册表实现：

```typescript
private readonly activeChildRuns: Map<string, Set<string>> = new Map();
// key: parentRunId, value: Set<childRunId>

private getActiveChildRuns(parentRunId: string): string[] {
  return [...(this.activeChildRuns.get(parentRunId) ?? [])];
}

// 在 delegateIsolated 开始时：
this.activeChildRuns.get(parentRunId)?.add(childRunId);

// 在子 Agent 完成时：
this.activeChildRuns.get(parentRunId)?.delete(childRunId);
```

默认 `MAX_CONCURRENT = 3`，与 Hermes 的 `MAX_CONCURRENT_CHILDREN = 3` 一致。当并发子 Agent 数达到上限时，新的 delegate 请求进入等待队列，直到有子 Agent 完成后释放位置。

### 4.8 子 Agent 输出只回传摘要

借鉴 Hermes 的模式，子 Agent 的完整输出不直接注入父 Agent 的上下文，而是经过摘要压缩后回传：

```typescript
async delegateIsolated(options: DelegateOptions): Promise<DelegateResult> {
  const output = await this.executeWithBudget(/* ... */);

  // 子 Agent 的完整响应
  const fullResponse = output.responseMessage.content;

  // 生成摘要（如果超过阈值）
  const SUMMARY_THRESHOLD = 500; // 字符
  let summary: string;
  if (fullResponse.length <= SUMMARY_THRESHOLD) {
    summary = fullResponse;
  } else {
    summary = await this.summarize(fullResponse);
  }

  return {
    run: output.run,
    summary,
    objectMutations: output.objectMutations,
    fullResponseAvailable: fullResponse.length > SUMMARY_THRESHOLD,
  };
}
```

父 Agent 只在上下文中看到摘要，如果需要详细信息，可以通过 `read-object` 能力回读子 Agent 产生的对象。

---

## 五、上下文装配器 (ContextAssembler)

### 5.1 设计动机

当前 `assembleContext()` 只做了一件事：从 session messages 中取出消息，如果超过阈值就压缩。它完全忽略了：

1. 锚定对象的当前状态（`anchorObjectIds` 没有被使用来拉取对象内容）
2. 记忆层的智能回忆（只是被动接收 `availableContext`，没有主动查询）
3. 相关研究和待办事项的注入
4. 不同类型上下文的优先级和 token 分配

ContextAssembler 将上下文装配从"被动压缩"升级为"主动选择 + 优先级分配 + token 预算管理"。

### 5.2 上下文包的组成

一个完整的上下文包由五个区域组成，每个区域有独立的 token 预算：

```typescript
// context-assembler.ts

interface ContextPackConfig {
  readonly totalBudget: number;           // 总 token 预算（从 LLM 上下文窗口扣除系统提示词后的剩余）
  readonly allocationStrategy: AllocationStrategy;
}

/** 五个上下文区域的 token 预算分配 */
interface AllocationStrategy {
  readonly directive: number;    // 15% — 系统指令 + 用户愿景
  readonly objectState: number;  // 30% — 锚定对象当前状态
  readonly memory: number;       // 20% — 相关记忆（L1-L5）
  readonly research: number;     // 20% — 相关研究/证据
  readonly tasks: number;        // 15% — 相关待办/计划
}

const DEFAULT_ALLOCATION: AllocationStrategy = {
  directive: 0.15,
  objectState: 0.30,
  memory: 0.20,
  research: 0.20,
  tasks: 0.15,
};
```

**五个上下文区域**：

1. **Directive（指令层）**：系统提示词 + 用户全局愿景/偏好（从 L3 User Long-term Memory 拉取）
2. **Object State（对象现状）**：锚定对象的当前内容、元数据、最近修改历史
3. **Memory（相关记忆）**：通过查询 MemoryManager 获取与当前任务相关的多层记忆
4. **Research（研究上下文）**：与当前对象/主题相关的研究笔记、证据、外部引用
5. **Tasks（待办上下文）**：与当前对象/项目相关的任务列表、进度、阻塞项

### 5.3 从对象网络中选取相关上下文的策略

上下文选取的核心挑战是：对象网络可能有数千个对象，如何高效选出与当前任务最相关的对象？

**三级选取策略**：

```
Level 1: 直接引用（零成本）
├── anchorObjectIds 中的对象
├── 用户消息中明确提到的对象
└── 最近 3 条消息中引用的对象

Level 2: 图遍历（低成本）
├── 锚定对象的直接链接对象（1-hop）
├── 同一 project/space 下的相关对象
└── 按对象类型过滤（只拉取与当前 Agent 领域相关的类型）

Level 3: LLM 辅助筛选（高成本，仅在必要时）
├── 当 Level 1+2 返回的对象超过 token 预算时
├── LLM 接收对象列表（ID + 类型 + 标题 + 摘要）
└── 返回排序后的 top-K 对象 ID
```

### 5.4 ContextAssembler 接口

```typescript
// context-assembler.ts

/** 对象状态提供者接口（由上层注入实现） */
export interface ObjectStateProvider {
  getObject(id: string): Promise<ObjectSnapshot | null>;
  getLinkedObjects(id: string, maxHops: number): Promise<readonly ObjectSnapshot[]>;
  getObjectsByProject(projectId: string, limit: number): Promise<readonly ObjectSnapshot[]>;
}

export interface ObjectSnapshot {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly summary: string;
  readonly content?: string;      // 完整内容（可能被截断）
  readonly updatedAt: string;
  readonly linkedObjectIds: readonly string[];
}

export interface AssembleInput {
  readonly session: AgentSession;
  readonly userMessage: string;
  readonly domain: AgentDomain;
  readonly budget: IterationBudget;
}

export interface AssembledContext {
  readonly messages: readonly AgentMessage[];     // 最终的上下文消息数组
  readonly includedObjectIds: readonly string[];  // 被包含的对象 ID（用于审计）
  readonly tokenEstimate: number;                 // 估算的 token 消耗
  readonly allocationUsed: AllocationStrategy;    // 实际使用的分配比例
}

export class ContextAssembler {
  constructor(
    config: Partial<ContextPackConfig>,
    memory: MemoryManager,
    objects: ObjectStateProvider,
    llm: LLMAdapter,
  );

  /** 主入口：为指定 session 和 domain 装配完整上下文 */
  async assemble(input: AssembleInput): Promise<AssembledContext>;

  /** Level 1: 直接引用对象选取 */
  async selectDirectRefs(input: AssembleInput): Promise<readonly ObjectSnapshot[]>;

  /** Level 2: 图遍历扩展 */
  async expandByGraph(
    directRefs: readonly ObjectSnapshot[],
    domain: AgentDomain,
  ): Promise<readonly ObjectSnapshot[]>;

  /** Level 3: LLM 辅助筛选（当对象过多时） */
  async llmFilter(
    candidates: readonly ObjectSnapshot[],
    userMessage: string,
    tokenBudget: number,
  ): Promise<readonly ObjectSnapshot[]>;
}
```

### 5.5 LLM 辅助的上下文选择

当 Level 1 + Level 2 返回的对象总 token 超过 `objectState` 区域预算时，启用 LLM 筛选。LLM 接收一个轻量的对象列表（不含完整内容），输出排序后的 top-K：

```typescript
const CONTEXT_FILTER_PROMPT = `Given the user's task and a list of related objects,
select the most relevant objects that should be included in the agent's context.
Return only the IDs of selected objects, ordered by relevance.

User task: {userMessage}

Available objects:
{objectList}

Token budget: approximately {budgetTokens} tokens.
Select objects whose combined content fits within the budget.
Return JSON: { "selectedIds": ["id1", "id2", ...] }`;
```

此 LLM 调用同样使用轻量模型（`gpt-4o-mini`），且 token 消耗从 `memory` 区域预算中扣减（而非 `objectState` 区域），因为这是一个"辅助决策"而非"内容注入"。

### 5.6 上下文 token 预算分配算法

```typescript
private allocateBudget(totalBudget: number, domain: AgentDomain): AllocationStrategy {
  const base = { ...DEFAULT_ALLOCATION };

  // 按领域微调分配
  switch (domain) {
    case 'research':
      // 研究 Agent 需要更多 research 上下文
      base.research = 0.30;
      base.tasks = 0.05;
      break;
    case 'planning':
      // 规划 Agent 需要更多 tasks 上下文
      base.tasks = 0.30;
      base.research = 0.05;
      break;
    case 'writing':
      // 写作 Agent 需要更多 objectState（当前文档内容）
      base.objectState = 0.40;
      base.tasks = 0.05;
      break;
    case 'reading':
      // 阅读 Agent 几乎只需要对象内容
      base.objectState = 0.50;
      base.memory = 0.10;
      base.research = 0.10;
      base.tasks = 0.05;
      break;
    // ...其他领域使用默认分配
  }

  // 归一化确保总和 = 1.0
  const total = Object.values(base).reduce((s, v) => s + v, 0);
  return Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, v / total])
  ) as AllocationStrategy;
}
```

---

## 六、文件变更清单与测试策略

### 6.1 新增文件清单

M6 涉及的所有新增模块及其位置和接口概述：

```
packages/agent-core/src/orchestration/
├── intent-router.ts          # 🆕 HybridIntentRouter
│   ├── IntentRouterConfig
│   ├── RouteInput
│   ├── RouteDecision
│   └── class HybridIntentRouter
│       ├── route(input): Promise<RouteDecision>
│       ├── ruleRoute(input): RouteDecision | null
│       ├── llmRoute(input): Promise<RouteDecision>
│       ├── keywordRoute(message): AgentDomain | null
│       ├── getCacheStats(): CacheStats
│       └── clearCache(): void
│
├── coordinator.ts            # 🆕 Coordinator 模式
│   ├── CoordinatorConfig
│   ├── CoordinatorInput
│   ├── CoordinatorOutput
│   ├── SubTask
│   ├── PhaseRecord
│   └── class Coordinator
│       ├── execute(input): Promise<CoordinatorOutput>
│       ├── decompose(input): Promise<SubTask[]>
│       ├── executePhase(phase, subtasks): Promise<PhaseRecord>
│       └── synthesize(phases): Promise<AgentMessage>
│
├── agent-messenger.ts        # 🆕 Agent 间通信
│   ├── InterAgentMessageType
│   ├── InterAgentMessage
│   ├── AgentAddress
│   ├── InterAgentPayload (联合类型)
│   │   ├── TaskRequestPayload
│   │   ├── EvidencePackPayload
│   │   ├── ApprovalResponsePayload
│   │   └── StatusNotificationPayload
│   ├── ObjectRef
│   ├── Finding
│   └── class AgentMessenger
│       ├── registerAgent(runId, domain): void
│       ├── unregisterAgent(runId): void
│       ├── send(message): Promise<void>
│       ├── getInbox(runId): InterAgentMessage[]
│       └── getMessageLog(): InterAgentMessage[]
│
├── iteration-budget.ts       # 🆕 预算控制
│   ├── BudgetConfig
│   ├── BudgetAlertLevel
│   ├── BudgetSnapshot
│   └── class IterationBudget
│       ├── consume(tokens, iterations): void
│       ├── refund(tokens, iterations): void
│       ├── allocateChild(opts): IterationBudget
│       ├── refundChild(childBudget): void
│       ├── get alertLevel: BudgetAlertLevel
│       ├── get remainingTokens: number
│       ├── get remainingIterations: number
│       ├── get canContinue: boolean
│       └── snapshot(): BudgetSnapshot
│
└── context-assembler.ts      # 🆕 上下文装配器
    ├── ContextPackConfig
    ├── AllocationStrategy
    ├── ObjectStateProvider (interface)
    ├── ObjectSnapshot
    ├── AssembleInput
    ├── AssembledContext
    └── class ContextAssembler
        ├── assemble(input): Promise<AssembledContext>
        ├── selectDirectRefs(input): Promise<ObjectSnapshot[]>
        ├── expandByGraph(refs, domain): Promise<ObjectSnapshot[]>
        └── llmFilter(candidates, message, budget): Promise<ObjectSnapshot[]>
```

### 6.2 重构文件清单

以下现有文件需要重构以集成 M6 新模块：

```
packages/agent-core/src/
├── orchestrator.ts           # ✏️ 重构
│   ├── 注入 HybridIntentRouter 替代内联 routeIntent()
│   ├── 注入 ContextAssembler 替代内联 assembleContext()
│   ├── 注入 IterationBudget 到 execute() 循环
│   ├── 新增 executeCoordinated() 分支
│   ├── 重构 delegate() → delegateIsolated()（隔离协议）
│   └── 在 agentic loop 中集成三级预算告警
│
├── types.ts                  # ✏️ 扩展
│   ├── 新增 AgentDomain = ... | 'coordinator'  （Coordinator 作为特殊域）
│   ├── 新增 StepKind = ... | 'coordination'    （协调步骤）
│   └── 新增 OrchestratorConfig 扩展字段
│
├── domain-agents.ts          # ✏️ 扩展
│   └── 新增 COORDINATOR_CONFIG: DomainAgentConfig
│       （Coordinator 的系统提示词和能力配置）
│
└── index.ts                  # ✏️ 扩展
    └── 导出所有新增模块
```

### 6.3 接口依赖关系

```
                    ┌─────────────────┐
                    │  Orchestrator   │ (重构)
                    │  (orchestrator  │
                    │   .ts)          │
                    └───┬───┬───┬───┬─┘
                        │   │   │   │
           ┌────────────┘   │   │   └────────────┐
           ▼                ▼   ▼                ▼
  ┌────────────────┐ ┌───────────┐ ┌──────────────┐ ┌──────────────┐
  │ HybridIntent   │ │Coordinator│ │ Iteration    │ │ Context      │
  │ Router         │ │           │ │ Budget       │ │ Assembler    │
  │ (intent-       │ │(coordina- │ │ (iteration-  │ │ (context-    │
  │  router.ts)    │ │ tor.ts)   │ │  budget.ts)  │ │  assembler   │
  └───────┬────────┘ └─────┬─────┘ └──────────────┘ │  .ts)        │
          │                │                          └──────┬───────┘
          │                ▼                                 │
          │        ┌──────────────┐                         │
          │        │ Agent        │ ◄───────────────────────┘
          │        │ Messenger    │   (Coordinator 通过 Messenger
          │        │ (agent-      │    与子 Agent 通信)
          │        │  messenger   │
          │        │  .ts)        │
          │        └──────────────┘
          │
          ▼
    ┌────────────┐
    │ LLMAdapter │ (现有，被 Router 和 Coordinator 共用)
    └────────────┘
```

### 6.4 测试策略

#### 6.4.1 单元测试

每个新模块都需要独立的单元测试，使用 mock 隔离外部依赖：

**（a）HybridIntentRouter 单元测试**

```typescript
// tests/intent-router.test.ts

describe('HybridIntentRouter', () => {
  describe('ruleRoute', () => {
    it('routes by explicit command prefix', () => {
      const result = router.ruleRoute({
        message: '/research quantum computing',
        surface: 'global-chat',
        anchorObjectIds: [],
      });
      expect(result?.domain).toBe('research');
    });

    it('routes by anchor object type', () => {
      const result = router.ruleRoute({
        message: 'continue working',
        surface: 'project',
        anchorObjectIds: ['task_123'],
        anchorObjectTypes: ['task'],
      });
      expect(result?.domain).toBe('planning');
    });

    it('routes by surface strong binding', () => {
      const result = router.ruleRoute({
        message: 'help me with this',   // 无关键词
        surface: 'reader',
        anchorObjectIds: [],
      });
      expect(result?.domain).toBe('reading');
    });

    it('returns null when rules cannot determine', () => {
      const result = router.ruleRoute({
        message: 'what do you think about this?',
        surface: 'global-chat',
        anchorObjectIds: [],
      });
      expect(result).toBeNull();
    });
  });

  describe('llmRoute', () => {
    it('identifies complex multi-agent tasks', async () => {
      mockLLM.mockResponse({
        domain: 'planning',
        confidence: 0.9,
        isComplex: true,
        reasoning: 'Task requires research then planning',
      });
      const result = await router.llmRoute({
        message: '研究竞品后生成对比报告并规划下一步',
        surface: 'project',
        anchorObjectIds: [],
      });
      expect(result.isComplex).toBe(true);
    });
  });

  describe('route (full pipeline)', () => {
    it('falls back to keywords when LLM fails', async () => {
      mockLLM.mockError(new Error('timeout'));
      const result = await router.route({
        message: 'research the latest AI papers',
        surface: 'global-chat',
        anchorObjectIds: [],
      });
      expect(result.domain).toBe('research');
      expect(result.confidence).toBe(0.5);
    });

    it('uses cache on repeated similar queries', async () => {
      await router.route({ message: 'plan my week', surface: 'project', anchorObjectIds: [] });
      await router.route({ message: 'plan my week', surface: 'project', anchorObjectIds: [] });
      expect(mockLLM.callCount).toBe(1); // 第二次命中缓存
    });
  });
});
```

**（b）IterationBudget 单元测试**

```typescript
// tests/iteration-budget.test.ts

describe('IterationBudget', () => {
  it('tracks consumption correctly', () => {
    const budget = new IterationBudget({ maxTokens: 10000, maxIterations: 10, ... });
    budget.consume(3000, 2);
    expect(budget.remainingTokens).toBe(7000);
    expect(budget.remainingIterations).toBe(8);
  });

  it('supports refund', () => {
    const budget = new IterationBudget({ maxTokens: 10000, ... });
    budget.consume(5000);
    budget.refund(2000);
    expect(budget.remainingTokens).toBe(7000);
  });

  it('triggers warning at 70%', () => {
    const budget = new IterationBudget({ maxTokens: 10000, warningThreshold: 0.7, ... });
    budget.consume(7500);
    expect(budget.alertLevel).toBe('warning');
  });

  it('triggers autoCompact at 85%', () => {
    const budget = new IterationBudget({ maxTokens: 10000, compactThreshold: 0.85, ... });
    budget.consume(8600);
    expect(budget.alertLevel).toBe('autoCompact');
  });

  it('triggers abort at 95%', () => {
    const budget = new IterationBudget({ maxTokens: 10000, abortThreshold: 0.95, ... });
    budget.consume(9600);
    expect(budget.alertLevel).toBe('abort');
    expect(budget.canContinue).toBe(false);
  });

  it('allocates child budget and deducts from parent', () => {
    const parent = new IterationBudget({ maxTokens: 10000, maxIterations: 10, ... });
    const child = parent.allocateChild({ maxTokens: 3000, maxIterations: 5 });
    expect(parent.remainingTokens).toBe(7000); // 预扣
    expect(child.remainingTokens).toBe(3000);
  });

  it('refunds unused child budget to parent', () => {
    const parent = new IterationBudget({ maxTokens: 10000, maxIterations: 10, ... });
    const child = parent.allocateChild({ maxTokens: 3000, maxIterations: 5 });
    child.consume(1000, 2);
    parent.refundChild(child);
    expect(parent.remainingTokens).toBe(9000); // 7000 + 2000 退还
  });
});
```

**（c）AgentMessenger 单元测试**

```typescript
// tests/agent-messenger.test.ts

describe('AgentMessenger', () => {
  it('routes messages to registered agents', async () => {
    messenger.registerAgent('run_001', 'research');
    await messenger.send({
      id: 'msg_001',
      type: 'task_request',
      from: { kind: 'coordinator', runId: 'run_coord' },
      to: { kind: 'agent', runId: 'run_001', domain: 'research' },
      payload: { type: 'task_request', task: 'find papers', ... },
      timestamp: new Date().toISOString(),
    });
    expect(messenger.getInbox('run_001')).toHaveLength(1);
  });

  it('broadcasts to all registered agents', async () => {
    messenger.registerAgent('run_001', 'research');
    messenger.registerAgent('run_002', 'writing');
    await messenger.send({
      id: 'msg_002',
      type: 'status_notification',
      from: { kind: 'coordinator', runId: 'run_coord' },
      to: { kind: 'broadcast' },
      payload: { type: 'status_notification', status: 'failed', error: 'cancelled' },
      timestamp: new Date().toISOString(),
    });
    expect(messenger.getInbox('run_001')).toHaveLength(1);
    expect(messenger.getInbox('run_002')).toHaveLength(1);
  });

  it('ignores messages to unregistered agents', async () => {
    await messenger.send({
      id: 'msg_003',
      type: 'task_request',
      from: { kind: 'coordinator', runId: 'run_coord' },
      to: { kind: 'agent', runId: 'run_nonexistent', domain: 'research' },
      payload: { type: 'task_request', task: '...', ... },
      timestamp: new Date().toISOString(),
    });
    // 不抛错，消息被记录到日志但不投递
    expect(messenger.getMessageLog()).toHaveLength(1);
  });

  it('maintains ordered message log for audit', async () => {
    messenger.registerAgent('run_001', 'research');
    await messenger.send(/* msg1 */);
    await messenger.send(/* msg2 */);
    const log = messenger.getMessageLog();
    expect(log).toHaveLength(2);
    expect(log[0].timestamp <= log[1].timestamp).toBe(true);
  });
});
```

#### 6.4.2 多 Agent 协作集成测试

集成测试验证多个模块的协同工作，使用真实（但 mock LLM 响应的）Orchestrator 实例：

```typescript
// tests/multi-agent-integration.test.ts

describe('Multi-Agent Collaboration', () => {
  let orchestrator: Orchestrator;
  let mockLLM: MockLLMAdapter;

  beforeEach(() => {
    mockLLM = new MockLLMAdapter();
    orchestrator = new Orchestrator(
      { maxDelegationDepth: 2, maxConcurrentDelegations: 3 },
      registry,
      memoryManager,
      safetyGate,
      mockLLM,
    );
  });

  it('delegates from planning to research and back', async () => {
    // Mock: Planner 决定需要 research，调用 delegate_task
    mockLLM
      .onCall(0).respond({ toolCalls: [{ name: 'delegate_task', args: { domain: 'research', task: '...' } }] })
      // Research Agent 的响应
      .onCall(1).respond({ content: '<task-notification><status>completed</status>...</task-notification>' })
      // Planner 收到结果后完成
      .onCall(2).respond({ content: 'Based on the research, here is the plan...' });

    const output = await orchestrator.execute({
      session: testSession,
      userMessage: '帮我研究 AI 趋势后做规划',
      availableContext: [],
    });

    expect(output.run.steps.filter(s => s.kind === 'delegation')).toHaveLength(1);
    expect(output.run.status).toBe('completed');
  });

  it('enforces delegation depth limit', async () => {
    // Mock: Agent 尝试在 maxDepth 处再 delegate
    mockLLM
      .onCall(0).respond({ toolCalls: [{ name: 'delegate_task', args: { domain: 'research', task: '...' } }] })
      // Research Agent 也尝试 delegate（应被阻止）
      .onCall(1).respond({ toolCalls: [{ name: 'delegate_task', args: { domain: 'reading', task: '...' } }] })
      .onCall(2).respond({ content: 'Error: delegation blocked' })
      .onCall(3).respond({ content: 'Completed without sub-delegation' });

    const output = await orchestrator.execute(/* ... */);
    // 验证只有一层委派，第二层被阻止
  });

  it('enforces concurrent delegation limit', async () => {
    // Mock: Coordinator 尝试同时委派 4 个子任务（超过 maxConcurrent=3）
    // 第 4 个应等待前面有完成后才执行
  });

  it('handles child budget exhaustion gracefully', async () => {
    // 子 Agent 的预算用完时，应中止并返回部分结果
  });
});
```

#### 6.4.3 Coordinator 模式端到端测试

```typescript
// tests/coordinator-e2e.test.ts

describe('Coordinator End-to-End', () => {
  it('completes a four-phase workflow', async () => {
    // 用户提出复杂任务
    const input: OrchestratorInput = {
      session: testSession,
      userMessage: '研究 2024 年 AI Agent 框架的发展趋势，与我已有的研究笔记对比，生成一份差距分析报告',
      availableContext: [
        { id: 'mem_001', layer: 'L2-object', content: '已有笔记摘要...', ... },
      ],
    };

    // Mock LLM 响应序列：
    // 1. Router: isComplex=true
    // 2. Coordinator Phase 1: decompose → [research subtask, reading subtask]
    // 3. Research Agent: 返回外部调研结果
    // 4. Reading Agent: 返回现有笔记摘要
    // 5. Coordinator Phase 2: 合成两者的差异
    // 6. Coordinator Phase 3: 委派 writing Agent 生成报告
    // 7. Writing Agent: 返回差距分析报告
    // 8. Coordinator Phase 4: 最终审查并输出

    mockLLM.mockSequence([
      // Router
      { domain: 'planning', isComplex: true, confidence: 0.95 },
      // Phase 1 decompose
      { subtasks: [
        { id: 'st1', targetDomain: 'research', task: '调研 2024 AI Agent 框架趋势', ... },
        { id: 'st2', targetDomain: 'reading', task: '提取现有笔记关键观点', ... },
      ]},
      // Research Agent
      { content: '<task-notification><status>completed</status><summary>关键发现...</summary></task-notification>' },
      // Reading Agent
      { content: '<task-notification><status>completed</status><summary>现有笔记...</summary></task-notification>' },
      // Phase 2 synthesis
      { content: '差异点分析：1) ... 2) ... 3) ...' },
      // Phase 3 delegate writing
      { subtasks: [{ id: 'st3', targetDomain: 'writing', task: '生成差距分析报告', ... }] },
      // Writing Agent
      { content: '<task-notification><status>completed</status><summary>报告已生成</summary></task-notification>' },
      // Phase 4 final synthesis
      { content: '## 差距分析报告\n\n根据调研和现有笔记对比...' },
    ]);

    const output = await orchestrator.execute(input);

    expect(output.run.status).toBe('completed');
    expect(output.responseMessage.content).toContain('差距分析报告');
    // 验证四个阶段都执行了
    const coordOutput = output as CoordinatorOutput;
    expect(coordOutput.phases).toHaveLength(4);
    expect(coordOutput.subtaskRuns).toHaveLength(3); // 2 research/reading + 1 writing
  });

  it('handles subtask failure and continues', async () => {
    // Research Agent 失败，但 Coordinator 使用 Reading Agent 的结果继续
  });

  it('respects total budget across all phases', async () => {
    // 确保 4 个阶段的总 token 消耗不超过预算
  });

  it('produces auditable phase records', async () => {
    // 验证每个 PhaseRecord 包含正确的时间戳、token 用量和子任务 ID
  });
});
```

### 6.5 测试基础设施

为支持上述测试，需要扩展现有的测试工具集：

```typescript
// tests/test-helpers.ts

/** Mock LLM 适配器，支持按调用顺序返回不同响应 */
export class MockLLMAdapter implements LLMAdapter {
  private responses: ChatCompletionResponse[] = [];
  private callIndex = 0;
  callCount = 0;

  onCall(index: number): MockResponseBuilder;
  mockSequence(responses: unknown[]): void;
  mockError(error: Error): void;

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.callCount++;
    // 返回预设响应
  }
}

/** 创建标准测试 session */
export function createTestSession(overrides?: Partial<AgentSession>): AgentSession;

/** 创建标准测试 budget */
export function createTestBudget(maxTokens?: number): IterationBudget;

/** Mock ObjectStateProvider */
export class MockObjectStateProvider implements ObjectStateProvider {
  private objects: Map<string, ObjectSnapshot> = new Map();
  addObject(snapshot: ObjectSnapshot): void;
  // ...
}
```

### 6.6 实施优先级

M6 的实施建议分为 3 个子批次：

```
Batch 1 (基础层，~400 行)
├── iteration-budget.ts        # 预算控制（无外部依赖）
├── agent-messenger.ts         # 通信协议（无外部依赖）
└── 对应单元测试

Batch 2 (路由与上下文，~400 行)
├── intent-router.ts           # 混合路由（依赖 LLMAdapter）
├── context-assembler.ts       # 上下文装配（依赖 MemoryManager + ObjectStateProvider）
├── orchestrator.ts 重构       # 集成 Router + Assembler + Budget
└── 对应单元测试

Batch 3 (协调层，~400 行)
├── coordinator.ts             # Coordinator 模式（依赖 Orchestrator + Messenger + Budget）
├── orchestrator.ts 扩展       # 集成 Coordinator 分支
├── 集成测试 + E2E 测试
└── types.ts / domain-agents.ts / index.ts 扩展
```

每个 Batch 完成后应确保所有现有测试仍通过，且新增测试覆盖率 > 90%。

---

## 附录：设计决策记录

### D1：为什么不完全照搬 Claude Code 的纯 LLM 驱动编排？

Claude Code 的 Coordinator 通过 ~370 行系统提示词定义所有行为，由 LLM 自主决定任务分配和并发策略。这种模式的不确定性过高——LLM 可能做出不合理的调度决策（如在预算不足时仍然创建多个子 Agent），且难以审计和复现。

Orbit 的选择是**混合编排**：安全检查、预算管控、深度限制、并发控制由确定性代码严格控制；意图理解、任务分解、结果合成由 LLM 驱动。这样既保留了 LLM 的语义理解能力，又确保了核心约束的可靠性。

### D2：为什么子 Agent 需要空上下文启动？

Hermes 的 `_build_child_agent()` 为每个子 Agent 创建全新的会话历史。这看似浪费（子 Agent 不知道父 Agent 已经做了什么），但好处显著：

1. **防止上下文污染**：子 Agent 不会被父 Agent 的对话历史误导
2. **节省 token**：空上下文 = 更大的有效工作空间
3. **更聚焦**：子 Agent 只看到针对性的任务描述和相关对象引用，不会被无关信息干扰
4. **安全性**：父 Agent 对话中可能包含敏感信息，不应泄漏给子 Agent

子 Agent 需要的上下文通过 `ObjectRef`（对象引用 + 摘要）传递，而非复制完整的父对话。

### D3：为什么 Agent 间消息通过 Orchestrator 中转而非直接点对点？

直接点对点通信更高效（少一跳），但 Orbit 选择中转模式的原因是：

1. **审计完整性**：中心化路由确保所有 Agent 间通信都被记录，便于事后审计和问题排查
2. **安全拦截**：中转节点可以检查消息是否包含敏感数据（如用户密码、API key），在传递前脱敏
3. **生命周期管理**：当 Coordinator 决定取消某个子 Agent 时，中转节点可以拦截所有发往该 Agent 的后续消息
4. **预算计量**：消息传递本身可能涉及 token 消耗（如摘要生成），中转节点负责统一计量

### D4：为什么路由缓存用精确匹配而非 embedding 相似度？

Embedding 相似度匹配虽然更灵活，但在路由缓存场景下有三个问题：

1. **额外成本**：每次路由都需要调用 embedding API，抵消了缓存节省的 LLM 调用成本
2. **精度风险**：语义相似的消息可能需要不同的路由（"写一个计划" vs "写一篇文章"在 embedding 空间可能很近，但应路由到不同 Agent）
3. **实际场景**：路由缓存的主要场景是短期内的重复操作（如用户连续追问同一主题），精确匹配足够覆盖

如果未来发现精确匹配的缓存命中率过低，可以在 Layer 2.5 引入轻量的 n-gram 模糊匹配作为折中方案。
