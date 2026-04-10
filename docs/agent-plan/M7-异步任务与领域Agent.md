# M7：异步任务中心与领域 Agent 实现

> **Phase 2 · Priority P2** | 预计新增 ~2200 行 + 重构 ~200 行  
> 依赖：M1（事件流管道）、M2（声明式能力注册表）、M3（Safety Gate 责任链）、M4（多层记忆系统）、M5（会话谱系与压缩引擎）、M6（混合多 Agent 编排）

---

## 〇、问题陈述

当前 `@orbit/agent-core` 的 7 个领域 Agent 仅存在于 `domain-agents.ts` 的 130 行静态配置中——不同的 system prompt、不同的 allowedCapabilities 列表、不同的 maxIterations，仅此而已。它们共用 `Orchestrator.execute()` 同一个 while 循环，没有独立的执行逻辑、没有专业化的上下文装配、没有特定领域的输出格式规范。

这导致六个核心问题：

1. **无异步任务模型**：长时间运行的任务（Research Agent 的多源并行检索、Ops Agent 的批量导入）会阻塞前台会话，用户被迫等待。
2. **7 个 Agent 无专业化逻辑**：Planning Agent 和 Writing Agent 用完全相同的执行管道，无法针对各自领域的工作模式进行优化。
3. **无任务队列与调度能力**：没有优先级队列、并发限制、定时触发（cron）、任务依赖（DAG）。
4. **无学习回路**：任务完成后不提炼执行经验，无法渐进式优化 Agent 的行为策略。
5. **无跨端任务状态同步**：Desktop 上发起的异步任务无法在 iOS 或 Web 上查看进度。
6. **无断点续传与取消恢复**：一旦中断，所有中间状态丢失。

本里程碑将从底层构建**异步任务中心**，并在此基础上实现 **7 个领域 Agent 的专业化**和**学习回路**。

---

## 一、异步任务模型 (AsyncJob)

### 1.1 AsyncJob 数据模型

`AsyncJob` 是异步任务中心的核心数据实体。每个从前台 session 中分离出来的长时间运行任务，都会创建一个 AsyncJob 实例。它记录了任务的完整生命周期信息，包括输入、输出、进度、重试历史、checkpoint 和跨端同步元数据。

```typescript
// packages/agent-core/src/tasks/async-job.ts

export const ASYNC_JOB_STATUSES = [
  'pending',      // 已创建，等待进入队列
  'queued',       // 已进入优先级队列，等待执行槽
  'running',      // 正在执行中
  'paused',       // 主动暂停（用户操作或等待审批）
  'completed',    // 成功完成
  'failed',       // 执行失败（已耗尽重试次数）
  'cancelled',    // 被用户或系统取消
] as const;
export type AsyncJobStatus = (typeof ASYNC_JOB_STATUSES)[number];

export const ASYNC_JOB_TYPES = [
  'agent-task',       // 领域 Agent 执行的异步任务
  'scheduled-task',   // 定时任务（cron 或 one-shot delay）
  'batch-operation',  // 批量操作（导入/导出/迁移）
  'background-sync',  // 后台同步任务
  'learning-task',    // 学习回路的经验提炼任务
  'composite-task',   // DAG 组合任务（包含子任务）
] as const;
export type AsyncJobType = (typeof ASYNC_JOB_TYPES)[number];

export interface AsyncJobCheckpoint {
  readonly stepIndex: number;            // 完成到第几步
  readonly stepLabel: string;            // 步骤的人类可读标签
  readonly intermediateState: string;    // JSON 序列化的中间状态
  readonly createdAt: string;            // ISO 时间戳
}

export interface RetryRecord {
  readonly attempt: number;              // 第几次重试（从 1 开始）
  readonly error: string;                // 错误信息
  readonly errorCode?: string;           // 可选的错误码（用于判断是否可重试）
  readonly timestamp: string;            // 重试时间
  readonly nextRetryAt?: string;         // 下次重试计划时间
}

export interface AsyncJobProgress {
  readonly currentStep: number;          // 当前步骤序号
  readonly totalSteps: number;           // 总步骤数（0 表示不确定）
  readonly percentage: number;           // 0-100 百分比
  readonly message: string;              // 当前步骤的描述
  readonly updatedAt: string;            // 最后更新时间
}

export interface AsyncJob {
  readonly id: string;                   // 格式: job_{timestamp36}_{counter36}
  readonly type: AsyncJobType;
  readonly status: AsyncJobStatus;
  readonly priority: number;             // 0(最高) - 99(最低)，默认 50
  readonly agentDomain: AgentDomain;     // 执行此任务的 Agent 域
  readonly workspaceId: string;
  readonly sessionId: string;            // 发起此任务的会话 ID

  // 输入输出
  readonly input: Readonly<Record<string, unknown>>;   // 任务输入参数
  readonly output?: Readonly<Record<string, unknown>>;  // 任务输出结果
  readonly anchorObjectIds: readonly string[];           // 关联的对象 ID

  // 进度与状态
  readonly progress: AsyncJobProgress;
  readonly checkpoints: readonly AsyncJobCheckpoint[];
  readonly retryHistory: readonly RetryRecord[];

  // 重试配置
  readonly maxRetries: number;           // 最大重试次数，默认 3
  readonly retryCount: number;           // 当前已重试次数
  readonly retryDelayMs: number;         // 基础重试延迟（毫秒），用于指数退避

  // 定时调度
  readonly scheduledAt?: string;         // 一次性延时任务的触发时间
  readonly cronExpression?: string;      // cron 表达式（定时任务）
  readonly lastTriggeredAt?: string;     // 上次触发时间

  // DAG 依赖
  readonly parentJobId?: string;         // 父任务 ID（composite-task 场景）
  readonly childJobIds: readonly string[];
  readonly dependsOn: readonly string[]; // 依赖的其他 job ID

  // 取消传播
  readonly abortControllerId?: string;   // 关联的 AbortController ID（M1 集成）

  // 跨端同步
  readonly originDeviceId: string;       // 发起此任务的设备 ID
  readonly syncVersion: number;          // 乐观锁版本号

  // 时间戳
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly updatedAt: string;

  // 审计
  readonly createdBy: string;            // 用户 ID 或 'system'
  readonly cancelledBy?: string;         // 取消操作的发起者
  readonly cancelReason?: string;        // 取消原因
}
```

**SQLite 持久化表设计**（扩展 `@orbit/db-schema`）：

```typescript
// 新增到 packages/db-schema/src/index.ts

export const ORBIT_SQLITE_TABLES_ASYNC = {
  asyncJobs: 'async_jobs',
  asyncJobCheckpoints: 'async_job_checkpoints',
  asyncJobRetries: 'async_job_retries',
  asyncJobDeps: 'async_job_deps',
} as const;

// async_jobs 表
{
  name: 'async_jobs',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'type', type: 'TEXT', notNull: true },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'pending'" },
    { name: 'priority', type: 'INTEGER', notNull: true, defaultValue: '50' },
    { name: 'agent_domain', type: 'TEXT', notNull: true },
    { name: 'workspace_id', type: 'TEXT', notNull: true },
    { name: 'session_id', type: 'TEXT', notNull: true },
    { name: 'input_json', type: 'TEXT', notNull: true },
    { name: 'output_json', type: 'TEXT' },
    { name: 'anchor_object_ids', type: 'TEXT' },  // JSON array
    { name: 'progress_json', type: 'TEXT' },
    { name: 'max_retries', type: 'INTEGER', notNull: true, defaultValue: '3' },
    { name: 'retry_count', type: 'INTEGER', notNull: true, defaultValue: '0' },
    { name: 'retry_delay_ms', type: 'INTEGER', notNull: true, defaultValue: '1000' },
    { name: 'scheduled_at', type: 'TEXT' },
    { name: 'cron_expression', type: 'TEXT' },
    { name: 'last_triggered_at', type: 'TEXT' },
    { name: 'parent_job_id', type: 'TEXT' },
    { name: 'abort_controller_id', type: 'TEXT' },
    { name: 'origin_device_id', type: 'TEXT', notNull: true },
    { name: 'sync_version', type: 'INTEGER', notNull: true, defaultValue: '1' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'started_at', type: 'TEXT' },
    { name: 'completed_at', type: 'TEXT' },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'created_by', type: 'TEXT', notNull: true },
    { name: 'cancelled_by', type: 'TEXT' },
    { name: 'cancel_reason', type: 'TEXT' },
  ],
  indexes: [
    { name: 'idx_async_jobs_workspace_status', columns: ['workspace_id', 'status'] },
    { name: 'idx_async_jobs_status_priority', columns: ['status', 'priority'] },
    { name: 'idx_async_jobs_parent', columns: ['parent_job_id'] },
    { name: 'idx_async_jobs_scheduled', columns: ['scheduled_at'] },
    { name: 'idx_async_jobs_cron', columns: ['cron_expression'] },
    { name: 'idx_async_jobs_session', columns: ['session_id'] },
  ],
}
```

### 1.2 任务生命周期状态机

AsyncJob 的生命周期遵循严格的状态机规则。只有合法的状态转换才被允许，非法转换会抛出 `InvalidJobTransitionError`。

```
                  ┌─────────────────────────────────────┐
                  │           cancelled                  │
                  │        ┌──────────┐                  │
                  │        │          │                  │
 ┌─────────┐  enqueue  ┌──┴────┐  dequeue  ┌─────────┐ │
 │ pending  │────────→│ queued  │────────→│ running  │──┤
 └─────────┘          └────────┘          └────┬────┘  │
                                               │       │
                                    ┌──────────┼───────┘
                                    │          │
                              pause │     complete / fail
                                    │          │
                              ┌─────┴──┐   ┌───┴──────────┐
                              │ paused │   │ completed /   │
                              └────┬───┘   │ failed        │
                                   │       └──────────────┘
                                resume
                                   │
                              ┌────┴───┐
                              │ running│ (恢复执行)
                              └────────┘
```

**合法转换表**：

| 当前状态 | 可转换到 | 触发条件 |
|---------|---------|---------|
| `pending` | `queued` | 进入优先级队列 |
| `pending` | `cancelled` | 用户取消 |
| `queued` | `running` | 获得执行槽 |
| `queued` | `cancelled` | 用户取消 |
| `running` | `completed` | 任务成功完成 |
| `running` | `failed` | 任务失败且无剩余重试 |
| `running` | `queued` | 任务失败但有剩余重试（自动 re-enqueue） |
| `running` | `paused` | 等待审批 / 用户主动暂停 |
| `running` | `cancelled` | 用户取消 / AbortController.abort() |
| `paused` | `running` | 审批通过 / 用户恢复 |
| `paused` | `cancelled` | 用户取消 |

