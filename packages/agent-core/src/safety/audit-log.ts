// ---------------------------------------------------------------------------
// @orbit/agent-core – Audit Log (M3-lite)
// ---------------------------------------------------------------------------

// ---- Types ----

export interface AuditEntry {
  readonly timestamp: number;
  readonly capabilityName: string;
  readonly action: 'allow' | 'ask' | 'deny';
  readonly reason: string;
  readonly checker: string;
  readonly surface: string;
  readonly riskLevel: string;
}

export interface AuditQueryFilter {
  readonly action?: string;
  readonly capabilityName?: string;
  readonly checker?: string;
  readonly since?: number;
  readonly limit?: number;
}

export interface AuditStats {
  readonly total: number;
  readonly allowed: number;
  readonly asked: number;
  readonly denied: number;
  readonly topDenied: readonly { readonly name: string; readonly count: number }[];
}

// ---- AuditLog ----

export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  record(entry: Omit<AuditEntry, 'timestamp'>): void {
    this.entries.push({ ...entry, timestamp: Date.now() });

    // Evict oldest entries when over capacity
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  query(filter?: AuditQueryFilter): readonly AuditEntry[] {
    let results: AuditEntry[] = this.entries;

    if (filter) {
      if (filter.action) {
        results = results.filter((e) => e.action === filter.action);
      }
      if (filter.capabilityName) {
        results = results.filter((e) => e.capabilityName === filter.capabilityName);
      }
      if (filter.checker) {
        results = results.filter((e) => e.checker === filter.checker);
      }
      if (filter.since !== undefined) {
        results = results.filter((e) => e.timestamp >= filter.since!);
      }
      if (filter.limit !== undefined) {
        results = results.slice(0, filter.limit);
      }
    }

    return results;
  }

  getStats(): AuditStats {
    const denied = this.entries.filter((e) => e.action === 'deny');

    // Count denials per capability
    const deniedCounts = new Map<string, number>();
    for (const entry of denied) {
      deniedCounts.set(entry.capabilityName, (deniedCounts.get(entry.capabilityName) ?? 0) + 1);
    }

    const topDenied = [...deniedCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: this.entries.length,
      allowed: this.entries.filter((e) => e.action === 'allow').length,
      asked: this.entries.filter((e) => e.action === 'ask').length,
      denied: denied.length,
      topDenied,
    };
  }

  clear(): void {
    this.entries.length = 0;
  }
}
