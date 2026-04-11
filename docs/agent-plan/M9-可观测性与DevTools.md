# M9：可观测性与 DevTools — 深度开发计划

> **里程碑**：M9 — Observability & DevTools Infrastructure  
> **包**：`@orbit/agent-core`  
> **包路径**：`packages/agent-core/src/observability/`  
> **预估新增**：~2000 行源码 + ~800 行测试  
> **预估重构**：~300 行（对 orchestrator、tool-registry、safety-gate 注入 instrumentation）  
> **前置里程碑**：M1（事件流管道）、M0.5（多 LLM Provider 抽象）  
> **后置消费者**：M10（前端 Agent 交互层 — DevTools 面板）  
> **核心原则**：可观测性不是可选的调试工具，而是生产级 Agent 系统的基础设施；追踪、日志、指标三者必须互相关联（通过 traceId/spanId）

---

## 目录

0. [现状问题分析](#0-现状问题分析)
1. [分布式追踪（Tracing）](#1-分布式追踪tracing)
2. [结构化日志（Logging）](#2-结构化日志logging)
3. [指标收集（Metrics）](#3-指标收集metrics)
4. [健康诊断（Health Check）](#4-健康诊断health-check)
5. [洞察引擎（Insights）](#5-洞察引擎insights)
6. [错误分类与恢复（Error Classification）](#6-错误分类与恢复error-classification)
7. [会话检查器（Session Inspector）](#7-会话检查器session-inspector)
8. [接口设计总览](#8-接口设计总览)
9. [文件变更清单](#9-文件变更清单)
10. [与其他里程碑的关系](#10-与其他里程碑的关系)
11. [实施阶段](#11-实施阶段)

---

## 0. 现状问题分析

REVIEW 文档（`REVIEW-架构审查与改进建议.md`）明确指出当前 `@orbit/agent-core` 缺少统一的可观测性基础设施。具体问题如下：

| # | 问题 | 影响 | 优先级 |
|---|------|------|--------|
| P1 | 事件流仅有 `runId`，无 `traceId` / `parentSpanId` | M6/M7 多 Agent 编排时无法重建因果链 | 🔴 P0 |
| P2 | 步骤仅在完成后追溯记录，无实时 span 生命周期 | 长耗时工具调用期间，前端无法展示中间进度 | 🔴 P0 |
| P3 | 无结构化日志系统，`console.log` 散落各处 | 生产环境无法按模块/级别过滤，无法关联到 trace | 🔴 P0 |
| P4 | 无 LLM 调用指标（tokens、成本、延迟） | 无法进行成本分析和性能优化 | 🟡 P1 |
| P5 | 无健康诊断命令 | 环境问题（API Key 失效、Provider 宕机）排查困难 | 🟡 P1 |
| P6 | 错误类型未分类，所有异常统一 `throw Error` | 无法自动重试、降级、切换 Provider | 🔴 P0 |
| P7 | 无使用洞察 | 用户无法了解 token 消耗趋势和成本分布 | 🟡 P2 |

**参考系统**：hermes-agent 在可观测性方面的实践为本里程碑提供了重要参考——其 Insights 引擎（30+ 天 usage analytics）、`hermes doctor` 健康检查、10+ 错误分类与恢复策略、以及带完整 observability 列的会话数据库，均为成熟的设计模式。

---

## 1. 分布式追踪（Tracing）

### 1.1 设计目标

为 `@orbit/agent-core` 中的每一次 `orchestrator.execute()` 调用建立完整的 **Span 树**，使得：

1. 单次执行内的所有操作（意图路由、上下文组装、LLM 调用、工具分派、安全检查）都有 parent-child 关系
2. 多 Agent 委托链（M6 `delegate()`）通过 **linked trace** 保持跨 Agent 因果关系
3. 每个 span 携带足够的 attributes 供 DevTools 面板和日志系统消费
4. 导出层可插拔，开发模式用内存，生产模式可对接 OpenTelemetry

### 1.2 Trace 模型

```typescript
// packages/agent-core/src/observability/tracer.ts

/** Trace 上下文，跨 span 传播 */
export interface TraceContext {
  readonly traceId: string;       // 全局唯一，标识一次完整执行
  readonly spanId: string;        // 当前 span 唯一标识
  readonly parentSpanId?: string; // 父 span，root span 无此字段
  readonly baggage: ReadonlyMap<string, string>; // 跨进程传播的键值对
}

/** Span 类型枚举 */
export type SpanKind =
  | 'orchestrator'  // 顶层编排
  | 'agent'         // Agent 循环
  | 'tool'          // 工具调用
  | 'llm'           // LLM 请求
  | 'safety'        // 安全检查
  | 'memory'        // 记忆操作
  | 'compression'   // 上下文压缩
  | 'routing';      // 意图路由

/** Span 状态 */
export type SpanStatus = 'unset' | 'ok' | 'error';

/** Span 属性值类型 */
export type SpanAttributeValue = string | number | boolean | readonly string[];

/** 完整的 Span 定义 */
export interface Span {
  readonly context: TraceContext;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTime: number;     // performance.now() 或 Date.now()
  endTime?: number;
  status: SpanStatus;
  statusMessage?: string;
  readonly attributes: Map<string, SpanAttributeValue>;
  readonly events: SpanEvent[];   // span 生命周期内的离散事件
  readonly links: SpanLink[];     // 跨 trace 关联（用于 delegate()）

  /** 设置属性 */
  setAttribute(key: string, value: SpanAttributeValue): void;

  /** 记录 span 内事件（如 LLM streaming 开始、工具输出截断等） */
  addEvent(name: string, attributes?: Record<string, SpanAttributeValue>): void;

  /** 添加跨 trace 链接 */
  addLink(context: TraceContext, attributes?: Record<string, SpanAttributeValue>): void;

  /** 标记 span 完成 */
  end(status?: SpanStatus, message?: string): void;
}

/** Span 内离散事件 */
export interface SpanEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly attributes?: Readonly<Record<string, SpanAttributeValue>>;
}

/** 跨 Trace 链接（用于多 Agent 委托） */
export interface SpanLink {
  readonly context: TraceContext;
  readonly attributes?: Readonly<Record<string, SpanAttributeValue>>;
}
```

### 1.3 Tracer 接口

```typescript
// packages/agent-core/src/observability/tracer.ts

/** Span 导出器接口 */
export interface SpanExporter {
  export(spans: readonly Span[]): Promise<void>;
  shutdown(): Promise<void>;
}

/** Tracer 配置 */
export interface TracerConfig {
  readonly serviceName: string;           // 默认 '@orbit/agent-core'
  readonly exporters: readonly SpanExporter[];
  readonly defaultAttributes?: Readonly<Record<string, SpanAttributeValue>>;
  readonly maxSpansPerTrace?: number;     // 防止无限递归，默认 1000
  readonly flushIntervalMs?: number;      // 批量导出间隔，默认 5000
}

export interface StartSpanOptions {
  readonly name: string;
  readonly kind: SpanKind;
  readonly parent?: TraceContext;         // 不传则创建 root span
  readonly attributes?: Record<string, SpanAttributeValue>;
  readonly links?: SpanLink[];
}

/** 核心 Tracer */
export interface Tracer {
  /** 创建并启动一个新 span */
  startSpan(options: StartSpanOptions): Span;

  /** 获取当前活跃 span（通过 AsyncLocalStorage 传播） */
  getActiveSpan(): Span | undefined;

  /** 在 span 上下文中执行函数，自动传播 context */
  withSpan<T>(span: Span, fn: () => T | Promise<T>): Promise<T>;

  /** 强制导出所有待处理 spans */
  flush(): Promise<void>;

  /** 关闭 tracer，导出剩余数据 */
  shutdown(): Promise<void>;
}
```

**设计决策**：使用 Node.js `AsyncLocalStorage` 实现 context 自动传播，无需手动传递 `TraceContext`。在 `withSpan()` 内部启动的子 span 自动获取父 context。

### 1.4 Span 层级示例

一次典型的 `orchestrator.execute()` 调用产生的 span 树：

```
orchestrator.execute [trace-abc, span-root]
├── intent-routing [span-1, kind=routing]
│   ├── llm-call: classify-intent [span-1a, kind=llm]
│   │   ├── provider: openai
│   │   ├── model: gpt-4o-mini
│   │   └── tokens: {input: 85, output: 12}
│   └── duration: 320ms
├── context-assembly [span-2, kind=orchestrator]
│   ├── memory-recall [span-2a, kind=memory]
│   │   ├── layers_queried: [L1-session, L2-object, L3-learned]
│   │   ├── entries_returned: 7
│   │   └── duration: 15ms
│   └── context-compression [span-2b, kind=compression]
│       ├── strategy: tail-drop
│       ├── before_tokens: 12400
│       ├── after_tokens: 7800
│       └── compression_ratio: 0.63
├── llm-call-1 [span-3, kind=llm]
│   ├── provider: openai
│   ├── model: gpt-4o
│   ├── tokens: {input: 1200, output: 340, cached: 800}
│   ├── cost_usd: 0.0043
│   ├── duration: 1.8s
│   └── events:
│       ├── stream-start (t+50ms)
│       ├── tool-call-detected (t+1.2s)
│       └── stream-end (t+1.8s)
├── tool-dispatch: web_search [span-4, kind=tool]
│   ├── tool_name: web_search
│   ├── args: {query: "Orbit framework architecture"}
│   ├── duration: 2.3s
│   ├── result_size: 1500 chars
│   ├── result_truncated: false
│   └── status: ok
├── safety-check [span-5, kind=safety]
│   ├── chain: [ContextScanner, CapabilityPolicy, ApprovalGate]
│   ├── result: pass
│   ├── approval_tier: A2-confirm
│   └── duration: 4ms
├── llm-call-2 [span-6, kind=llm]
│   ├── provider: openai
│   ├── model: gpt-4o
│   ├── tokens: {input: 2800, output: 520}
│   └── duration: 2.1s
└── status: ok, total_duration: 6.8s
```

**多 Agent 委托场景**（M6 `delegate()`）：

```
coordinator.execute [trace-abc, span-root]
├── intent-routing [span-1] → domain: research
├── delegate: research-agent [span-2, kind=agent]
│   └── link → [trace-def]  ← 新 trace，通过 SpanLink 关联
│
research-agent.execute [trace-def, span-root]  ← linked from trace-abc
├── llm-call [span-r1]
├── tool-dispatch: arxiv_search [span-r2]
├── tool-dispatch: web_search [span-r3]
└── summary-generation [span-r4]
```

### 1.5 导出器实现

```typescript
// packages/agent-core/src/observability/exporters/memory-exporter.ts

/** 内存导出器 — 开发模式，供 DevTools 面板消费 */
export class InMemoryExporter implements SpanExporter {
  private spans: Span[] = [];
  private readonly maxSpans: number;

  constructor(maxSpans = 10000) {
    this.maxSpans = maxSpans;
  }

  async export(spans: readonly Span[]): Promise<void> {
    this.spans.push(...spans);
    // ring buffer: 超过上限时丢弃最老的
    if (this.spans.length > this.maxSpans) {
      this.spans = this.spans.slice(-this.maxSpans);
    }
  }

  /** 查询接口，供 DevTools 使用 */
  getSpansByTraceId(traceId: string): readonly Span[] {
    return this.spans.filter(s => s.context.traceId === traceId);
  }

  getRecentTraces(limit: number): readonly Span[] {
    return this.spans.slice(-limit);
  }

  async shutdown(): Promise<void> {
    this.spans = [];
  }
}
```

```typescript
// packages/agent-core/src/observability/exporters/console-exporter.ts

/** 控制台导出器 — 终端调试，带缩进的层级展示 */
export class ConsoleExporter implements SpanExporter {
  async export(spans: readonly Span[]): Promise<void> {
    for (const span of spans) {
      const duration = span.endTime
        ? `${(span.endTime - span.startTime).toFixed(1)}ms`
        : 'running';
      const status = span.status === 'error' ? '❌' : '✅';
      const indent = span.context.parentSpanId ? '  '.repeat(this.getDepth(span, spans)) : '';
      console.log(`${indent}${status} [${span.kind}] ${span.name} (${duration})`);
    }
  }

  private getDepth(span: Span, allSpans: readonly Span[]): number {
    let depth = 0;
    let current = span;
    while (current.context.parentSpanId) {
      const parent = allSpans.find(s => s.context.spanId === current.context.parentSpanId);
      if (!parent) break;
      current = parent;
      depth++;
    }
    return depth;
  }

  async shutdown(): Promise<void> {}
}
```

```typescript
// packages/agent-core/src/observability/exporters/json-file-exporter.ts

import { writeFile, appendFile } from 'node:fs/promises';

/** JSON 文件导出器 — 持久化到 JSON Lines 文件 */
export class JSONFileExporter implements SpanExporter {
  constructor(private readonly filePath: string) {}

  async export(spans: readonly Span[]): Promise<void> {
    const lines = spans.map(span => JSON.stringify({
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      parentSpanId: span.context.parentSpanId,
      name: span.name,
      kind: span.kind,
      startTime: span.startTime,
      endTime: span.endTime,
      status: span.status,
      attributes: Object.fromEntries(span.attributes),
      events: span.events,
      links: span.links,
    })).join('\n') + '\n';
    await appendFile(this.filePath, lines, 'utf-8');
  }

  async shutdown(): Promise<void> {}
}
```

```typescript
// packages/agent-core/src/observability/exporters/otel-exporter.ts

/**
 * OpenTelemetry 兼容导出器 — 预留接口
 *
 * 将内部 Span 转换为 OTLP 格式，发送到 OTel Collector。
 * 初期不实现完整 OTLP over gRPC/HTTP，仅定义转换逻辑，
 * 待实际需要时接入 @opentelemetry/exporter-trace-otlp-http。
 */
export interface OTelExporterConfig {
  readonly endpoint: string;      // e.g., 'http://localhost:4318/v1/traces'
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

// 初期导出为空实现，预留扩展点
export class OTelCompatExporter implements SpanExporter {
  constructor(private readonly config: OTelExporterConfig) {}

  async export(spans: readonly Span[]): Promise<void> {
    // TODO: 转换为 OTLP protobuf/JSON 格式并发送
    throw new Error('OTel exporter not yet implemented — use InMemory or JSON exporter');
  }

  async shutdown(): Promise<void> {}
}
```

### 1.6 与 M1 事件流的集成

M1 的 `BaseEvent` 需要扩展以携带 trace 上下文：

```typescript
// 对 M1 BaseEvent 的向后兼容扩展
export interface BaseEvent {
  readonly type: string;
  readonly runId: string;
  readonly timestamp: string;
  readonly traceId?: string;       // M9 新增，可选以保持向后兼容
  readonly spanId?: string;        // M9 新增
  readonly parentSpanId?: string;  // M9 新增
}
```

**设计决策**：三个新字段均为 `optional`，确保未启用 tracing 时的零开销，同时保持与 M1 事件消费者的向后兼容。

---

## 2. 结构化日志（Logging）

### 2.1 设计原则

1. **关联性**：每条日志可选关联 `traceId` / `spanId`，在 DevTools 面板中点击 span 即可看到关联日志
2. **层级性**：6 级日志，可按模块和级别独立配置
3. **可插拔**：Transport 层与 Logger 解耦，支持同时输出到多个目标
4. **零开销**：未启用的日志级别不应触发字符串拼接（使用惰性求值）

### 2.2 Logger 接口

```typescript
// packages/agent-core/src/observability/logger.ts

/** 日志级别，数值递增表示严重度递增 */
export const LogLevel = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
} as const;

export type LogLevelName = keyof typeof LogLevel;

/** 结构化日志条目 */
export interface LogEntry {
  readonly timestamp: string;       // ISO 8601
  readonly level: LogLevelName;
  readonly module: string;          // e.g., 'orchestrator', 'tool-registry', 'safety-gate'
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>; // 结构化上下文数据
  readonly traceId?: string;        // 关联 trace
  readonly spanId?: string;         // 关联 span
  readonly error?: {                // 错误详情（仅 error/fatal 级别）
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
}

/** 日志传输层接口 */
export interface LogTransport {
  readonly name: string;
  write(entry: LogEntry): void;
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}

/** 日志过滤规则 */
export interface LogFilter {
  readonly minLevel?: LogLevelName;
  readonly modules?: readonly string[];     // 仅输出这些模块的日志
  readonly excludeModules?: readonly string[]; // 排除这些模块
}

/** Logger 配置 */
export interface LoggerConfig {
  readonly defaultLevel: LogLevelName;
  readonly transports: readonly LogTransport[];
  readonly filter?: LogFilter;
  readonly moduleOverrides?: Readonly<Record<string, LogLevelName>>; // 按模块覆盖级别
}

/** Logger 实例接口 */
export interface Logger {
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  fatal(message: string, error?: Error, context?: Record<string, unknown>): void;

  /** 创建子 Logger，继承配置并固定 module 名 */
  child(module: string): Logger;

  /** 动态调整日志级别 */
  setLevel(level: LogLevelName): void;
}
```

### 2.3 内置 Transport 实现

```typescript
// packages/agent-core/src/observability/logger.ts

/** 控制台传输 — 带颜色和 emoji 前缀 */
export class ConsoleTransport implements LogTransport {
  readonly name = 'console';

  private readonly levelStyles: Record<LogLevelName, { emoji: string; color: string }> = {
    trace: { emoji: '🔍', color: '\x1b[90m' },  // gray
    debug: { emoji: '🐛', color: '\x1b[36m' },  // cyan
    info:  { emoji: 'ℹ️',  color: '\x1b[32m' },  // green
    warn:  { emoji: '⚠️',  color: '\x1b[33m' },  // yellow
    error: { emoji: '❌', color: '\x1b[31m' },  // red
    fatal: { emoji: '💀', color: '\x1b[35m' },  // magenta
  };

  write(entry: LogEntry): void {
    const style = this.levelStyles[entry.level];
    const reset = '\x1b[0m';
    const traceInfo = entry.traceId ? ` [trace:${entry.traceId.slice(0, 8)}]` : '';
    const prefix = `${style.emoji} ${style.color}[${entry.level.toUpperCase()}]${reset}`;
    const module = `\x1b[90m[${entry.module}]${reset}`;
    console.log(`${prefix} ${module}${traceInfo} ${entry.message}`);
    if (entry.context) {
      console.log(`  ${JSON.stringify(entry.context)}`);
    }
    if (entry.error?.stack) {
      console.log(`  ${entry.error.stack}`);
    }
  }
}

/** 文件传输 — JSON Lines 格式，支持日志轮转 */
export class FileTransport implements LogTransport {
  readonly name = 'file';
  private buffer: string[] = [];
  private readonly maxBufferSize: number;
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly filePath: string,
    options?: {
      maxBufferSize?: number;     // 默认 100 条后刷盘
      maxFileSizeBytes?: number;  // 默认 10MB 后轮转
    },
  ) {
    this.maxBufferSize = options?.maxBufferSize ?? 100;
    this.maxFileSizeBytes = options?.maxFileSizeBytes ?? 10 * 1024 * 1024;
  }

  write(entry: LogEntry): void {
    this.buffer.push(JSON.stringify(entry));
    if (this.buffer.length >= this.maxBufferSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const lines = this.buffer.join('\n') + '\n';
    this.buffer = [];
    // 实际实现需检查文件大小并执行轮转
    const { appendFile } = await import('node:fs/promises');
    await appendFile(this.filePath, lines, 'utf-8');
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }
}

/** 缓冲传输 — 内存 ring buffer，供 DevTools UI 实时消费 */
export class BufferTransport implements LogTransport {
  readonly name = 'buffer';
  private entries: LogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  write(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /** 查询最近日志 — 供 DevTools 面板使用 */
  getEntries(filter?: {
    level?: LogLevelName;
    module?: string;
    traceId?: string;
    limit?: number;
  }): readonly LogEntry[] {
    let result: LogEntry[] = this.entries;
    if (filter?.level) {
      result = result.filter(e => LogLevel[e.level] >= LogLevel[filter.level!]);
    }
    if (filter?.module) {
      result = result.filter(e => e.module === filter.module);
    }
    if (filter?.traceId) {
      result = result.filter(e => e.traceId === filter.traceId);
    }
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }
    return result;
  }
}
```

---

## 3. 指标收集（Metrics）

### 3.1 设计原则

指标系统遵循 **RED 方法**（Rate, Errors, Duration）和 **USE 方法**（Utilization, Saturation, Errors）的思路，但适配 Agent 场景：

1. **LLM 调用**：请求数、token 数、成本、延迟分布
2. **工具执行**：调用数、成功率、延迟分布
3. **Agent 循环**：迭代次数、会话时长
4. **安全系统**：拦截数、审批请求数
5. **上下文管理**：压缩比、记忆召回数

### 3.2 指标类型接口

```typescript
// packages/agent-core/src/observability/metrics.ts

/** 标签键值对 */
export type Labels = Readonly<Record<string, string>>;

/** Counter — 只增不减的累计计数器 */
export interface Counter {
  readonly name: string;
  readonly description: string;
  inc(value?: number, labels?: Labels): void;
  get(labels?: Labels): number;
  reset(): void;
}

/** Histogram — 值分布观测（延迟、大小等） */
export interface Histogram {
  readonly name: string;
  readonly description: string;
  readonly buckets: readonly number[];
  observe(value: number, labels?: Labels): void;
  /** 获取分位数 */
  percentile(p: number, labels?: Labels): number;
  /** 获取所有桶的计数 */
  getBuckets(labels?: Labels): ReadonlyMap<number, number>;
  reset(): void;
}

/** Gauge — 可升可降的瞬时值 */
export interface Gauge {
  readonly name: string;
  readonly description: string;
  set(value: number, labels?: Labels): void;
  inc(value?: number, labels?: Labels): void;
  dec(value?: number, labels?: Labels): void;
  get(labels?: Labels): number;
}

/** 指标收集器 — 所有指标的注册中心 */
export interface MetricCollector {
  createCounter(name: string, description: string): Counter;
  createHistogram(name: string, description: string, buckets?: readonly number[]): Histogram;
  createGauge(name: string, description: string): Gauge;
  getCounter(name: string): Counter | undefined;
  getHistogram(name: string): Histogram | undefined;
  getGauge(name: string): Gauge | undefined;

  /** 导出所有指标的快照 */
  snapshot(): MetricSnapshot;

  /** 重置所有指标 */
  reset(): void;
}

/** 指标快照 — 某一时刻所有指标的只读副本 */
export interface MetricSnapshot {
  readonly timestamp: string;
  readonly counters: ReadonlyMap<string, ReadonlyMap<string, number>>;   // name → labels_key → value
  readonly histograms: ReadonlyMap<string, HistogramSnapshot>;
  readonly gauges: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

export interface HistogramSnapshot {
  readonly count: number;
  readonly sum: number;
  readonly buckets: ReadonlyMap<number, number>;
  readonly percentiles: { p50: number; p90: number; p95: number; p99: number };
}
```

### 3.3 内置指标定义

以下指标在 `MetricCollector` 初始化时自动注册：

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `llm_requests_total` | Counter | `provider`, `model`, `status` | LLM 请求总数 |
| `llm_tokens_total` | Counter | `provider`, `model`, `direction` | Token 使用量（direction: input/output/cached） |
| `llm_request_duration_seconds` | Histogram | `provider`, `model` | LLM 请求延迟分布 |
| `llm_cost_usd_total` | Counter | `provider`, `model` | LLM 累计成本（美元） |
| `tool_executions_total` | Counter | `tool`, `status` | 工具执行总数 |
| `tool_execution_duration_seconds` | Histogram | `tool` | 工具执行延迟分布 |
| `agent_iterations_total` | Counter | `domain` | Agent 循环迭代总数 |
| `memory_recall_count` | Counter | `layer` | 记忆召回次数（按 layer 分组） |
| `safety_blocks_total` | Counter | `threat_type` | 安全拦截次数（按威胁类型） |
| `approval_requests_total` | Counter | `tier`, `outcome` | 审批请求次数（tier: A1/A2/A3, outcome: approved/denied/timeout） |
| `context_compression_ratio` | Gauge | — | 最近一次上下文压缩比 |
| `active_sessions` | Gauge | — | 当前活跃会话数 |

### 3.4 指标存储

```typescript
// packages/agent-core/src/observability/metrics.ts

/** 内存指标存储 — 最近 1 小时，ring buffer */
export class InMemoryMetricStore {
  private snapshots: MetricSnapshot[] = [];
  private readonly maxSnapshots: number;
  private readonly intervalMs: number;

  constructor(options?: {
    maxSnapshots?: number;    // 默认 720（每 5 秒一次，1 小时）
    intervalMs?: number;      // 默认 5000
  }) {
    this.maxSnapshots = options?.maxSnapshots ?? 720;
    this.intervalMs = options?.intervalMs ?? 5000;
  }

  push(snapshot: MetricSnapshot): void {
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /** 查询时间范围内的快照 */
  query(from: string, to: string): readonly MetricSnapshot[] {
    return this.snapshots.filter(
      s => s.timestamp >= from && s.timestamp <= to,
    );
  }
}

/**
 * SQLite 指标存储 — 持久化，供 Insights 引擎查询
 *
 * 表结构：
 *   metric_snapshots(id, timestamp, data JSON)
 *   metric_aggregates(period, metric_name, labels_key, value, updated_at)
 *
 * 聚合粒度：5min / 1hour / 1day
 */
export interface SQLiteMetricStoreConfig {
  readonly dbPath: string;
  readonly retentionDays?: number;   // 默认 90 天
}
```

---

## 4. 健康诊断（Health Check）

### 4.1 `orbit doctor` 命令

类似 `hermes doctor`，提供一键式环境健康检查：

```typescript
// packages/agent-core/src/observability/health-checker.ts

/** 单项检查结果 */
export interface CheckResult {
  readonly name: string;
  readonly status: 'pass' | 'warn' | 'fail';
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly duration: number;       // 检查耗时（ms）
  readonly suggestion?: string;    // 修复建议
}

/** 总体健康状态 */
export interface HealthStatus {
  readonly overall: 'healthy' | 'degraded' | 'unhealthy';
  readonly checks: readonly CheckResult[];
  readonly timestamp: string;
}

/** 健康检查器接口 */
export interface HealthChecker {
  /** 执行所有检查 */
  runAll(): Promise<HealthStatus>;

  /** 执行指定检查 */
  runCheck(name: string): Promise<CheckResult>;

  /** 注册自定义检查 */
  registerCheck(name: string, checker: () => Promise<CheckResult>): void;
}
```

#### 检查项清单

| # | 检查项 | 检测内容 | 失败影响 |
|---|--------|----------|----------|
| 1 | `node-version` | Node.js 版本 ≥ 18.0 | 🔴 致命 |
| 2 | `llm-provider-connectivity` | 逐个 ping 已配置的 LLM Provider | 🔴 无法执行 Agent |
| 3 | `api-key-validity` | 发送最小请求验证 API Key | 🔴 无法执行 Agent |
| 4 | `tool-availability` | 检查每个已注册工具的运行时依赖 | 🟡 部分工具不可用 |
| 5 | `database-integrity` | SQLite `PRAGMA integrity_check` | 🔴 记忆/指标数据损坏 |
| 6 | `memory-store-health` | 检查记忆存储读写一致性 | 🟡 记忆系统降级 |
| 7 | `mcp-server-connection` | 检查 MCP Server 连接和 handshake | 🟡 MCP 工具不可用 |
| 8 | `config-syntax` | 校验配置文件 JSON/YAML 语法 | 🔴 无法启动 |
| 9 | `disk-space` | 检查 DB 文件所在分区可用空间 | 🟡 可能写入失败 |
| 10 | `rate-limit-status` | 检查各 Provider 当前速率限制剩余额度 | 🟡 可能被限流 |

#### CLI 输出示例

```
$ orbit doctor

🏥 Orbit Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Node.js version         v20.11.0 (≥ 18.0)                  2ms
✅ LLM: OpenAI             connected, latency 120ms            125ms
✅ LLM: Anthropic          connected, latency 95ms             98ms
⚠️  API Key: Google         key configured but quota low (12%)  340ms
✅ Tools: filesystem        all dependencies met                 1ms
✅ Tools: web_search        all dependencies met                 3ms
✅ Database integrity       ok (3 tables, 1247 rows)            15ms
✅ Memory store             read/write consistent                8ms
❌ MCP: local-server        connection refused (localhost:3100)  5002ms
✅ Config syntax            valid                                1ms
✅ Disk space               42.3 GB available                    1ms
⚠️  Rate limit: OpenAI      67% remaining (resets in 45min)     0ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall: ⚠️  DEGRADED (1 failure, 1 warning)

Suggestions:
  • MCP local-server: check if server is running on port 3100
  • Google API: quota is low, consider upgrading plan
```

### 4.2 运行时健康监控

```typescript
// packages/agent-core/src/observability/health-checker.ts

/** 运行时健康监控器 */
export interface HealthMonitor {
  /** 启动周期性健康检查 */
  start(intervalMs?: number): void;  // 默认 300_000（5 分钟）

  /** 停止监控 */
  stop(): void;

  /** 获取最近的健康状态 */
  getLatestStatus(): HealthStatus | undefined;

  /** 监听健康状态变化 */
  on(event: 'health:degraded', handler: (status: HealthStatus) => void): void;
  on(event: 'health:recovered', handler: (status: HealthStatus) => void): void;
  on(event: 'health:check-completed', handler: (status: HealthStatus) => void): void;
}
```

**降级自动切换**：当 `HealthMonitor` 检测到某个 LLM Provider 不可用时，emit `health:degraded` 事件。M0.5 的 `ModelSelector` 可订阅该事件，自动将流量切换到备用 Provider。

---

## 5. 洞察引擎（Insights）

### 5.1 设计目标

提供按时间范围的使用分析报告，帮助用户理解 Agent 的使用模式和成本分布。参考 hermes-agent 的 Insights 模块，支持 30+ 天的历史数据分析。

### 5.2 查询接口

```typescript
// packages/agent-core/src/observability/insights.ts

/** 时间范围 */
export type TimeRange =
  | { preset: 'last_24h' | 'last_7d' | 'last_30d' }
  | { from: string; to: string };  // ISO 8601

/** 洞察查询参数 */
export interface InsightsQuery {
  readonly timeRange: TimeRange;
  readonly groupBy?: 'provider' | 'model' | 'tool' | 'domain' | 'hour_of_day';
  readonly metrics?: readonly (
    | 'token_usage'
    | 'cost'
    | 'tool_calls'
    | 'session_duration'
    | 'error_rate'
    | 'activity_pattern'
  )[];
  readonly topN?: number;           // Top-N 查询的 N 值，默认 10
}

/** 洞察报告 */
export interface InsightsReport {
  readonly query: InsightsQuery;
  readonly generatedAt: string;

  /** 总览 */
  readonly summary: {
    readonly totalSessions: number;
    readonly totalTokens: { input: number; output: number; cached: number };
    readonly totalCostUsd: number;
    readonly totalToolCalls: number;
    readonly avgSessionDuration: number;  // 秒
    readonly errorRate: number;           // 0-1
  };

  /** 按分组维度的明细 */
  readonly breakdown: readonly InsightsBreakdownItem[];

  /** Token 使用趋势（按小时/天聚合） */
  readonly tokenTrend: readonly TimeSeriesPoint[];

  /** 成本趋势 */
  readonly costTrend: readonly TimeSeriesPoint[];

  /** 活跃时段分布（24 小时） */
  readonly activityPattern: readonly { hour: number; count: number }[];

  /** 最高成本会话 Top-N */
  readonly topCostSessions: readonly SessionCostEntry[];
}

export interface InsightsBreakdownItem {
  readonly key: string;             // 分组键值（如 provider 名称）
  readonly tokenUsage: { input: number; output: number };
  readonly costUsd: number;
  readonly callCount: number;
  readonly avgDuration: number;     // 秒
  readonly errorRate: number;
}

export interface TimeSeriesPoint {
  readonly timestamp: string;
  readonly value: number;
}

export interface SessionCostEntry {
  readonly sessionId: string;
  readonly startTime: string;
  readonly duration: number;
  readonly totalTokens: number;
  readonly costUsd: number;
  readonly toolCalls: number;
}

/** 洞察引擎 */
export interface InsightsEngine {
  query(params: InsightsQuery): Promise<InsightsReport>;

  /** 导出为 JSON */
  exportJSON(report: InsightsReport): string;

  /** 渲染为 CLI 文本报告 */
  renderCLI(report: InsightsReport): string;
}
```

### 5.3 CLI 报告示例

```
$ orbit insights --range 7d

📊 Orbit Usage Insights (Last 7 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary
  Sessions:     47
  Total Tokens: 284,350 (input: 198,440 / output: 85,910)
  Total Cost:   $3.42
  Tool Calls:   312
  Avg Duration: 4.2 min
  Error Rate:   2.1%

Cost by Provider
  ┌──────────────┬──────────┬──────────┬─────────┐
  │ Provider     │ Requests │ Tokens   │ Cost    │
  ├──────────────┼──────────┼──────────┼─────────┤
  │ OpenAI       │ 89       │ 214,200  │ $2.87   │
  │ Anthropic    │ 34       │ 70,150   │ $0.55   │
  └──────────────┴──────────┴──────────┴─────────┘

Top Tools
  ┌──────────────────┬───────┬──────────┬──────────┐
  │ Tool             │ Calls │ Avg Time │ Success% │
  ├──────────────────┼───────┼──────────┼──────────┤
  │ web_search       │ 124   │ 1.8s     │ 97.6%    │
  │ file_read        │ 98    │ 0.1s     │ 100%     │
  │ code_execute     │ 52    │ 3.4s     │ 92.3%    │
  │ arxiv_search     │ 38    │ 2.1s     │ 94.7%    │
  └──────────────────┴───────┴──────────┴──────────┘

Activity Pattern (UTC)
  00 ░░░░░░░░░░
  06 ███░░░░░░░
  12 █████████░
  18 ████████░░
```

---

## 6. 错误分类与恢复（Error Classification）

### 6.1 设计目标

当前代码中所有异常统一 `throw new Error(...)`，这导致：

1. 调用方无法区分可重试错误和不可重试错误
2. 无法自动降级（如 Provider 宕机时切换备用）
3. 用户收到的错误信息不友好
4. 无法统计各类错误的频率和趋势

参考 hermes-agent 的 10+ 错误分类体系，定义 Orbit 的错误层次结构和恢复策略矩阵。

### 6.2 错误类型体系

```typescript
// packages/agent-core/src/observability/error-classifier.ts

/** 错误类别枚举 */
export type ErrorCategory =
  | 'AUTH'              // 401/403, token expired, invalid key
  | 'RATE_LIMIT'        // 429, quota exhausted
  | 'CONTEXT_OVERFLOW'  // context too long for model
  | 'SERVER'            // 5xx, provider outage
  | 'NETWORK'           // timeout, DNS, connection refused
  | 'TOOL'              // tool execution failure
  | 'SAFETY'            // blocked by safety gate
  | 'VALIDATION'        // invalid input/schema
  | 'BUDGET'            // cost limit exceeded
  | 'TIMEOUT'           // operation timeout
  | 'UNKNOWN';          // 未分类

/** 分类后的错误 */
export interface ClassifiedError {
  readonly category: ErrorCategory;
  readonly originalError: Error;
  readonly provider?: string;           // 相关 Provider（如适用）
  readonly model?: string;              // 相关模型（如适用）
  readonly httpStatus?: number;         // HTTP 状态码（如适用）
  readonly retryAfter?: number;         // 秒，仅 RATE_LIMIT
  readonly contextTokens?: number;      // 当前上下文 token 数，仅 CONTEXT_OVERFLOW
  readonly maxTokens?: number;          // 模型最大 token 数，仅 CONTEXT_OVERFLOW
  readonly userMessage: string;         // 面向用户的友好消息
  readonly internalMessage: string;     // 面向开发者的详细消息
}

/** 恢复策略 */
export interface RecoveryStrategy {
  readonly retry: {
    readonly enabled: boolean;
    readonly maxAttempts: number;
    readonly backoff: 'exponential' | 'linear' | 'fixed';
    readonly baseDelayMs: number;
    readonly jitter: boolean;           // 添加随机抖动避免 thundering herd
  };
  readonly failover: {
    readonly enabled: boolean;
    readonly switchProvider: boolean;    // 切换 Provider
    readonly downgradeModel: boolean;   // 降级到更小模型
  };
  readonly compress: {
    readonly enabled: boolean;          // 自动压缩上下文
  };
  readonly notify: {
    readonly enabled: boolean;
    readonly level: 'info' | 'warn' | 'error';
  };
  readonly degrade: {
    readonly enabled: boolean;
    readonly description: string;       // 降级行为描述
  };
}

/** 错误分类器接口 */
export interface ErrorClassifier {
  /** 将原始 Error 分类为 ClassifiedError */
  classify(error: Error, context?: {
    provider?: string;
    model?: string;
    operation?: string;
  }): ClassifiedError;

  /** 获取指定类别的恢复策略 */
  getRecoveryStrategy(category: ErrorCategory): RecoveryStrategy;

  /** 注册自定义分类规则 */
  registerRule(
    test: (error: Error) => boolean,
    category: ErrorCategory,
    priority?: number,
  ): void;
}
```

### 6.3 恢复策略矩阵

| 错误类别 | 重试 | 退避策略 | 切换 Provider | 降级模型 | 自动压缩 | 通知用户 | 降级行为 |
|----------|------|----------|--------------|----------|----------|----------|----------|
| `AUTH` | ❌ 不重试 | — | ✅ | ❌ | ❌ | 🔴 error | 切换到有效 key 的 Provider |
| `RATE_LIMIT` | ✅ 3 次 | exponential + jitter | ✅ | ❌ | ❌ | 🟡 warn | 等待 retryAfter 或切换 Provider |
| `CONTEXT_OVERFLOW` | ✅ 1 次 | — | ❌ | ✅ 128k→ 更大窗口 | ✅ | 🟡 warn | 自动压缩后重试 |
| `SERVER` | ✅ 3 次 | exponential + jitter | ✅ | ❌ | ❌ | 🟡 warn | 切换备用 Provider |
| `NETWORK` | ✅ 5 次 | exponential | ❌ | ❌ | ❌ | 🔴 error | 等待网络恢复 |
| `TOOL` | ✅ 2 次 | fixed 1s | ❌ | ❌ | ❌ | ℹ️ info | 跳过该工具，告知 LLM 工具暂不可用 |
| `SAFETY` | ❌ 不重试 | — | ❌ | ❌ | ❌ | 🔴 error | 拒绝执行，返回安全说明 |
| `VALIDATION` | ❌ 不重试 | — | ❌ | ❌ | ❌ | 🔴 error | 返回 schema 校验错误详情 |
| `BUDGET` | ❌ 不重试 | — | ❌ | ✅ 降级到廉价模型 | ❌ | 🔴 error | 通知预算耗尽，建议调整限额 |
| `TIMEOUT` | ✅ 2 次 | exponential | ✅ | ❌ | ❌ | 🟡 warn | 增加 timeout 后重试或切换 Provider |

### 6.4 分类规则实现示例

```typescript
// packages/agent-core/src/observability/error-classifier.ts

/** 内置分类规则 — 按优先级排序 */
const builtinRules: Array<{
  test: (error: Error & { status?: number; code?: string }) => boolean;
  category: ErrorCategory;
}> = [
  // HTTP 状态码分类
  { test: e => e.status === 401 || e.status === 403, category: 'AUTH' },
  { test: e => e.status === 429, category: 'RATE_LIMIT' },
  { test: e => e.status !== undefined && e.status >= 500, category: 'SERVER' },

  // 特定错误消息模式
  { test: e => /context.*(too long|overflow|exceed)/i.test(e.message), category: 'CONTEXT_OVERFLOW' },
  { test: e => /maximum context length/i.test(e.message), category: 'CONTEXT_OVERFLOW' },
  { test: e => /rate limit/i.test(e.message), category: 'RATE_LIMIT' },
  { test: e => /quota/i.test(e.message), category: 'RATE_LIMIT' },
  { test: e => /invalid.*api.*key/i.test(e.message), category: 'AUTH' },
  { test: e => /budget.*exceed/i.test(e.message), category: 'BUDGET' },

  // 网络错误
  { test: e => e.code === 'ECONNREFUSED', category: 'NETWORK' },
  { test: e => e.code === 'ENOTFOUND', category: 'NETWORK' },
  { test: e => e.code === 'ETIMEDOUT', category: 'NETWORK' },
  { test: e => e.code === 'ECONNRESET', category: 'NETWORK' },
  { test: e => /timeout/i.test(e.message), category: 'TIMEOUT' },

  // 安全相关
  { test: e => /safety|blocked|content.policy/i.test(e.message), category: 'SAFETY' },
  { test: e => /validation|schema|invalid.*input/i.test(e.message), category: 'VALIDATION' },
];
```

---

## 7. 会话检查器（Session Inspector）

### 7.1 设计目标

提供单个会话维度的深度调试工具，类似 hermes-agent 的 trajectory saving 功能。将会话的完整执行历史（消息、工具调用、trace、指标）聚合为可检索的快照。

### 7.2 接口定义

```typescript
// packages/agent-core/src/observability/session-inspector.ts

/** 会话快照 — 某个会话的完整可观测性数据 */
export interface SessionSnapshot {
  readonly sessionId: string;
  readonly startTime: string;
  readonly endTime?: string;
  readonly status: 'active' | 'completed' | 'error' | 'timeout';

  /** 消息历史 */
  readonly messages: readonly MessageEntry[];

  /** 工具调用记录 */
  readonly toolCalls: readonly ToolCallEntry[];

  /** Trace 摘要 */
  readonly traces: readonly TraceSummary[];

  /** Token 使用统计 */
  readonly tokenUsage: {
    readonly total: { input: number; output: number; cached: number };
    readonly byModel: ReadonlyMap<string, { input: number; output: number }>;
  };

  /** 累计成本 */
  readonly costUsd: number;

  /** Safety gate 决策记录 */
  readonly safetyDecisions: readonly SafetyDecisionEntry[];

  /** 错误记录 */
  readonly errors: readonly ClassifiedError[];
}

export interface MessageEntry {
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  readonly content: string;
  readonly timestamp: string;
  readonly tokenCount?: number;
}

export interface ToolCallEntry {
  readonly toolName: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly result?: unknown;
  readonly status: 'success' | 'error' | 'timeout';
  readonly duration: number;
  readonly timestamp: string;
  readonly spanId?: string;
}

export interface TraceSummary {
  readonly traceId: string;
  readonly rootSpanName: string;
  readonly spanCount: number;
  readonly duration: number;
  readonly status: SpanStatus;
}

export interface SafetyDecisionEntry {
  readonly gate: string;
  readonly decision: 'pass' | 'block' | 'approve';
  readonly tier?: string;
  readonly reason?: string;
  readonly timestamp: string;
}

/** 会话检查器 */
export interface SessionInspector {
  /** 获取会话快照 */
  getSnapshot(sessionId: string): Promise<SessionSnapshot | undefined>;

  /** 列出最近的会话 */
  listSessions(options?: {
    limit?: number;
    status?: SessionSnapshot['status'];
    since?: string;
  }): Promise<readonly SessionSnapshot[]>;

  /** 导出会话为 JSON（用于调试/训练数据） */
  exportSession(sessionId: string): Promise<string>;

  /** 比较两个会话的差异（如 A/B 测试） */
  diffSessions(sessionA: string, sessionB: string): Promise<SessionDiff>;
}

export interface SessionDiff {
  readonly sessionA: string;
  readonly sessionB: string;
  readonly tokenDelta: { input: number; output: number };
  readonly costDelta: number;
  readonly durationDelta: number;
  readonly toolCallDelta: number;
  readonly qualitativeNotes: string[];   // 自动生成的差异摘要
}
```

### 7.3 Trajectory 保存

参考 hermes-agent 的 trajectory 机制，每个会话可导出为标准化的 JSON 格式，用于：

1. **调试**：复现问题时加载历史 trajectory
2. **训练数据**：收集高质量 trajectory 用于 fine-tuning
3. **回归测试**：对比不同版本的 Agent 对相同输入的表现

```typescript
/** Trajectory 格式 — 与 hermes-agent 兼容 */
export interface Trajectory {
  readonly version: '1.0';
  readonly sessionId: string;
  readonly timestamp: string;
  readonly config: {
    readonly model: string;
    readonly provider: string;
    readonly tools: readonly string[];
  };
  readonly turns: readonly TrajectoryTurn[];
  readonly metadata: {
    readonly totalTokens: number;
    readonly totalCost: number;
    readonly duration: number;
    readonly outcome: 'success' | 'error' | 'timeout' | 'cancelled';
  };
}

export interface TrajectoryTurn {
  readonly index: number;
  readonly input: string;           // 用户输入或系统指令
  readonly reasoning?: string;      // Agent 的推理过程（如有）
  readonly actions: readonly TrajectoryAction[];
  readonly output: string;          // Agent 最终输出
  readonly tokenUsage: { input: number; output: number };
}

export interface TrajectoryAction {
  readonly type: 'tool_call' | 'llm_call' | 'delegate';
  readonly name: string;
  readonly args?: Readonly<Record<string, unknown>>;
  readonly result?: unknown;
  readonly duration: number;
}
```

---

## 8. 接口设计总览

以下汇总 M9 所有对外暴露的核心接口及其职责：

| 接口 | 文件 | 职责 |
|------|------|------|
| `Tracer` | `tracer.ts` | 创建 span、管理 context 传播、导出 |
| `Span` | `tracer.ts` | 单个操作的生命周期和属性 |
| `SpanExporter` | `tracer.ts` | span 数据导出协议 |
| `Logger` | `logger.ts` | 结构化日志写入 |
| `LogTransport` | `logger.ts` | 日志传输层协议 |
| `MetricCollector` | `metrics.ts` | 指标注册和收集 |
| `Counter` / `Histogram` / `Gauge` | `metrics.ts` | 三种指标类型 |
| `HealthChecker` | `health-checker.ts` | 静态健康诊断 |
| `HealthMonitor` | `health-checker.ts` | 运行时持续监控 |
| `InsightsEngine` | `insights.ts` | 使用分析查询和报告 |
| `ErrorClassifier` | `error-classifier.ts` | 错误分类和恢复策略 |
| `SessionInspector` | `session-inspector.ts` | 会话级调试和检查 |

### 统一 Observable 容器

为简化使用，提供一个统一入口将所有子系统串联：

```typescript
// packages/agent-core/src/observability/index.ts

export interface ObservabilityConfig {
  readonly tracing?: TracerConfig;
  readonly logging?: LoggerConfig;
  readonly metrics?: { enabled: boolean };
  readonly health?: { checkIntervalMs?: number };
  readonly insights?: SQLiteMetricStoreConfig;
}

/** 统一可观测性容器 — 一次初始化，全局使用 */
export interface ObservabilityContainer {
  readonly tracer: Tracer;
  readonly logger: Logger;
  readonly metrics: MetricCollector;
  readonly health: HealthChecker & HealthMonitor;
  readonly insights: InsightsEngine;
  readonly errors: ErrorClassifier;
  readonly inspector: SessionInspector;

  /** 初始化所有子系统 */
  init(config: ObservabilityConfig): Promise<void>;

  /** 关闭所有子系统，导出剩余数据 */
  shutdown(): Promise<void>;
}
```

---

## 9. 文件变更清单

### 9.1 新增文件

#### `packages/agent-core/src/observability/tracer.ts`（~350 行）

分布式追踪核心实现：`TraceContext`、`Span`、`Tracer`，基于 `AsyncLocalStorage` 的 context 传播。

#### `packages/agent-core/src/observability/logger.ts`（~250 行）

结构化日志系统：`Logger`、`LogEntry`、三种内置 Transport（Console、File、Buffer）。

#### `packages/agent-core/src/observability/metrics.ts`（~300 行）

指标收集器：`Counter`、`Histogram`、`Gauge` 实现，`InMemoryMetricStore`、`SQLiteMetricStore` 配置。

#### `packages/agent-core/src/observability/health-checker.ts`（~250 行）

健康诊断：10 项内置检查 + 运行时 `HealthMonitor`。

#### `packages/agent-core/src/observability/insights.ts`（~200 行）

洞察引擎：`InsightsQuery` → `InsightsReport` 查询逻辑，CLI 文本渲染器。

#### `packages/agent-core/src/observability/error-classifier.ts`（~250 行）

错误分类器：11 种错误类别，内置分类规则，恢复策略矩阵。

#### `packages/agent-core/src/observability/session-inspector.ts`（~200 行）

会话检查器：`SessionSnapshot`、`Trajectory` 导出、会话 diff。

#### `packages/agent-core/src/observability/exporters/memory-exporter.ts`（~60 行）

内存 span 导出器，开发模式使用。

#### `packages/agent-core/src/observability/exporters/console-exporter.ts`（~50 行）

控制台 span 导出器，终端调试使用。

#### `packages/agent-core/src/observability/exporters/json-file-exporter.ts`（~40 行）

JSON Lines 文件 span 导出器。

#### `packages/agent-core/src/observability/exporters/otel-exporter.ts`（~30 行）

OpenTelemetry 兼容导出器（预留接口）。

#### `packages/agent-core/src/observability/index.ts`（~80 行）

统一入口：`ObservabilityContainer` 实现，barrel export。

### 9.2 修改文件

#### `packages/agent-core/src/orchestrator.ts`（修改量：~120 行新增）

- 在 `execute()` / `executeStream()` 入口创建 root span
- 每个 agent loop 迭代创建 child span
- 注入 logger 调用替换 `console.log`
- 在工具分派前后记录指标

#### `packages/agent-core/src/tool-registry.ts`（修改量：~80 行新增）

- 在 `dispatch()` 中创建 tool span
- 记录 `tool_executions_total` 和 `tool_execution_duration_seconds` 指标
- 工具错误经过 `ErrorClassifier` 分类

#### `packages/agent-core/src/safety/` 相关文件（修改量：~60 行新增）

- SafetyChain 中创建 safety span
- 记录 `safety_blocks_total` 和 `approval_requests_total` 指标

#### `packages/agent-core/src/llm-adapter.ts`（修改量：~40 行新增）

- LLM 调用创建 llm span，记录 provider/model/tokens 属性
- 记录 `llm_requests_total`、`llm_tokens_total`、`llm_cost_usd_total` 指标
- 解析 response headers 中的 rate limit 信息

---

## 10. 与其他里程碑的关系

```
M0.5 (LLM Provider 抽象)
  ├── M9 为每个 Provider 调用添加 tracing + metrics
  └── M9 ErrorClassifier 为 Provider 错误提供分类和恢复策略

M1 (事件流管道)
  ├── M9 Tracer instruments 每个事件的产生
  ├── BaseEvent 扩展 traceId / spanId / parentSpanId 字段
  └── 事件流消费者可通过 traceId 关联到完整 span 树

M3 (SafetyGate 责任链)
  ├── M9 为每个 safety check 创建 span
  └── M9 记录 safety_blocks_total / approval_requests_total 指标

M4 (多层记忆系统)
  ├── M9 记录 memory_recall_count 指标
  ├── M9 SQLiteMetricStore 可复用 M4 的 SQLite 基础设施
  └── M9 health-checker 包含记忆存储健康检查

M5 (会话谱系与压缩引擎)
  ├── M9 为压缩操作创建 compression span
  └── M9 记录 context_compression_ratio 指标

M6 (混合多 Agent 编排)
  ├── M9 通过 SpanLink 支持跨 Agent 的 trace 关联
  └── M9 SessionInspector 支持多 Agent 会话的聚合视图

M7 (异步任务与领域 Agent)
  ├── M9 为异步任务创建独立 trace
  └── M9 Insights 引擎按 domain 维度分析各领域 Agent 的使用模式

M10 (前端 Agent 交互层) — 主要消费者
  ├── InMemoryExporter → DevTools 面板实时 trace 可视化
  ├── BufferTransport → DevTools 面板实时日志流
  ├── MetricCollector.snapshot() → Dashboard 数据源
  └── SessionInspector → 会话详情页
```

---

## 11. 实施阶段

### Phase 1：核心基础设施（优先级最高）

| 任务 | 文件 | 预估行数 |
|------|------|----------|
| Tracer + InMemoryExporter + ConsoleExporter | `tracer.ts`, `exporters/` | ~400 |
| Logger + ConsoleTransport + BufferTransport | `logger.ts` | ~200 |
| ErrorClassifier + 恢复策略矩阵 | `error-classifier.ts` | ~250 |
| 对 orchestrator / tool-registry 的基础 instrumentation | 现有文件修改 | ~150 |

**产出**：开发模式下可在终端看到结构化 span 层级和彩色日志，错误可自动分类和恢复。

### Phase 2：指标与持久化

| 任务 | 文件 | 预估行数 |
|------|------|----------|
| MetricCollector + 内置指标注册 | `metrics.ts` | ~300 |
| JSONFileExporter | `exporters/json-file-exporter.ts` | ~40 |
| FileTransport（日志持久化 + 轮转） | `logger.ts` 扩展 | ~50 |
| LLM adapter / safety gate instrumentation | 现有文件修改 | ~100 |

**产出**：所有 LLM 调用和工具执行有完整指标，span 和日志可持久化到文件。

### Phase 3：诊断与洞察

| 任务 | 文件 | 预估行数 |
|------|------|----------|
| HealthChecker + 10 项检查实现 | `health-checker.ts` | ~250 |
| InsightsEngine + CLI 渲染器 | `insights.ts` | ~200 |
| SessionInspector + Trajectory 导出 | `session-inspector.ts` | ~200 |
| ObservabilityContainer 统一入口 | `index.ts` | ~80 |

**产出**：`orbit doctor` 命令可用，`orbit insights` 报告可用，会话可导出为 trajectory。

### Phase 4：OpenTelemetry 兼容（可选，按需）

| 任务 | 文件 | 预估行数 |
|------|------|----------|
| OTelCompatExporter 实现 | `exporters/otel-exporter.ts` | ~150 |
| SQLiteMetricStore 持久化 | `metrics.ts` 扩展 | ~200 |
| HealthMonitor 运行时监控 | `health-checker.ts` 扩展 | ~100 |

**产出**：可对接外部 OpenTelemetry Collector，指标持久化到 SQLite 支持长期洞察查询。