```typescript
// packages/agent-core/src/tasks/async-job.ts

const VALID_TRANSITIONS: Record<AsyncJobStatus, readonly AsyncJobStatus[]> = {
  pending:   ['queued', 'cancelled'],
  queued:    ['running', 'cancelled'],
  running:   ['completed', 'failed', 'queued', 'paused', 'cancelled'],
  paused:    ['running', 'cancelled'],
  completed: [],
  failed:    [],
  cancelled: [],
};

export class InvalidJobTransitionError extends Error {
  constructor(jobId: string, from: AsyncJobStatus, to: AsyncJobStatus) {
    super(`Invalid job transition: ${jobId} cannot go from "${from}" to "${to}"`);
    this.name = 'InvalidJobTransitionError';
  }
}

export function validateTransition(
  jobId: string,
  from: AsyncJobStatus,
  to: AsyncJobStatus,
): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new InvalidJobTransitionError(jobId, from, to);
  }
}
```

### 1.3 重试策略

重试策略采用指数退避 + 抖动 (jitter) 算法，避免大量失败任务同时重试造成雪崩。

```typescript
// packages/agent-core/src/tasks/retry-strategy.ts

export interface RetryPolicy {
  readonly maxRetries: number;         // 最大重试次数，默认 3
  readonly baseDelayMs: number;        // 基础延迟，默认 1000ms
  readonly maxDelayMs: number;         // 最大延迟上限，默认 60000ms
  readonly backoffMultiplier: number;  // 退避系数，默认 2
  readonly jitterRatio: number;        // 抖动比例 0-1，默认 0.2
  readonly retryableErrors: readonly string[];  // 可重试的错误码列表
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
  backoffMultiplier: 2,
  jitterRatio: 0.2,
  retryableErrors: [
    'RATE_LIMIT',           // LLM API 速率限制
    'NETWORK_TIMEOUT',      // 网络超时
    'SERVICE_UNAVAILABLE',  // 服务暂不可用
    'TRANSIENT_ERROR',      // 临时性错误
    'CHECKPOINT_EXPIRED',   // checkpoint 过期（需重新从最近 checkpoint 恢复）
  ],
};

// 不可重试的错误类型——这些错误重试也不会成功
export const NON_RETRYABLE_ERRORS = [
  'INVALID_INPUT',          // 输入参数错误
  'PERMISSION_DENIED',      // 权限不足
  'QUOTA_EXCEEDED',         // 配额已耗尽
  'CONTENT_POLICY',         // 内容策略违规
  'SCHEMA_VIOLATION',       // 数据结构不符
] as const;

export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy,
): number {
  const exponentialDelay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  const clampedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
  const jitter = clampedDelay * policy.jitterRatio * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(clampedDelay + jitter));
}

export function isRetryableError(errorCode: string, policy: RetryPolicy): boolean {
  return policy.retryableErrors.includes(errorCode);
}

export function shouldRetry(job: AsyncJob, policy: RetryPolicy): boolean {
  if (job.retryCount >= policy.maxRetries) return false;
  const lastRetry = job.retryHistory[job.retryHistory.length - 1];
  if (!lastRetry?.errorCode) return true;  // 无错误码时默认允许重试
  return isRetryableError(lastRetry.errorCode, policy);
}
```

**重试流程**：
1. 任务执行失败 → 检查 `shouldRetry(job, policy)`
2. 若可重试：计算 `calculateRetryDelay(retryCount + 1, policy)` → 追加 `RetryRecord` → 状态从 `running` 转回 `queued` → 延迟后重新进入优先级队列
3. 若不可重试：状态转为 `failed` → 发出 `job:failed` 事件 → 若有父任务则通知父任务

### 1.4 断点续传（Checkpoint 机制）

Checkpoint 是 AsyncJob 的核心可靠性保障。每个领域 Agent 在执行多步骤任务时，会在关键步骤完成后写入 checkpoint。任务恢复时从最近的 checkpoint 开始，而非从头执行。

```typescript
// packages/agent-core/src/tasks/checkpoint.ts

export interface CheckpointManager {
  save(jobId: string, checkpoint: AsyncJobCheckpoint): Promise<void>;
  getLatest(jobId: string): Promise<AsyncJobCheckpoint | null>;
  getAll(jobId: string): Promise<readonly AsyncJobCheckpoint[]>;
  prune(jobId: string, keepLast: number): Promise<void>;
}

export class SqliteCheckpointManager implements CheckpointManager {
  constructor(private readonly db: DatabasePort) {}

  async save(jobId: string, checkpoint: AsyncJobCheckpoint): Promise<void> {
    await this.db.execute(
      `INSERT INTO async_job_checkpoints (job_id, step_index, step_label, intermediate_state, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [jobId, checkpoint.stepIndex, checkpoint.stepLabel,
       checkpoint.intermediateState, checkpoint.createdAt],
    );
  }

  async getLatest(jobId: string): Promise<AsyncJobCheckpoint | null> {
    const rows = await this.db.query(
      `SELECT * FROM async_job_checkpoints WHERE job_id = ? ORDER BY step_index DESC LIMIT 1`,
      [jobId],
    );
    return rows.length > 0 ? this.rowToCheckpoint(rows[0]) : null;
  }

  async getAll(jobId: string): Promise<readonly AsyncJobCheckpoint[]> {
    const rows = await this.db.query(
      `SELECT * FROM async_job_checkpoints WHERE job_id = ? ORDER BY step_index ASC`,
      [jobId],
    );
    return rows.map(this.rowToCheckpoint);
  }

  async prune(jobId: string, keepLast: number): Promise<void> {
    await this.db.execute(
      `DELETE FROM async_job_checkpoints WHERE job_id = ? AND step_index NOT IN (
        SELECT step_index FROM async_job_checkpoints WHERE job_id = ?
        ORDER BY step_index DESC LIMIT ?
      )`,
      [jobId, jobId, keepLast],
    );
  }

  private rowToCheckpoint(row: Record<string, unknown>): AsyncJobCheckpoint {
    return {
      stepIndex: row['step_index'] as number,
      stepLabel: row['step_label'] as string,
      intermediateState: row['intermediate_state'] as string,
      createdAt: row['created_at'] as string,
    };
  }
}
```

**Checkpoint 写入策略**：
- **步骤粒度**：每个 Agent 的 `executeStep()` 完成后自动写入 checkpoint
- **内容要素**：stepIndex（步骤序号）、stepLabel（可读标签）、intermediateState（JSON 化的中间结果，包含已收集的数据、已完成的子步骤列表、当前上下文摘要）
- **大小限制**：单个 checkpoint 的 intermediateState 不超过 64KB；超过时触发压缩
- **清理策略**：每个 job 最多保留最近 10 个 checkpoint，旧的自动清理

**恢复流程**：
1. `TaskScheduler.resumeJob(jobId)` 被调用
2. 读取最近的 checkpoint → `CheckpointManager.getLatest(jobId)`
3. 解析 `intermediateState` → 恢复 Agent 的执行上下文
4. 调用对应 Agent 的 `resumeFrom(checkpoint)` 方法
5. Agent 从 `checkpoint.stepIndex + 1` 开始继续执行

### 1.5 取消传播（AbortController 集成）

与 M1 的 AsyncGenerator 事件流管道深度集成。每个 AsyncJob 在创建时会关联一个 `AbortController`，取消操作通过 signal 自动传播到所有子任务和正在执行的 capability 调用。

```typescript
// packages/agent-core/src/tasks/cancellation.ts

export interface CancellationManager {
  register(jobId: string): AbortController;
  cancel(jobId: string, reason?: string, cancelledBy?: string): void;
  getSignal(jobId: string): AbortSignal | undefined;
  isAborted(jobId: string): boolean;
  cleanup(jobId: string): void;
}

export class DefaultCancellationManager implements CancellationManager {
  private readonly controllers = new Map<string, AbortController>();

  register(jobId: string): AbortController {
    const controller = new AbortController();
    this.controllers.set(jobId, controller);
    return controller;
  }

  cancel(jobId: string, reason?: string, _cancelledBy?: string): void {
    const controller = this.controllers.get(jobId);
    if (controller && !controller.signal.aborted) {
      controller.abort(reason ?? 'Job cancelled');
    }
  }

  getSignal(jobId: string): AbortSignal | undefined {
    return this.controllers.get(jobId)?.signal;
  }

  isAborted(jobId: string): boolean {
    return this.controllers.get(jobId)?.signal.aborted ?? false;
  }

  cleanup(jobId: string): void {
    this.controllers.delete(jobId);
  }
}
```

**取消传播链**：
1. 用户在 UI 点击取消 → `TaskScheduler.cancelJob(jobId, userId)`
2. `CancellationManager.cancel(jobId)` → `AbortController.abort()`
3. AbortSignal 传播到：
   - 当前正在执行的 LLM 调用（通过 fetch 的 signal 参数）
   - 当前正在执行的 capability 调用（通过 M1 事件流管道的 signal 传递）
   - 所有子任务（通过 `childJobIds` 递归取消）
4. Agent 执行循环检测到 `signal.aborted` → 写入最终 checkpoint → 状态转为 `cancelled`
5. 发出 `job:cancelled` 事件，附带 cancel_reason 和最终 checkpoint 信息

---

## 二、任务队列与调度器 (TaskScheduler)

### 2.1 优先级队列设计

TaskScheduler 是异步任务中心的核心调度引擎。它管理一个多级优先级队列，负责任务的入队、出队、调度、并发控制和生命周期管理。

```typescript
// packages/agent-core/src/tasks/task-scheduler.ts

export interface TaskSchedulerConfig {
  readonly maxGlobalConcurrency: number;      // 全局最大并发任务数，默认 5
  readonly maxConcurrencyByType: Partial<Record<AsyncJobType, number>>;  // 按类型的并发限制
  readonly maxConcurrencyByDomain: Partial<Record<AgentDomain, number>>; // 按 Agent 域的并发限制
  readonly pollIntervalMs: number;            // 队列轮询间隔，默认 1000ms
  readonly cronCheckIntervalMs: number;       // cron 任务检查间隔，默认 60000ms
  readonly staleJobTimeoutMs: number;         // 任务超时判定阈值，默认 30min
}

