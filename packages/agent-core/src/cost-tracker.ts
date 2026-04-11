// ---------------------------------------------------------------------------
// @orbit/agent-core – Cost Tracker
// ---------------------------------------------------------------------------

import type { TokenUsage } from './types.js';
import { estimateCost } from './model-metadata.js';

// ---- Types ----

export interface CostRecord {
  readonly model: string;
  readonly provider: string;
  readonly usage: TokenUsage;
  readonly estimatedCostUsd: number;
  readonly timestamp: number;
}

export interface BudgetConfig {
  readonly maxCostPerSession: number;
  readonly maxCostPerDay: number;
  readonly warnThreshold: number; // 0.0–1.0
}

export type BudgetStatus =
  | { readonly status: 'ok'; readonly spent: number; readonly limit: number }
  | { readonly status: 'warning'; readonly spent: number; readonly limit: number }
  | { readonly status: 'exceeded'; readonly spent: number; readonly limit: number };

// ---- Cost Tracker ----

/**
 * Tracks token usage and estimated cost across a session, and checks
 * spending against configurable budget limits.
 */
export class CostTracker {
  private records: CostRecord[] = [];

  /**
   * Record a completed LLM call's usage.
   * Returns the created CostRecord with estimated cost.
   */
  record(model: string, provider: string, usage: TokenUsage): CostRecord {
    const cost = estimateCost(model, usage);
    const record: CostRecord = {
      model,
      provider,
      usage,
      estimatedCostUsd: cost,
      timestamp: Date.now(),
    };
    this.records.push(record);
    return record;
  }

  /**
   * Get total estimated cost for the current session.
   */
  getSessionTotal(): number {
    return this.records.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
  }

  /**
   * Get all recorded cost records.
   */
  getRecords(): readonly CostRecord[] {
    return this.records;
  }

  /**
   * Check spending against budget limits.
   * Uses session total against maxCostPerSession.
   */
  checkBudget(config: BudgetConfig): BudgetStatus {
    const spent = this.getSessionTotal();
    const limit = config.maxCostPerSession;

    if (spent >= limit) {
      return { status: 'exceeded', spent, limit };
    }

    if (spent >= limit * config.warnThreshold) {
      return { status: 'warning', spent, limit };
    }

    return { status: 'ok', spent, limit };
  }
}
