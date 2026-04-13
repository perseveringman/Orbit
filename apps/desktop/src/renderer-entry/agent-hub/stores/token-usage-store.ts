// ---------------------------------------------------------------------------
// Token Usage Store — persistent localStorage tracking of LLM token usage
// ---------------------------------------------------------------------------

import { CostTracker, type CostRecord, estimateCost } from '@orbit/agent-core';

const STORAGE_KEY = 'orbit:token-usage-records';
const MAX_RECORDS = 10_000;

// ---- Subscription helpers ----

type UsageListener = () => void;
const usageListeners = new Set<UsageListener>();

// Cached snapshots for useSyncExternalStore (must be referentially stable)
let recordsSnapshot: TokenUsageRecord[] | null = null;
let summarySnapshot: UsageSummary | null = null;

function notifyUsageListeners(): void {
  recordsSnapshot = null;
  summarySnapshot = null;
  for (const fn of usageListeners) {
    try { fn(); } catch { /* listener errors should not break the store */ }
  }
}

export interface TokenUsageRecord {
  readonly id: string;
  readonly model: string;
  readonly provider: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
  readonly timestamp: number;
  readonly sessionId?: string;
}

export interface UsageSummary {
  readonly totalTokens: number;
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalCostUsd: number;
  readonly sessionCount: number;
  readonly recordCount: number;
}

export interface UsageByDimension {
  readonly key: string;
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly count: number;
}

let idCounter = 0;
function genId(): string {
  return `tu-${Date.now()}-${++idCounter}`;
}

/**
 * Persistent token usage store backed by localStorage.
 * Integrates with agent-core's CostTracker for cost estimation.
 */
export class TokenUsageStore {
  private static tracker = new CostTracker();

  /**
   * Subscribe to usage changes. Returns an unsubscribe function.
   * Compatible with React's `useSyncExternalStore`.
   */
  static subscribe(listener: UsageListener): () => void {
    usageListeners.add(listener);
    return () => { usageListeners.delete(listener); };
  }

  /**
   * Record a new LLM call's token usage.
   */
  static record(params: {
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    sessionId?: string;
  }): TokenUsageRecord {
    const totalTokens = params.promptTokens + params.completionTokens;
    const cost = estimateCost(params.model, {
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens,
    });

    // Also track in in-memory CostTracker
    TokenUsageStore.tracker.record(params.model, params.provider, {
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens,
    });

    const record: TokenUsageRecord = {
      id: genId(),
      model: params.model,
      provider: params.provider,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens,
      estimatedCostUsd: cost,
      timestamp: Date.now(),
      sessionId: params.sessionId,
    };

    recordsSnapshot = null;
    summarySnapshot = null;
    const records = TokenUsageStore.loadRecords();
    records.push(record);

    // Trim to max records (keep newest)
    if (records.length > MAX_RECORDS) {
      records.splice(0, records.length - MAX_RECORDS);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // localStorage full — drop oldest half
      records.splice(0, Math.floor(records.length / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch { /* give up */ }
    }

    notifyUsageListeners();
    return record;
  }

  /**
   * Load all stored records.
   */
  static loadRecords(): TokenUsageRecord[] {
    if (recordsSnapshot) return recordsSnapshot;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      recordsSnapshot = raw ? (JSON.parse(raw) as TokenUsageRecord[]) : [];
    } catch {
      recordsSnapshot = [];
    }
    return recordsSnapshot;
  }

  /**
   * Get summary statistics.
   */
  static getSummary(): UsageSummary {
    if (summarySnapshot) return summarySnapshot;
    const records = TokenUsageStore.loadRecords();
    const sessions = new Set(records.map((r) => r.sessionId).filter(Boolean));

    summarySnapshot = {
      totalTokens: records.reduce((s, r) => s + r.totalTokens, 0),
      totalPromptTokens: records.reduce((s, r) => s + r.promptTokens, 0),
      totalCompletionTokens: records.reduce((s, r) => s + r.completionTokens, 0),
      totalCostUsd: records.reduce((s, r) => s + r.estimatedCostUsd, 0),
      sessionCount: sessions.size || (records.length > 0 ? 1 : 0),
      recordCount: records.length,
    };
    return summarySnapshot;
  }

  /**
   * Get usage grouped by model.
   */
  static getByModel(): UsageByDimension[] {
    return TokenUsageStore.groupBy((r) => r.model);
  }

  /**
   * Get usage grouped by provider.
   */
  static getByProvider(): UsageByDimension[] {
    return TokenUsageStore.groupBy((r) => r.provider);
  }

  /**
   * Get records within a time range.
   */
  static getByTimeRange(startMs: number, endMs: number): TokenUsageRecord[] {
    return TokenUsageStore.loadRecords().filter(
      (r) => r.timestamp >= startMs && r.timestamp <= endMs,
    );
  }

  /**
   * Get usage grouped by day (YYYY-MM-DD keys).
   */
  static getByDay(): UsageByDimension[] {
    return TokenUsageStore.groupBy((r) => {
      const d = new Date(r.timestamp);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }

  /**
   * Get the in-memory CostTracker (for budget checks).
   */
  static getCostTracker(): CostTracker {
    return TokenUsageStore.tracker;
  }

  /**
   * Clear all stored records.
   */
  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    TokenUsageStore.tracker = new CostTracker();
    notifyUsageListeners();
  }

  private static groupBy(keyFn: (r: TokenUsageRecord) => string): UsageByDimension[] {
    const records = TokenUsageStore.loadRecords();
    const map = new Map<string, { tokens: number; cost: number; count: number }>();

    for (const r of records) {
      const key = keyFn(r);
      const existing = map.get(key) ?? { tokens: 0, cost: 0, count: 0 };
      existing.tokens += r.totalTokens;
      existing.cost += r.estimatedCostUsd;
      existing.count += 1;
      map.set(key, existing);
    }

    return Array.from(map.entries()).map(([key, v]) => ({
      key,
      totalTokens: v.tokens,
      totalCost: v.cost,
      count: v.count,
    }));
  }
}