export const DEFAULT_SCHEDULER_CONFIG: TaskSchedulerConfig = {
  maxGlobalConcurrency: 5,
  maxConcurrencyByType: {
    'agent-task': 3,
    'batch-operation': 1,    // 批量操作独占，避免资源争抢
    'background-sync': 2,
    'learning-task': 1,
  },
  maxConcurrencyByDomain: {
    research: 2,  // Research Agent 允许并行（多源检索）
    ops: 1,       // Ops Agent 串行执行（防止冲突）
  },
  pollIntervalMs: 1000,
  cronCheckIntervalMs: 60_000,
  staleJobTimeoutMs: 30 * 60 * 1000,
};
```

**优先级队列实现**——采用最小堆（min-heap），以 `(priority, createdAt)` 为排序键：

```typescript
// packages/agent-core/src/tasks/priority-queue.ts

export interface PriorityQueueItem {
  readonly jobId: string;
  readonly priority: number;
  readonly createdAt: string;
}

export class PriorityQueue {
  private heap: PriorityQueueItem[] = [];

  get size(): number { return this.heap.length; }
  get isEmpty(): boolean { return this.heap.length === 0; }

  enqueue(item: PriorityQueueItem): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): PriorityQueueItem | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  peek(): PriorityQueueItem | undefined {
    return this.heap[0];
  }

  remove(jobId: string): boolean {
    const idx = this.heap.findIndex((item) => item.jobId === jobId);
    if (idx === -1) return false;
    const last = this.heap.pop()!;
    if (idx < this.heap.length) {
      this.heap[idx] = last;
      this.bubbleUp(idx);
      this.sinkDown(idx);
    }
    return true;
  }

  private compare(a: PriorityQueueItem, b: PriorityQueueItem): number {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt.localeCompare(b.createdAt); // FIFO within same priority
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.compare(this.heap[idx], this.heap[parentIdx]) >= 0) break;
      [this.heap[idx], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[idx]];
      idx = parentIdx;
    }
  }

  private sinkDown(idx: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}
```

### 2.2 并发限制

TaskScheduler 通过三层并发控制确保系统资源不被耗尽：

```typescript
// 嵌入 task-scheduler.ts

export class TaskScheduler {
  private readonly queue: PriorityQueue;
  private readonly runningJobs = new Map<string, AsyncJob>();
  private readonly cancellation: CancellationManager;
  private readonly checkpoint: CheckpointManager;
  private readonly config: TaskSchedulerConfig;
  private readonly jobStore: AsyncJobStore;
  private readonly eventBus: EventBus;       // M1 事件流集成
  private cronTimer?: ReturnType<typeof setInterval>;
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor(deps: TaskSchedulerDeps) {
    this.queue = new PriorityQueue();
    this.cancellation = deps.cancellation;
    this.checkpoint = deps.checkpoint;
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...deps.config };
    this.jobStore = deps.jobStore;
    this.eventBus = deps.eventBus;
  }

  // ---- 并发检查 ----

  private canExecute(job: AsyncJob): boolean {
    // Layer 1: 全局并发限制
    if (this.runningJobs.size >= this.config.maxGlobalConcurrency) return false;

    // Layer 2: 按类型并发限制
    const typeLimit = this.config.maxConcurrencyByType[job.type];
    if (typeLimit !== undefined) {
      const runningOfType = [...this.runningJobs.values()]
        .filter((j) => j.type === job.type).length;
      if (runningOfType >= typeLimit) return false;
    }

    // Layer 3: 按 Agent 域并发限制
    const domainLimit = this.config.maxConcurrencyByDomain[job.agentDomain];
    if (domainLimit !== undefined) {
      const runningOfDomain = [...this.runningJobs.values()]
        .filter((j) => j.agentDomain === job.agentDomain).length;
      if (runningOfDomain >= domainLimit) return false;
    }

    return true;
  }

  // ---- 核心调度循环 ----

  async submitJob(job: AsyncJob): Promise<string> {
    await this.jobStore.save(job);
    this.queue.enqueue({
      jobId: job.id,
      priority: job.priority,
      createdAt: job.createdAt,
    });
    await this.jobStore.updateStatus(job.id, 'queued');
    this.eventBus.emit({ type: 'job:queued', jobId: job.id, timestamp: new Date().toISOString() });
    this.tryDispatch();
    return job.id;
  }

  private async tryDispatch(): Promise<void> {
    while (!this.queue.isEmpty) {
      const item = this.queue.peek()!;
      const job = await this.jobStore.get(item.jobId);
      if (!job || job.status === 'cancelled') {
        this.queue.dequeue();
        continue;
      }
      if (!this.canExecute(job)) break;
      this.queue.dequeue();
      await this.executeJob(job);
    }
  }

  private async executeJob(job: AsyncJob): Promise<void> {
    const controller = this.cancellation.register(job.id);
    this.runningJobs.set(job.id, job);
    await this.jobStore.updateStatus(job.id, 'running');
    this.eventBus.emit({ type: 'job:started', jobId: job.id, timestamp: new Date().toISOString() });

    try {
      const agent = this.resolveAgent(job.agentDomain);
      const latestCheckpoint = await this.checkpoint.getLatest(job.id);
      const result = await agent.executeJob(job, {
        signal: controller.signal,
        checkpoint: latestCheckpoint,
        checkpointManager: this.checkpoint,
        eventBus: this.eventBus,
      });

      await this.jobStore.complete(job.id, result);
      this.eventBus.emit({ type: 'job:completed', jobId: job.id, result, timestamp: new Date().toISOString() });

    } catch (error: unknown) {
      if (controller.signal.aborted) {
        await this.jobStore.updateStatus(job.id, 'cancelled');
        return;
      }
      await this.handleJobFailure(job, error);

    } finally {
      this.runningJobs.delete(job.id);
      this.cancellation.cleanup(job.id);
      this.tryDispatch();  // 释放执行槽后尝试调度下一个任务
    }
  }

  private async handleJobFailure(job: AsyncJob, error: unknown): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string }).code ?? 'UNKNOWN';

    const retryPolicy: RetryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      maxRetries: job.maxRetries,
      baseDelayMs: job.retryDelayMs,
    };

    if (shouldRetry(job, retryPolicy)) {
      const delay = calculateRetryDelay(job.retryCount + 1, retryPolicy);
      await this.jobStore.recordRetry(job.id, { attempt: job.retryCount + 1, error: errorMsg, errorCode, timestamp: new Date().toISOString(), nextRetryAt: new Date(Date.now() + delay).toISOString() });
      setTimeout(() => {
        this.queue.enqueue({ jobId: job.id, priority: job.priority, createdAt: job.createdAt });
        this.tryDispatch();
      }, delay);
      this.eventBus.emit({ type: 'job:retrying', jobId: job.id, attempt: job.retryCount + 1, delay, timestamp: new Date().toISOString() });
    } else {
      await this.jobStore.updateStatus(job.id, 'failed');
      this.eventBus.emit({ type: 'job:failed', jobId: job.id, error: errorMsg, timestamp: new Date().toISOString() });
    }
  }

  // ---- 公共 API ----

  async cancelJob(jobId: string, cancelledBy: string, reason?: string): Promise<void> {
    const job = await this.jobStore.get(jobId);
    if (!job) return;
    validateTransition(jobId, job.status, 'cancelled');
    this.cancellation.cancel(jobId, reason, cancelledBy);
    this.queue.remove(jobId);

    // 递归取消子任务
    for (const childId of job.childJobIds) {
      await this.cancelJob(childId, cancelledBy, `Parent job ${jobId} cancelled`);
    }

    await this.jobStore.cancel(jobId, cancelledBy, reason);
    this.eventBus.emit({ type: 'job:cancelled', jobId, cancelledBy, reason, timestamp: new Date().toISOString() });
  }

  async pauseJob(jobId: string): Promise<void> {
    const job = await this.jobStore.get(jobId);
    if (!job || job.status !== 'running') return;
    await this.jobStore.updateStatus(jobId, 'paused');
    this.eventBus.emit({ type: 'job:paused', jobId, timestamp: new Date().toISOString() });
  }

  async resumeJob(jobId: string): Promise<void> {
    const job = await this.jobStore.get(jobId);
    if (!job || job.status !== 'paused') return;
    await this.jobStore.updateStatus(jobId, 'queued');
    this.queue.enqueue({ jobId: job.id, priority: job.priority, createdAt: job.createdAt });
    this.tryDispatch();
    this.eventBus.emit({ type: 'job:resumed', jobId, timestamp: new Date().toISOString() });
  }

  getRunningJobs(): readonly AsyncJob[] {
    return [...this.runningJobs.values()];
  }

  // Agent 解析（延迟到第三部分详述）
  private resolveAgent(_domain: AgentDomain): DomainAgentExecutor {
    throw new Error('Implemented in section 3');
  }
}
```

### 2.3 定时任务支持

定时任务支持两种模式：**cron 表达式**（周期性触发）和**一次性延时任务**（指定时间触发一次）。

```typescript
// packages/agent-core/src/tasks/cron-scheduler.ts

export interface CronScheduler {
  start(): void;
  stop(): void;
  registerCronJob(job: AsyncJob): void;
  unregisterCronJob(jobId: string): void;
}

export class DefaultCronScheduler implements CronScheduler {
  private timer?: ReturnType<typeof setInterval>;
  private readonly cronJobs = new Map<string, AsyncJob>();
  private readonly taskScheduler: TaskScheduler;
  private readonly checkIntervalMs: number;

