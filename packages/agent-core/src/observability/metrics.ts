// ---------------------------------------------------------------------------
// @orbit/agent-core – Metrics
// ---------------------------------------------------------------------------

// ---- Types ----

export interface MetricValue {
  readonly name: string;
  readonly labels: Record<string, string>;
  readonly value: number;
  readonly timestamp: number;
}

// ---- Helpers ----

function labelKey(labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) return '{}';
  const sorted = Object.keys(labels).sort();
  const obj: Record<string, string> = {};
  for (const k of sorted) obj[k] = labels[k];
  return JSON.stringify(obj);
}

function parseLabels(key: string): Record<string, string> {
  if (key === '{}') return {};
  return JSON.parse(key) as Record<string, string>;
}

// ---- Counter ----

export class Counter {
  readonly name: string;
  readonly description: string;
  private readonly values = new Map<string, number>();

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  inc(labels?: Record<string, string>, value = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  get(labels?: Record<string, string>): number {
    return this.values.get(labelKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  /** @internal */
  _snapshot(): MetricValue[] {
    const now = Date.now();
    const result: MetricValue[] = [];
    for (const [key, value] of this.values) {
      result.push({ name: this.name, labels: parseLabels(key), value, timestamp: now });
    }
    return result;
  }
}

// ---- Histogram ----

interface HistogramData {
  count: number;
  sum: number;
}

export class Histogram {
  readonly name: string;
  readonly description: string;
  readonly buckets: number[];
  private readonly data = new Map<string, HistogramData>();

  constructor(name: string, description: string, buckets?: number[]) {
    this.name = name;
    this.description = description;
    this.buckets = buckets ?? [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  }

  observe(value: number, labels?: Record<string, string>): void {
    const key = labelKey(labels);
    let entry = this.data.get(key);
    if (!entry) {
      entry = { count: 0, sum: 0 };
      this.data.set(key, entry);
    }
    entry.count += 1;
    entry.sum += value;
  }

  getCount(labels?: Record<string, string>): number {
    return this.data.get(labelKey(labels))?.count ?? 0;
  }

  getSum(labels?: Record<string, string>): number {
    return this.data.get(labelKey(labels))?.sum ?? 0;
  }

  getAvg(labels?: Record<string, string>): number {
    const entry = this.data.get(labelKey(labels));
    if (!entry || entry.count === 0) return 0;
    return entry.sum / entry.count;
  }

  reset(): void {
    this.data.clear();
  }

  /** @internal */
  _snapshot(): MetricValue[] {
    const now = Date.now();
    const result: MetricValue[] = [];
    for (const [key, entry] of this.data) {
      const labels = parseLabels(key);
      result.push({ name: `${this.name}_count`, labels, value: entry.count, timestamp: now });
      result.push({ name: `${this.name}_sum`, labels, value: entry.sum, timestamp: now });
      if (entry.count > 0) {
        result.push({
          name: `${this.name}_avg`,
          labels,
          value: entry.sum / entry.count,
          timestamp: now,
        });
      }
    }
    return result;
  }
}

// ---- Gauge ----

export class Gauge {
  readonly name: string;
  readonly description: string;
  private readonly values = new Map<string, number>();

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  set(value: number, labels?: Record<string, string>): void {
    this.values.set(labelKey(labels), value);
  }

  inc(labels?: Record<string, string>, value = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  dec(labels?: Record<string, string>, value = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) - value);
  }

  get(labels?: Record<string, string>): number {
    return this.values.get(labelKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  /** @internal */
  _snapshot(): MetricValue[] {
    const now = Date.now();
    const result: MetricValue[] = [];
    for (const [key, value] of this.values) {
      result.push({ name: this.name, labels: parseLabels(key), value, timestamp: now });
    }
    return result;
  }
}

// ---- AgentMetrics ----

export class AgentMetrics {
  readonly llmRequestsTotal = new Counter('llm_requests_total', 'Total LLM requests');
  readonly llmTokensTotal = new Counter('llm_tokens_total', 'Total LLM tokens consumed');
  readonly llmRequestDuration = new Histogram('llm_request_duration_ms', 'LLM request duration in ms');
  readonly llmCostUsd = new Counter('llm_cost_usd', 'Total LLM cost in USD');
  readonly toolExecutionsTotal = new Counter('tool_executions_total', 'Total tool executions');
  readonly toolExecutionDuration = new Histogram('tool_execution_duration_ms', 'Tool execution duration in ms');
  readonly agentIterationsTotal = new Counter('agent_iterations_total', 'Total agent iterations');
  readonly memoryRecallCount = new Counter('memory_recall_count', 'Memory recall operations');
  readonly safetyBlocksTotal = new Counter('safety_blocks_total', 'Safety-blocked requests');
  readonly approvalRequestsTotal = new Counter('approval_requests_total', 'Approval requests');
  readonly contextCompressionRatio = new Gauge('context_compression_ratio', 'Context compression ratio');
  readonly activeSessions = new Gauge('active_sessions', 'Currently active sessions');

  snapshot(): Record<string, MetricValue[]> {
    const result: Record<string, MetricValue[]> = {};
    const metrics = [
      this.llmRequestsTotal,
      this.llmTokensTotal,
      this.llmRequestDuration,
      this.llmCostUsd,
      this.toolExecutionsTotal,
      this.toolExecutionDuration,
      this.agentIterationsTotal,
      this.memoryRecallCount,
      this.safetyBlocksTotal,
      this.approvalRequestsTotal,
      this.contextCompressionRatio,
      this.activeSessions,
    ] as const;

    for (const metric of metrics) {
      const values = metric._snapshot();
      if (values.length > 0) {
        result[metric.name] = values;
      }
    }
    return result;
  }

  reset(): void {
    this.llmRequestsTotal.reset();
    this.llmTokensTotal.reset();
    this.llmRequestDuration.reset();
    this.llmCostUsd.reset();
    this.toolExecutionsTotal.reset();
    this.toolExecutionDuration.reset();
    this.agentIterationsTotal.reset();
    this.memoryRecallCount.reset();
    this.safetyBlocksTotal.reset();
    this.approvalRequestsTotal.reset();
    this.contextCompressionRatio.reset();
    this.activeSessions.reset();
  }
}