  constructor(taskScheduler: TaskScheduler, checkIntervalMs: number = 60_000) {
    this.taskScheduler = taskScheduler;
    this.checkIntervalMs = checkIntervalMs;
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), this.checkIntervalMs);
    this.tick(); // 立即检查一次
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  registerCronJob(job: AsyncJob): void {
    if (!job.cronExpression) throw new Error('Job must have a cronExpression');
    this.cronJobs.set(job.id, job);
  }

  unregisterCronJob(jobId: string): void {
    this.cronJobs.delete(jobId);
  }

  private tick(): void {
    const now = new Date();
    for (const [_id, job] of this.cronJobs) {
      if (this.shouldTrigger(job, now)) {
        this.triggerCronJob(job, now);
      }
    }
  }

  private shouldTrigger(job: AsyncJob, now: Date): boolean {
    if (!job.cronExpression) return false;
    const lastTriggered = job.lastTriggeredAt ? new Date(job.lastTriggeredAt) : null;
    return matchesCron(job.cronExpression, now, lastTriggered);
  }

  private triggerCronJob(template: AsyncJob, now: Date): void {
    const newJob: AsyncJob = {
      ...template,
      id: generateId('job'),
      status: 'pending',
      progress: { currentStep: 0, totalSteps: 0, percentage: 0, message: 'Scheduled trigger', updatedAt: now.toISOString() },
      checkpoints: [],
      retryHistory: [],
      retryCount: 0,
      lastTriggeredAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.taskScheduler.submitJob(newJob);
  }
}
```

**cron 表达式解析**——支持标准 5 字段 cron（分 时 日 月 周），加上 Orbit 特有的语义别名：

| 别名 | cron 等价 | 用途 |
|------|----------|------|
| `@daily-review` | `0 21 * * *` | 每日 21:00 触发日回顾 |
| `@weekly-review` | `0 10 * * 0` | 每周日 10:00 触发周回顾 |
| `@monthly-review` | `0 10 1 * *` | 每月 1 日 10:00 月回顾 |
| `@feed-sync` | `*/30 * * * *` | 每 30 分钟同步 RSS 源 |
| `@morning-plan` | `0 8 * * 1-5` | 工作日 8:00 生成 Today 编排 |

### 2.4 任务依赖（DAG 调度）

复合任务（`composite-task`）支持 DAG 依赖关系。例如 Research Agent 的"主题深度研究"可能包含：先并行检索多个来源 → 汇总 → 差异分析 → 生成报告。

```typescript
// packages/agent-core/src/tasks/dag-scheduler.ts

export interface DAGNode {
  readonly jobId: string;
  readonly dependsOn: readonly string[];
}

export class DAGScheduler {
  private readonly nodes = new Map<string, DAGNode>();
  private readonly completedNodes = new Set<string>();
  private readonly taskScheduler: TaskScheduler;

  constructor(taskScheduler: TaskScheduler) {
    this.taskScheduler = taskScheduler;
  }

  addNode(node: DAGNode): void {
    this.validateNoCycle(node);
    this.nodes.set(node.jobId, node);
  }

  markCompleted(jobId: string): void {
    this.completedNodes.add(jobId);
    this.scheduleReadyNodes();
  }

  getReadyNodes(): readonly DAGNode[] {
    return [...this.nodes.values()].filter((node) => {
      if (this.completedNodes.has(node.jobId)) return false;
      return node.dependsOn.every((dep) => this.completedNodes.has(dep));
    });
  }

  private scheduleReadyNodes(): void {
    for (const node of this.getReadyNodes()) {
      // 将就绪节点提交到 TaskScheduler 执行
      // 实际实现中需要从 jobStore 加载完整 AsyncJob
      this.taskScheduler.resumeJob(node.jobId);
    }
  }

  isComplete(): boolean {
    return [...this.nodes.keys()].every((id) => this.completedNodes.has(id));
  }

  private validateNoCycle(newNode: DAGNode): void {
    const visited = new Set<string>();
    const check = (id: string): void => {
      if (id === newNode.jobId) throw new Error(`Cycle detected: adding ${newNode.jobId} would create a dependency cycle`);
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node) node.dependsOn.forEach(check);
    };
    newNode.dependsOn.forEach(check);
  }
}
```

**父子任务回调**：
- 当子任务 A 完成 → DAGScheduler.markCompleted(A) → 检查依赖 A 的所有任务 → 若所有依赖都已完成则提交该任务
- 当所有子任务完成 → `DAGScheduler.isComplete()` 返回 true → 触发父任务的 `onAllChildrenCompleted` 回调 → 合并子任务输出 → 父任务标记为 completed

---

## 三、七个领域 Agent 的专业化实现

### 3.0 基类设计：DomainAgentExecutor

所有 7 个领域 Agent 都继承自 `DomainAgentExecutor` 基类，共享 checkpoint 写入、取消检测、进度上报等基础设施，同时提供钩子方法供子类实现专业化逻辑。

```typescript
// packages/agent-core/src/agents/base-agent.ts

export interface AgentJobContext {
  readonly signal: AbortSignal;
  readonly checkpoint: AsyncJobCheckpoint | null;
  readonly checkpointManager: CheckpointManager;
  readonly eventBus: EventBus;
}

export interface AgentJobResult {
  readonly output: Record<string, unknown>;
  readonly objectMutations: readonly string[];
  readonly learningHints: readonly LearningHint[];  // 给学习回路的提示
}

export interface LearningHint {
  readonly type: 'template-candidate' | 'preference-signal' | 'strategy-observation';
  readonly content: string;
  readonly confidence: number;
  readonly metadata: Record<string, unknown>;
}

export abstract class DomainAgentExecutor {
  readonly domain: AgentDomain;
  protected readonly config: DomainAgentConfig;
  protected readonly orchestrator: Orchestrator;
  protected readonly memory: MemoryManager;

  constructor(domain: AgentDomain, deps: AgentDeps) {
    this.domain = domain;
    this.config = DOMAIN_AGENT_CONFIGS[domain];
    this.orchestrator = deps.orchestrator;
    this.memory = deps.memory;
  }

  // ---- 公共执行入口 ----

  async executeJob(job: AsyncJob, ctx: AgentJobContext): Promise<AgentJobResult> {
    const steps = this.buildExecutionPlan(job);
    const startStep = ctx.checkpoint ? ctx.checkpoint.stepIndex + 1 : 0;
    let state = ctx.checkpoint
      ? JSON.parse(ctx.checkpoint.intermediateState)
      : this.initializeState(job);

    for (let i = startStep; i < steps.length; i++) {
      // 取消检测
      if (ctx.signal.aborted) {
        await ctx.checkpointManager.save(job.id, this.createCheckpoint(i - 1, steps[i - 1]?.label ?? 'init', state));
        throw new DOMException('Job aborted', 'AbortError');
      }

      // 进度上报
      ctx.eventBus.emit({
        type: 'job:progress',
        jobId: job.id,
        progress: { currentStep: i, totalSteps: steps.length, percentage: Math.round((i / steps.length) * 100), message: steps[i].label, updatedAt: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });

      // 执行步骤
      state = await steps[i].execute(state, ctx);

      // 写入 checkpoint
      await ctx.checkpointManager.save(job.id, this.createCheckpoint(i, steps[i].label, state));
    }

    return this.finalizeResult(state, job);
  }

  // ---- 子类必须实现的钩子 ----

  /** 根据 job input 构建执行步骤序列 */
  protected abstract buildExecutionPlan(job: AsyncJob): readonly ExecutionStep[];

  /** 初始化执行状态 */
  protected abstract initializeState(job: AsyncJob): Record<string, unknown>;

  /** 将最终状态转换为输出结果 */
  protected abstract finalizeResult(state: Record<string, unknown>, job: AsyncJob): AgentJobResult;

  // ---- 上下文装配（子类可覆盖） ----

  protected async assembleContext(job: AsyncJob): Promise<readonly MemoryEntry[]> {
    return this.memory.recallForTurn(
      JSON.stringify(job.input),
      job.sessionId,
    );
  }

  // ---- 辅助方法 ----

  private createCheckpoint(stepIndex: number, stepLabel: string, state: Record<string, unknown>): AsyncJobCheckpoint {
    return {
      stepIndex,
      stepLabel,
      intermediateState: JSON.stringify(state),
      createdAt: new Date().toISOString(),
    };
  }
}

export interface ExecutionStep {
  readonly label: string;
  execute(state: Record<string, unknown>, ctx: AgentJobContext): Promise<Record<string, unknown>>;
}
```

### 3.1 Planner Agent（规划 Agent）

**职责**：将用户的愿景和指令分解为结构化的里程碑树、任务草案和执行计划。它是 Orbit 中唯一被允许创建和修改 Task 对象的 Agent（除 Ops Agent 外）。

```typescript
// packages/agent-core/src/agents/planner-agent.ts

export interface PlannerInput {
  readonly intent: 'okr-decompose' | 'weekly-plan' | 'today-arrange' | 'milestone-review' | 'free-form';
  readonly vision?: string;
  readonly directive: string;
  readonly projectId?: string;
  readonly relatedResearchIds?: readonly string[];
  readonly timeHorizon?: 'day' | 'week' | 'sprint' | 'quarter';
}

export interface PlannerOutput {
  readonly milestoneTree?: MilestoneNode[];
  readonly taskDrafts: TaskDraft[];
  readonly prioritySuggestions: PrioritySuggestion[];
  readonly blockers: BlockerIdentification[];
  readonly todayArrangement?: TodayArrangement;
}

export interface MilestoneNode {
  readonly title: string;
  readonly description: string;
  readonly children: MilestoneNode[];
  readonly estimatedEffort: string;
}

export interface TaskDraft {
  readonly title: string;
  readonly projectId: string;
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly estimatedMinutes?: number;
  readonly dependsOn: readonly string[];
  readonly suggestedTodayOn?: string;
}

export interface TodayArrangement {
  readonly date: string;
  readonly focusTasks: readonly { taskId: string; focusRank: number; reason: string }[];
  readonly timeBlocks: readonly { start: string; end: string; taskId: string; label: string }[];
}
```

**上下文装配策略**：
1. 加载目标 project 的完整 TaskRecord 列表（含状态、完成时间）
2. 加载 L2-object 层的项目记忆（过往规划决策、历史优先级调整原因）
3. 若关联 researchIds，从 Research Agent 的输出中拉取证据摘要
4. 加载 L3-user-longterm 层的规划偏好（如"用户偏好 2 周 sprint"、"不喜欢周一安排重任务"）

**执行模板库**：

| 模板 | 触发条件 | 步骤流程 |
|------|---------|---------|
| **OKR 分解** | `intent === 'okr-decompose'` | 1. 解析 vision → 2. 拆分 Objectives → 3. 为每个 O 生成 Key Results → 4. 将 KR 映射为可执行 Tasks → 5. 依赖分析 → 6. 输出 MilestoneTree |
| **周计划生成** | `intent === 'weekly-plan'` | 1. 拉取未完成任务列表 → 2. 分析上周完成情况（调用 Review Agent 协作接口） → 3. 按优先级排序 → 4. 分配到每日 → 5. 冲突检测 → 6. 输出 WeeklyPlan |
| **Today 编排** | `intent === 'today-arrange'` | 1. 拉取 today_on 标记的任务 → 2. 读取用户当日可用时间 → 3. 按 focus_rank 排序 → 4. 时间块分配 → 5. 输出 TodayArrangement |
| **自由规划** | `intent === 'free-form'` | 1. LLM 解析用户指令 → 2. 判断子意图 → 3. 委派到上述模板或动态执行 |

**与 Research Agent 协作接口**：
```typescript
export interface PlannerResearchBridge {
  requestEvidence(question: string, sourceScope: string[]): Promise<EvidencePackage>;
  requestFeasibilityCheck(taskDraft: TaskDraft): Promise<FeasibilityReport>;
}
```

Planner Agent 在 OKR 分解过程中如果遇到不确定的可行性问题，会通过此接口向 Research Agent 发起子任务请求，获得证据包后再决定任务拆分方式。

**输出回写规则**：
- TaskDraft 经用户确认后 → 调用 `create-task` capability → 写入 SQLite tasks 表
- MilestoneTree → 序列化为 project 对象的 metadata 字段
- PrioritySuggestion → 更新 task 的 focus_rank 字段
- TodayArrangement → 批量更新 task 的 today_on 和 focus_rank 字段

---

### 3.2 Reader Agent（阅读 Agent）

**职责**：对 Orbit 中的阅读对象（article, highlight, note）进行智能处理——全文摘要、段落解释、翻译、跨文献比较、建链建议。

```typescript
// packages/agent-core/src/agents/reader-agent.ts

export interface ReaderInput {
  readonly intent: 'summarize' | 'explain' | 'translate' | 'compare' | 'link-suggest';
  readonly objectIds: readonly string[];
  readonly selectionRange?: { start: number; end: number };
  readonly targetLanguage?: string;
  readonly question?: string;
}

export interface ReaderOutput {
  readonly summary?: ArticleSummary;
  readonly explanation?: ParagraphExplanation;
  readonly translation?: TranslationResult;
  readonly comparison?: CrossDocComparison;
  readonly linkSuggestions?: LinkSuggestion[];
}

export interface ArticleSummary {
  readonly headline: string;           // 一句话概括
  readonly keyPoints: readonly string[];  // 3-7 个要点
  readonly concepts: readonly string[];   // 涉及的核心概念（用于建链）
  readonly readingTime: number;           // 估算阅读时间（分钟）
}

export interface LinkSuggestion {
  readonly sourceObjectId: string;
  readonly targetObjectId: string;
  readonly reason: string;
  readonly confidence: number;
  readonly linkType: 'supports' | 'contradicts' | 'extends' | 'related';
}
```

**上下文装配策略**：
1. 加载目标 article 的全文内容（从 workspace-core 的文件系统拉取）
2. 若有 selectionRange，截取选区文本并标注上下文窗口（前后各 500 字符）
3. 加载该 article 的所有 highlights 和 notes
4. 加载 L2-object 记忆（之前对该文章的交互记录）
5. 对于 `compare` intent：加载所有目标 articles 的摘要

**执行模板库**：

| 模板 | 步骤流程 |
|------|---------|
| **全文摘要** | 1. 提取全文 → 2. 分段摘要（长文分 chunk） → 3. 合并摘要 → 4. 提取关键概念 → 5. 生成建链建议 → 6. 输出 ArticleSummary |
| **段落解释** | 1. 提取选区 → 2. 扩展上下文 → 3. LLM 解释 → 4. 术语列表 → 5. 关联推荐 |
| **跨文献比较** | 1. 加载多篇摘要 → 2. 提取共同主题 → 3. 差异分析 → 4. 矛盾点识别 → 5. 综合结论 → 6. 输出 CrossDocComparison |
| **建链建议** | 1. 提取当前文章关键概念 → 2. 搜索 workspace 中的相关对象（通过 Graph Agent 接口） → 3. 相似度评估 → 4. 分类建链类型 → 5. 输出 LinkSuggestion[] |

**输出回写规则**：
- ArticleSummary → 写入 article 对象的 metadata.summary 字段
- LinkSuggestion（经用户确认后）→ 调用 Graph Agent 的 `create-link` capability
- Translation → 作为 note 对象附加到原 article

---

### 3.3 Research Agent（研究 Agent）

**职责**：最复杂的 Agent 之一。它管理研究空间（research_space），执行多源并行信息检索，构建证据链，进行差异分析并识别知识缺口。

```typescript
// packages/agent-core/src/agents/research-agent.ts

export interface ResearchInput {
  readonly intent: 'deep-research' | 'quick-lookup' | 'evidence-gather' | 'gap-analysis';
  readonly question: string;
  readonly researchSpaceId?: string;
  readonly sourceConstraints?: {
    readonly includeWorkspace: boolean;
    readonly includeWeb: boolean;
    readonly maxSources: number;
    readonly preferredDomains?: readonly string[];
  };
}

export interface ResearchOutput {
  readonly evidencePackage: EvidencePackage;
  readonly gapAnalysis?: GapAnalysis;
  readonly sourceCredibilityMap: Record<string, number>;
}

export interface EvidencePackage {
  readonly question: string;
  readonly findings: readonly Finding[];
  readonly synthesis: string;            // 综合结论
  readonly confidenceScore: number;      // 整体置信度 0-1
  readonly sourceCount: number;
}

export interface Finding {
  readonly claim: string;
  readonly evidence: string;
  readonly sourceId: string;
  readonly sourceUrl?: string;
  readonly credibility: number;          // 来源可信度 0-1
  readonly supports: 'for' | 'against' | 'neutral';
}

export interface GapAnalysis {
  readonly coveredAspects: readonly string[];
  readonly gaps: readonly { aspect: string; importance: 'critical' | 'important' | 'nice-to-have'; suggestedQuery: string }[];
}
```

**并行检索策略**：

Research Agent 的核心优势是并行检索。它会将一个研究问题拆解为多个子查询，然后并行执行：

```typescript
// 执行步骤
// Step 1: 问题分解
//   将 "AI 对教育的影响" 分解为：
//   - "AI personalized learning effectiveness studies"
//   - "AI teacher workload impact research"
//   - "AI education equity concerns"
//   - "AI student engagement metrics"

// Step 2: 并行检索（最多 maxSources 个并发）
//   for each subQuery:
//     Promise.allSettled([
//       searchWorkspace(subQuery),     // 本地 workspace 搜索
//       webSearch(subQuery),           // 外部 web 搜索
//     ])

// Step 3: 来源可信度评估
//   对每个来源进行可信度打分（基于域名信誉、发表时间、引用次数等启发式规则）

// Step 4: 证据链构建
//   将各来源的发现按 supports/against/neutral 分类
//   构建证据链：finding → evidence → source → credibility

// Step 5: 差异分析 + 缺口识别
//   识别各来源之间的矛盾点
//   识别未被覆盖的知识领域
//   生成后续查询建议
```

**证据链管理**：
- 每个 Finding 记录完整的溯源路径（sourceId → sourceUrl → 原文位置）
- 支持证据的"刷新"——当来源内容更新时，重新验证 Finding 的有效性
- 证据包序列化后存入 L2-object 记忆层，供后续 Planner Agent 引用

**与 Planner Agent 的协作接口**：
```typescript
export interface ResearchPlannerBridge {
  provideEvidence(question: string): Promise<EvidencePackage>;
  assessFeasibility(proposal: string): Promise<{ feasible: boolean; concerns: string[]; evidence: Finding[] }>;
}
```

---

### 3.4 Writing Agent（写作 Agent）

**职责**：草稿撰写、文本编辑、风格润色。与其他 Agent 不同，Writing Agent 深度集成 Voice Profile（用户写作风格画像）和流式生成管道。

```typescript
// packages/agent-core/src/agents/writing-agent.ts

export interface WritingInput {
  readonly intent: 'draft' | 'edit' | 'rewrite' | 'expand' | 'condense' | 'continue';
  readonly targetObjectId?: string;
  readonly content?: string;
  readonly instructions: string;
  readonly voiceProfileId?: string;
  readonly referenceObjectIds?: readonly string[];
}

export interface WritingOutput {
  readonly content: string;
  readonly changes?: readonly TextChange[];    // 对原文的修改跟踪
  readonly citations?: readonly Citation[];
  readonly wordCount: number;
  readonly voiceConsistencyScore?: number;      // 风格一致性评分 0-1
}

export interface VoiceProfile {
  readonly id: string;
  readonly name: string;
  readonly traits: {
    readonly tone: string;         // "formal" | "casual" | "academic" | ...
    readonly complexity: string;   // "simple" | "moderate" | "sophisticated"
    readonly personality: string;  // "warm" | "objective" | "playful" | ...
  };
  readonly exemplars: readonly string[];  // 用户的写作范例
  readonly vocabulary: {
    readonly preferred: readonly string[];
    readonly avoided: readonly string[];
  };
}

export interface Citation {
  readonly text: string;
  readonly sourceObjectId: string;
  readonly sourceLocation?: string;
}
```

**Voice Profile 集成**：
1. 从 L3-user-longterm 记忆层加载用户的 VoiceProfile
2. 将 VoiceProfile 编译为 system prompt 中的风格约束段
3. 生成后进行风格一致性检查（与 exemplars 的相似度评分）
4. 若一致性低于阈值（0.7），自动触发一轮风格调整

**流式生成管道**：
```typescript
// Writing Agent 特有：与 M1 事件流管道集成
// 生成过程中实时推送 token 级事件

// async function* streamDraft(input: WritingInput, ctx: AgentJobContext) {
//   yield { type: 'writing:chunk', content: '...', timestamp: '...' };
//   yield { type: 'writing:chunk', content: '...', timestamp: '...' };
//   yield { type: 'writing:citation-inserted', citation: { ... }, timestamp: '...' };
//   yield { type: 'writing:complete', output: { ... }, timestamp: '...' };
// }
```

**引用管理**：
- 当 referenceObjectIds 中的对象被引用时，Writing Agent 自动生成 Citation 记录
- 引用格式遵循用户偏好（APA / Chicago / 内联链接）
- 引用的 sourceObjectId 会传递给 Graph Agent，自动建立 "cites" 类型的链接

**执行模板库**：

| 模板 | 步骤流程 |
|------|---------|
| **草稿撰写** | 1. 加载 VoiceProfile → 2. 加载参考资料摘要 → 3. 构建大纲 → 4. 分段流式生成 → 5. 风格一致性检查 → 6. 引用标注 → 7. 输出 WritingOutput |
| **编辑润色** | 1. 加载原文 → 2. 解析修改指令 → 3. 逐段对比修改 → 4. 生成 TextChange 列表 → 5. 风格检查 → 6. 输出 diff |
| **扩展/压缩** | 1. 加载原文 → 2. 分析当前字数与目标 → 3. 识别扩展/压缩点 → 4. 执行修改 → 5. 保持风格一致 |

---

### 3.5 Review Agent（回顾 Agent）

**职责**：基于 Timeline 数据进行模式识别和反思性回顾。与传统"代码审查"不同，这里的 Review 是对用户工作节奏和成果的周期性反思。

```typescript
// packages/agent-core/src/agents/review-agent.ts

export interface ReviewInput {
  readonly intent: 'daily-review' | 'weekly-review' | 'monthly-review' | 'quarterly-review' | 'custom-review';
  readonly timeRange: { start: string; end: string };
  readonly projectIds?: readonly string[];
  readonly focusAreas?: readonly ('productivity' | 'goal-progress' | 'reading-habits' | 'knowledge-growth')[];
}

export interface ReviewOutput {
  readonly period: { start: string; end: string };
  readonly highlights: readonly ReviewHighlight[];
  readonly patterns: readonly PatternObservation[];
  readonly suggestions: readonly ActionSuggestion[];
  readonly metrics: ReviewMetrics;
  readonly reflection: string;           // LLM 生成的反思文本
}

export interface ReviewHighlight {
  readonly objectId: string;
  readonly objectKind: string;
  readonly description: string;
  readonly significance: 'high' | 'medium' | 'low';
}

export interface PatternObservation {
  readonly pattern: string;              // "连续3天未完成规划任务"
  readonly frequency: number;
  readonly trend: 'improving' | 'declining' | 'stable';
  readonly relatedObjectIds: readonly string[];
}

export interface ReviewMetrics {
  readonly tasksCompleted: number;
  readonly tasksCreated: number;
  readonly articlesRead: number;
  readonly highlightsMade: number;
  readonly notesWritten: number;
  readonly linksCreated: number;
  readonly completionRate: number;       // 0-1
  readonly focusScore: number;           // 0-1，基于连续专注时间段
}
```

**Timeline 读取与模式识别**：
1. 从 SQLite 按时间范围查询所有对象的 CRUD 操作记录（tasks, articles, highlights, notes 的 created_at, updated_at, completed_at）
2. 构建 Timeline 事件流
3. 通过启发式规则 + LLM 识别行为模式（如"周三效率低"、"晚间阅读量大"、"项目 A 进度停滞"）
4. 对比历史周期的 ReviewMetrics，生成趋势分析

**回顾模板**：

| 周期 | 数据范围 | 核心输出 |
|------|---------|---------|
| **日回顾** | 当日 00:00 - 当前 | Today 任务完成率、阅读量、专注时间分析、明日建议 |
| **周回顾** | 本周一 - 当前 | 周目标达成率、模式识别（效率曲线）、下周规划建议 |
| **月回顾** | 本月 1 日 - 当前 | 项目进度总结、知识增长图谱、习惯趋势、季度目标对齐度 |
| **季度回顾** | 本季度第一天 - 当前 | OKR 达成评估、成长亮点、战略调整建议 |

**与 Planner Agent 的协作**：Review Agent 的 suggestions 可直接传递给 Planner Agent 作为下一周期规划的输入。

---

### 3.6 Graph Agent（图谱 Agent）

**职责**：管理对象网络——创建/删除链接、发现聚类、组装上下文召回包。它是其他 Agent 获取关联上下文的基础设施。

```typescript
// packages/agent-core/src/agents/graph-agent.ts

export interface GraphInput {
  readonly intent: 'link' | 'unlink' | 'cluster' | 'context-pack' | 'traverse' | 'auto-link';
  readonly objectIds: readonly string[];
  readonly linkType?: string;
  readonly traverseDepth?: number;
  readonly clusterAlgorithm?: 'topic' | 'temporal' | 'co-reference';
}

export interface GraphOutput {
  readonly links?: readonly GraphLink[];
  readonly clusters?: readonly ObjectCluster[];
  readonly contextPack?: ContextPack;
  readonly traversalResult?: TraversalResult;
}

export interface GraphLink {
  readonly sourceId: string;
  readonly targetId: string;
  readonly linkType: string;         // DOMAIN_RELATION_NAMES 或自定义语义链接
  readonly weight: number;           // 0-1 连接强度
  readonly createdBy: 'user' | 'agent';
  readonly evidence?: string;        // 建链理由
}

export interface ObjectCluster {
  readonly id: string;
  readonly label: string;
  readonly objectIds: readonly string[];
  readonly coherenceScore: number;   // 0-1 聚类内聚度
}

export interface ContextPack {
  readonly anchorObjectId: string;
  readonly relatedObjects: readonly { objectId: string; relevance: number; path: string[] }[];
  readonly totalTokenEstimate: number;
}
```

**建链算法**：
1. **共引用分析**：两个 article 被同一 highlight/note 关联 → 生成 "related" 链接
2. **概念重叠**：两个对象的关键概念集合 Jaccard 相似度 > 0.3 → 生成 "related" 链接
3. **时序邻近**：同一 session 中连续操作的对象 → 生成弱 "related" 链接
4. **语义嵌入**（如果可用）：对象内容的 embedding 余弦相似度 > 0.8 → 生成 "related" 链接

**对象聚类**：
- `topic`：基于关键概念的 TF-IDF 聚类
- `temporal`：基于创建/修改时间的时间窗口聚类
- `co-reference`：基于共同引用关系的聚类

**上下文召回包组装**：

当其他 Agent 需要关联上下文时，调用 Graph Agent 的 `context-pack` intent：
1. 以 anchorObjectId 为起点，进行广度优先遍历（默认深度 2）
2. 按 relevance 评分排序（综合链接权重、路径长度、时间衰减）
3. 将关联对象的摘要/内容截取到 token 预算内
4. 返回 ContextPack 供调用方注入 LLM 上下文

---

### 3.7 Ops Agent（运维 Agent）

**职责**：后台任务编排、数据导入/导出管道、批量操作、失败恢复。Ops Agent 有最宽泛的能力权限（包括 delete-object），但所有写操作需要 A2 或更高审批。

```typescript
// packages/agent-core/src/agents/ops-agent.ts

export interface OpsInput {
  readonly intent: 'import' | 'export' | 'bulk-update' | 'cleanup' | 'sync-repair' | 'migrate';
  readonly targetScope: 'workspace' | 'project' | 'selection';
  readonly objectIds?: readonly string[];
  readonly importSource?: {
    readonly format: 'opml' | 'csv' | 'json' | 'markdown' | 'readwise' | 'pocket' | 'instapaper';
    readonly data: string;
  };
  readonly exportFormat?: 'json' | 'csv' | 'markdown' | 'pdf';
  readonly bulkOperation?: {
    readonly operation: 'tag' | 'archive' | 'delete' | 'move';
    readonly params: Record<string, unknown>;
  };
}

export interface OpsOutput {
  readonly processedCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly failures: readonly { objectId: string; error: string }[];
  readonly exportUrl?: string;
  readonly importedObjectIds?: readonly string[];
}
```

**导入管道设计**：

```
原始数据 → 格式解析器 → 规范化 → 去重检测 → 对象创建 → 链接建立 → 索引更新
                ↓            ↓           ↓
           OPMLParser    Normalizer   DedupChecker
           CSVParser
           ReadwiseParser
           PocketParser
```

每个格式有独立的 Parser，统一输出 `NormalizedImportItem[]`。去重检测基于 sourceUrl + title 的组合指纹。

**批量操作的事务性保证**：
- 使用 SQLite 事务包裹批量操作
- 每处理 100 条记录写入一个 checkpoint
- 失败时可从最近 checkpoint 恢复
- 支持"dry run"模式——先模拟执行，报告将会发生的变更，用户确认后再实际执行

**失败恢复**：
- Ops Agent 维护一个本地的"操作日志"（op_log），记录每个写操作的 before/after 状态
- 当批量操作中途失败时，可以基于 op_log 执行回滚
- 回滚操作本身也是一个 AsyncJob，有独立的 checkpoint 和重试策略

---

### 3.8 Agent 间协作矩阵

| 调用方 → 被调用方 | 接口名称 | 场景 |
|:---:|:---:|:---|
| Planner → Research | `PlannerResearchBridge.requestEvidence()` | OKR 分解时验证可行性 |
| Planner → Review | `PlannerReviewBridge.getLastReview()` | 周计划时参考上周回顾 |
| Reader → Graph | `ReaderGraphBridge.suggestLinks()` | 摘要完成后建链建议 |
| Research → Reader | `ResearchReaderBridge.getSummary()` | 检索时获取已有文章摘要 |
| Writing → Research | `WritingResearchBridge.gatherReferences()` | 撰写时收集引用材料 |
| Writing → Graph | `WritingGraphBridge.recordCitations()` | 完成写作后记录引用链接 |
| Review → Planner | `ReviewPlannerBridge.suggestNextPlan()` | 回顾后生成规划建议 |
| Graph → Reader | `GraphReaderBridge.getObjectSummary()` | 聚类时获取对象摘要 |
| Ops → Graph | `OpsGraphBridge.rebuildIndex()` | 导入后重建索引和链接 |
| *any* → Graph | `GraphContextBridge.assembleContextPack()` | 任何 Agent 都可请求上下文包 |

所有跨 Agent 协作通过 **M6 的 AgentMessage 通信协议** 实现，不直接调用对方实例，而是通过 Orchestrator 的 `delegate()` 方法创建子 session。这确保了安全隔离（能力裁剪 + 预算独立）和可审计性。

---

## 四、学习回路 (LearningLoop)

### 4.1 经验提炼 Pipeline

每个 AsyncJob 完成后（无论成功还是失败），Learning Loop 会自动启动经验提炼流程。这是一个低优先级的后台任务，本身也是一个 `learning-task` 类型的 AsyncJob。

```typescript
// packages/agent-core/src/learning/learning-loop.ts

export interface LearningPipeline {
  extractInsights(job: AsyncJob, result: AgentJobResult): Promise<readonly LearningCandidate[]>;
  submitCandidates(candidates: readonly LearningCandidate[]): Promise<void>;
  reviewCandidate(candidateId: string, decision: 'approve' | 'reject' | 'defer'): Promise<void>;
  getActiveCandidates(): Promise<readonly LearningCandidate[]>;
}

export const LEARNING_CONTENT_TYPES = [
  'execution-template',   // 可复用的执行流程模板
  'user-preference',      // 用户偏好信号
  'strategy-optimization', // Agent 策略优化建议
] as const;
export type LearningContentType = (typeof LEARNING_CONTENT_TYPES)[number];

export const CANDIDATE_STATUSES = [
  'pending-review',    // 等待审核（高风险候选）
  'auto-approved',     // 自动批准（低风险候选）
  'approved',          // 用户审核通过
  'rejected',          // 用户审核拒绝
  'active',            // 已生效，正在使用中
  'retired',           // 已退役（被更好的候选替代）
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export interface LearningCandidate {
  readonly id: string;
  readonly type: LearningContentType;
  readonly status: CandidateStatus;
  readonly agentDomain: AgentDomain;
  readonly content: string;              // 提炼出的经验内容（JSON 结构化）
  readonly evidence: {
    readonly sourceJobId: string;        // 来源任务 ID
    readonly relevantSteps: readonly number[];  // 关键步骤序号
    readonly outcomeQuality: number;     // 任务结果质量评分 0-1
  };
  readonly riskLevel: 'low' | 'medium' | 'high';
  readonly usageCount: number;           // 被使用次数
  readonly successRate: number;          // 使用后的成功率
  readonly createdAt: string;
  readonly activatedAt?: string;
  readonly retiredAt?: string;
}
```

### 4.2 三类学习内容

#### 4.2.1 执行模板 (Execution Template)

当一个 Agent 在自由模式下（非预定义模板）成功完成了一个多步骤任务，且用户对结果满意时，Learning Loop 会尝试从执行记录中提炼出一个可复用的执行模板。

```typescript
export interface ExecutionTemplateCandidate {
  readonly name: string;
  readonly description: string;
  readonly agentDomain: AgentDomain;
  readonly triggerCondition: string;     // 什么情况下适用此模板
  readonly steps: readonly {
    readonly label: string;
    readonly description: string;
    readonly requiredCapabilities: readonly string[];
  }[];
  readonly expectedOutputSchema: Record<string, unknown>;
}
```

**提炼逻辑**：
1. 从 AgentRun 的 steps 中提取步骤序列
2. 过滤掉重试和错误恢复步骤（只保留"黄金路径"）
3. 泛化具体参数为占位符（如 "article_123" → "{articleId}"）
4. 用 LLM 生成模板描述和触发条件
5. 标记为 `pending-review` 或 `auto-approved`（取决于风险评估）

#### 4.2.2 用户偏好 (User Preference)

从用户的编辑行为、拒绝/接受记录中提炼偏好信号。

```typescript
export interface PreferenceCandidate {
  readonly dimension: 'output-style' | 'interaction-mode' | 'priority-pattern' | 'schedule-preference';
  readonly observation: string;          // "用户总是将摘要修改为更简洁的版本"
  readonly suggestedRule: string;        // "生成摘要时控制在 3 句话以内"
  readonly evidenceCount: number;        // 至少需要 3 次一致行为才提候选
}
```

**提炼逻辑**：
1. 追踪用户对 Agent 输出的修改（diff 分析）
2. 追踪用户的 approve/reject/edit 操作频率
3. 当同一维度出现 3 次以上一致信号时，生成偏好候选
4. 偏好候选默认为 `auto-approved`（低风险），但会展示给用户确认

#### 4.2.3 策略优化 (Strategy Optimization)

从任务执行的效率和质量指标中发现优化机会。

```typescript
export interface StrategyCandidate {
  readonly targetAgent: AgentDomain;
  readonly currentStrategy: string;
  readonly proposedStrategy: string;
  readonly expectedImprovement: string;
  readonly riskAssessment: string;
}
```

**提炼逻辑**：
1. 分析 Agent 的 token 使用效率（相同类型任务的 token 消耗趋势）
2. 分析重试频率和常见错误模式
3. 分析用户满意度信号（后续编辑量、重做率）
4. 当发现可优化模式时，生成策略候选
5. 策略候选默认为 `pending-review`（高风险）

### 4.3 候选层设计

候选层是 Learning Loop 的核心机制——它在"发现经验"和"应用经验"之间设置了一个缓冲区。

```
  任务完成
      ↓
  经验提炼
      ↓
┌─────────────────────────────────────┐
│           候选层 (Candidate Store)   │
│                                     │
│  ┌───────────┐  ┌───────────────┐   │
│  │ 高风险候选 │  │ 低风险候选    │   │
│  │ (pending)  │  │ (auto-approved)│  │
│  └─────┬─────┘  └───────┬───────┘   │
│        │                │            │
│   用户审核          灰度启用          │
│        │                │            │
│        ↓                ↓            │
│  ┌──────────────────────────┐       │
│  │      正式记忆层           │       │
│  │  (L4-procedural memory)  │       │
│  └──────────────────────────┘       │
└─────────────────────────────────────┘
```

**风险分级规则**：

| 候选类型 | 风险评估 | 处理方式 |
|---------|---------|---------|
| 执行模板 | 🔴 高风险 | `pending-review`：必须用户审核后才能激活。因为错误模板会导致 Agent 执行错误流程。 |
| 策略优化 | 🔴 高风险 | `pending-review`：策略变更可能影响所有同类任务。 |
| 用户偏好（输出风格） | 🟡 中风险 | `auto-approved`：灰度启用（先对 20% 任务应用），14 天后自动转正或退役。 |
| 用户偏好（交互模式） | 🟢 低风险 | `auto-approved`：立即生效，但展示通知让用户知晓。 |

**灰度启用机制**：
```typescript
export interface GrayReleaseConfig {
  readonly candidateId: string;
  readonly rolloutPercentage: number;    // 0-100
  readonly startDate: string;
  readonly evaluationPeriodDays: number; // 默认 14 天
  readonly successThreshold: number;     // 成功率阈值，低于则退役
}
```

- 灰度期间，Agent 在执行时会概率性地应用候选策略
- 系统会对比应用和未应用候选策略的任务结果
- 灰度期结束后，若成功率高于阈值则转为 `active`，否则转为 `retired`

### 4.4 审计记录

所有学习回路的操作都有完整的审计记录，存储在 SQLite 的 `learning_audit_log` 表中。

```typescript
export interface LearningAuditEntry {
  readonly id: string;
  readonly candidateId: string;
  readonly action: 'created' | 'auto-approved' | 'user-approved' | 'user-rejected' |
                   'activated' | 'retired' | 'gray-release-started' | 'gray-release-ended';
  readonly actor: string;                // 'system' | userId
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: string;
}
```

**SQLite 表设计**：

```sql
CREATE TABLE IF NOT EXISTS learning_candidates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'execution-template' | 'user-preference' | 'strategy-optimization'
  status TEXT NOT NULL DEFAULT 'pending-review',
  agent_domain TEXT NOT NULL,
  content_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  retired_at TEXT
);
CREATE INDEX idx_learning_candidates_status ON learning_candidates(status);
CREATE INDEX idx_learning_candidates_domain ON learning_candidates(agent_domain);

CREATE TABLE IF NOT EXISTS learning_audit_log (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  metadata_json TEXT,
  timestamp TEXT NOT NULL
);
CREATE INDEX idx_learning_audit_candidate ON learning_audit_log(candidate_id);
CREATE INDEX idx_learning_audit_timestamp ON learning_audit_log(timestamp);
```

---

## 五、文件变更清单与测试策略

### 5.1 文件变更清单

以下是 M7 涉及的所有新增和修改文件：

#### 新增文件（~2200 行）

| 文件路径 | 预估行数 | 职责 |
|---------|---------|------|
| `packages/agent-core/src/tasks/async-job.ts` | ~180 | AsyncJob 类型定义 + 状态机 + 转换验证 |
| `packages/agent-core/src/tasks/retry-strategy.ts` | ~80 | 重试策略：指数退避 + 抖动 + 可重试错误判定 |
| `packages/agent-core/src/tasks/checkpoint.ts` | ~120 | CheckpointManager 接口 + SQLite 实现 |
| `packages/agent-core/src/tasks/cancellation.ts` | ~60 | CancellationManager：AbortController 生命周期管理 |
| `packages/agent-core/src/tasks/priority-queue.ts` | ~90 | 最小堆优先级队列 |
| `packages/agent-core/src/tasks/task-scheduler.ts` | ~250 | TaskScheduler：调度循环 + 并发控制 + 公共 API |
| `packages/agent-core/src/tasks/cron-scheduler.ts` | ~100 | Cron 定时任务调度器 |
| `packages/agent-core/src/tasks/dag-scheduler.ts` | ~110 | DAG 依赖调度 |
| `packages/agent-core/src/tasks/index.ts` | ~30 | tasks 模块导出 |
| `packages/agent-core/src/agents/base-agent.ts` | ~150 | DomainAgentExecutor 基类 |
| `packages/agent-core/src/agents/planner-agent.ts` | ~180 | Planner Agent 专业化实现 |
| `packages/agent-core/src/agents/reader-agent.ts` | ~160 | Reader Agent 专业化实现 |
| `packages/agent-core/src/agents/research-agent.ts` | ~200 | Research Agent 专业化实现（并行检索 + 证据链） |
| `packages/agent-core/src/agents/writing-agent.ts` | ~170 | Writing Agent 专业化实现（流式生成 + Voice Profile） |
| `packages/agent-core/src/agents/review-agent.ts` | ~160 | Review Agent 专业化实现（Timeline + 模式识别） |
| `packages/agent-core/src/agents/graph-agent.ts` | ~150 | Graph Agent 专业化实现（建链 + 聚类 + 上下文包） |
| `packages/agent-core/src/agents/ops-agent.ts` | ~170 | Ops Agent 专业化实现（导入/导出 + 批量操作） |
| `packages/agent-core/src/agents/index.ts` | ~30 | agents 模块导出 |
| `packages/agent-core/src/learning/learning-loop.ts` | ~200 | 经验提炼 pipeline + 候选层管理 |
| `packages/agent-core/src/learning/candidate-store.ts` | ~120 | 候选存储：SQLite CRUD + 灰度发布逻辑 |
| `packages/agent-core/src/learning/index.ts` | ~20 | learning 模块导出 |

#### 修改文件（~200 行变更）

| 文件路径 | 变更内容 |
|---------|---------|
| `packages/agent-core/src/types.ts` | 新增 AsyncJobStatus, AsyncJobType, LearningContentType 等类型定义（+50 行） |
| `packages/agent-core/src/orchestrator.ts` | 集成 TaskScheduler 的 submitJob()；execute() 中增加异步任务提交逻辑（+40 行） |
| `packages/agent-core/src/domain-agents.ts` | 为每个 config 增加 executorClass 引用字段（+20 行） |
| `packages/agent-core/src/index.ts` | 新增 tasks/, agents/, learning/ 模块导出（+20 行） |
| `packages/db-schema/src/index.ts` | 新增 async_jobs, async_job_checkpoints, async_job_retries, learning_candidates, learning_audit_log 表定义（+70 行） |

#### 最终目录结构

```
packages/agent-core/src/
├── index.ts
├── types.ts                        // 修改：新增异步任务和学习相关类型
├── orchestrator.ts                 // 修改：集成 TaskScheduler
├── domain-agents.ts                // 修改：增加 executorClass 映射
├── tool-registry.ts
├── safety-gate.ts
├── memory-manager.ts
├── context-compressor.ts
├── llm-adapter.ts
├── tasks/                          // 🆕 异步任务中心
│   ├── index.ts
│   ├── async-job.ts
│   ├── retry-strategy.ts
│   ├── checkpoint.ts
│   ├── cancellation.ts
│   ├── priority-queue.ts
│   ├── task-scheduler.ts
│   ├── cron-scheduler.ts
│   └── dag-scheduler.ts
├── agents/                         // 🆕 7个专业化 Agent
│   ├── index.ts
│   ├── base-agent.ts
│   ├── planner-agent.ts
│   ├── reader-agent.ts
│   ├── research-agent.ts
│   ├── writing-agent.ts
│   ├── review-agent.ts
│   ├── graph-agent.ts
│   └── ops-agent.ts
└── learning/                       // 🆕 学习回路
    ├── index.ts
    ├── learning-loop.ts
    └── candidate-store.ts
```

### 5.2 测试策略

#### 单元测试（每个新文件对应一个 .test.ts）

| 测试文件 | 覆盖重点 | 关键用例 |
|---------|---------|---------|
| `tasks/async-job.test.ts` | 状态机转换 | 所有合法转换通过；所有非法转换抛出 InvalidJobTransitionError |
| `tasks/retry-strategy.test.ts` | 重试延迟计算 | 指数增长正确；抖动范围合理；最大延迟不超限；可重试错误判定正确 |
| `tasks/checkpoint.test.ts` | Checkpoint CRUD | 写入→读取一致；getLatest 返回最新；prune 保留正确数量 |
| `tasks/cancellation.test.ts` | 取消传播 | register → cancel → signal.aborted === true；cleanup 后 getSignal 返回 undefined |
| `tasks/priority-queue.test.ts` | 堆排序正确性 | 入队→出队按优先级+时间排序；remove 后堆仍有序；边界：空队列 dequeue 返回 undefined |
| `tasks/task-scheduler.test.ts` | 调度与并发 | 全局并发限制生效；按类型并发限制生效；任务失败后重试入队；取消递归传播到子任务 |
| `tasks/dag-scheduler.test.ts` | DAG 依赖 | 无依赖节点立即就绪；依赖完成后释放下游；环检测抛错 |
| `agents/base-agent.test.ts` | 基类行为 | checkpoint 自动写入；取消中断执行；进度事件正确发射 |
| `agents/planner-agent.test.ts` | 规划输出 | OKR 分解输出 MilestoneTree 结构正确；Today 编排的时间块不重叠 |
| `agents/research-agent.test.ts` | 并行检索 | 多源并行不超过 maxSources；EvidencePackage 包含所有 Finding |
| `learning/learning-loop.test.ts` | 经验提炼 | 成功任务提炼出模板候选；高风险标记 pending-review；灰度期结束后自动转正/退役 |
| `learning/candidate-store.test.ts` | 候选 CRUD | 写入→按状态查询；审核后状态更新；审计日志写入 |

#### 集成测试

| 场景 | 覆盖内容 |
|------|---------|
| **端到端异步任务** | 创建 AsyncJob → 入队 → 执行 → checkpoint 写入 → 完成 → 学习回路触发 |
| **失败重试恢复** | 创建任务 → 执行失败 → 重试（指数退避） → 从 checkpoint 恢复 → 成功完成 |
| **取消传播** | 创建父子任务 → 执行中取消父任务 → 子任务全部取消 → 状态一致 |
| **DAG 调度** | 创建 A→B→C 依赖链 → A 完成触发 B → B 完成触发 C → 父任务标记完成 |
| **跨 Agent 协作** | Planner 请求 Research 提供证据 → Research 执行并返回 → Planner 基于证据调整计划 |
| **cron 触发** | 注册 @daily-review cron 任务 → 模拟时间推进 → 验证 Review Agent 被触发 |

#### 测试基础设施

```typescript
// packages/agent-core/tests/helpers/mock-job-store.ts
// 提供 AsyncJobStore 的内存实现，用于单元测试

// packages/agent-core/tests/helpers/mock-event-bus.ts
// 提供 EventBus 的记录实现，断言事件序列正确

// packages/agent-core/tests/helpers/test-agent-factory.ts
// 快速构建带有 mock 依赖的 Agent 实例
```

### 5.3 实施顺序建议

```
Sprint 1（Week 1-2）：异步任务基础设施
  ├── async-job.ts + 状态机测试
  ├── retry-strategy.ts + 测试
  ├── checkpoint.ts + 测试
  ├── cancellation.ts + 测试
  ├── priority-queue.ts + 测试
  └── db-schema 扩展

Sprint 2（Week 3-4）：调度器 + Base Agent
  ├── task-scheduler.ts + 并发测试
  ├── cron-scheduler.ts + 测试
  ├── dag-scheduler.ts + 测试
  ├── base-agent.ts + 测试
  └── orchestrator.ts 集成修改

Sprint 3（Week 5-7）：7 个 Agent 专业化
  ├── planner-agent.ts + 测试
  ├── reader-agent.ts + 测试
  ├── research-agent.ts + 测试
  ├── writing-agent.ts + 测试
  ├── review-agent.ts + 测试
  ├── graph-agent.ts + 测试
  └── ops-agent.ts + 测试

Sprint 4（Week 8-9）：学习回路 + 集成测试
  ├── learning-loop.ts + 测试
  ├── candidate-store.ts + 测试
  ├── 集成测试全套
  └── index.ts 导出 + 文档更新
```

### 5.4 验收标准

1. **功能完备性**：所有 7 个 Agent 具有独立的执行逻辑、上下文装配策略、输出格式规范
2. **异步可靠性**：AsyncJob 支持创建→排队→执行→完成/失败/取消 完整生命周期
3. **断点续传**：任务中断后可从最近 checkpoint 恢复，不丢失已完成的中间结果
4. **取消传播**：取消操作在 3 秒内传播到所有子任务和进行中的 LLM 调用
5. **并发安全**：全局并发限制和按类型/域限制都能正确生效
6. **学习回路**：成功任务完成后自动生成候选经验，高风险候选需用户审核
7. **向后兼容**：现有的 `Orchestrator.execute()` 同步模式继续工作，不受 M7 变更影响
8. **测试覆盖**：单元测试覆盖率 ≥ 90%；所有集成测试场景通过
9. **性能要求**：优先级队列 enqueue/dequeue ≤ 1ms（1000 任务）；checkpoint 写入 ≤ 10ms

---

## 附录 A：事件类型扩展

M7 为 M1 的事件流管道新增以下事件类型：

```typescript
export type AsyncJobEvent =
  | { type: 'job:queued'; jobId: string; timestamp: string }
  | { type: 'job:started'; jobId: string; timestamp: string }
  | { type: 'job:progress'; jobId: string; progress: AsyncJobProgress; timestamp: string }
  | { type: 'job:completed'; jobId: string; result: AgentJobResult; timestamp: string }
  | { type: 'job:failed'; jobId: string; error: string; timestamp: string }
  | { type: 'job:cancelled'; jobId: string; cancelledBy: string; reason?: string; timestamp: string }
  | { type: 'job:paused'; jobId: string; timestamp: string }
  | { type: 'job:resumed'; jobId: string; timestamp: string }
  | { type: 'job:retrying'; jobId: string; attempt: number; delay: number; timestamp: string }
  | { type: 'job:checkpoint-saved'; jobId: string; stepIndex: number; timestamp: string }
  | { type: 'learning:candidate-created'; candidateId: string; type: LearningContentType; timestamp: string }
  | { type: 'learning:candidate-activated'; candidateId: string; timestamp: string }
  | { type: 'learning:candidate-retired'; candidateId: string; timestamp: string };
```

## 附录 B：跨端同步策略

AsyncJob 的跨端同步复用 Orbit 现有的 sync-core 协议（M1 依赖的 W2-D 同步通道）：

1. **状态同步**：async_jobs 表通过 Object LWW 通道同步。syncVersion 字段作为乐观锁防止冲突写入。
2. **冲突解决**：当两个设备同时修改同一个 job 的状态时，以 syncVersion 较高者为准。若 version 相同，以 updatedAt 较新者为准。
3. **事件广播**：AsyncJobEvent 通过 server notification-hub（WebSocket）实时推送到所有在线设备。
4. **离线设备**：设备上线后通过 sync pull 获取未同步的 job 状态变更。
5. **大对象回避**：checkpoint 的 intermediateState 不参与跨端同步（仅存在于执行设备本地）。只同步 job 的顶层状态。

## 附录 C：与 M1-M6 的接口约定

| 依赖里程碑 | M7 使用的接口 | 说明 |
|-----------|-------------|------|
| M1 事件流 | `AsyncGenerator<TypedEvent>` + `AbortController` | Task 执行事件流；取消信号传播 |
| M2 能力注册 | `CapabilityRegistry.getByDomain()` | Agent 获取各自域的可用能力 |
| M3 Safety Gate | `SafetyGateChain.check()` | Agent 执行能力前的安全检查 |
| M4 记忆系统 | `MemoryManager.recallForTurn()` + `MemoryStore.store()` | Agent 上下文装配 + 学习回路写入 L4 层 |
| M5 压缩引擎 | `CompressionEngine.compressSession()` | 长任务会话的上下文压缩 |
| M6 多 Agent 编排 | `Orchestrator.delegate()` + `AgentMessage` 协议 | 跨 Agent 协作通信 |
