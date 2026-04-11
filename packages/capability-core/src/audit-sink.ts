// ---------------------------------------------------------------------------
// @orbit/capability-core – Audit Sink (Wave 2-C)
// ---------------------------------------------------------------------------

import type { CapabilityDomain } from './capability-interface.js';
import type { PolicyDecision } from './policy-engine.js';

export interface AuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly capabilityId: string;
  readonly domain: CapabilityDomain;
  readonly action: 'invoked' | 'approved' | 'denied' | 'completed' | 'failed';
  readonly sessionId?: string;
  readonly userId?: string;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly policyDecision?: PolicyDecision;
  readonly durationMs?: number;
  readonly error?: string;
}

export interface AuditFilter {
  readonly capabilityId?: string;
  readonly domain?: CapabilityDomain;
  readonly action?: AuditEntry['action'];
  readonly since?: string;
  readonly until?: string;
  readonly sessionId?: string;
}

export interface AuditSink {
  record(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry;
  query(filter: AuditFilter): readonly AuditEntry[];
  getByCapability(capabilityId: string): readonly AuditEntry[];
  getBySession(sessionId: string): readonly AuditEntry[];
  getRecent(limit: number): readonly AuditEntry[];
  clear(): void;
  count(): number;
}

let auditCounter = 0;

function generateAuditId(): string {
  auditCounter += 1;
  return `audit-${Date.now()}-${auditCounter}`;
}

export function createAuditSink(): AuditSink {
  const entries: AuditEntry[] = [];

  return {
    record(partial: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
      const entry: AuditEntry = {
        ...partial,
        id: generateAuditId(),
        timestamp: new Date().toISOString(),
      };
      entries.push(entry);
      return entry;
    },

    query(filter: AuditFilter): readonly AuditEntry[] {
      return entries.filter((e) => {
        if (filter.capabilityId !== undefined && e.capabilityId !== filter.capabilityId) return false;
        if (filter.domain !== undefined && e.domain !== filter.domain) return false;
        if (filter.action !== undefined && e.action !== filter.action) return false;
        if (filter.sessionId !== undefined && e.sessionId !== filter.sessionId) return false;
        if (filter.since !== undefined && e.timestamp < filter.since) return false;
        if (filter.until !== undefined && e.timestamp > filter.until) return false;
        return true;
      });
    },

    getByCapability(capabilityId: string): readonly AuditEntry[] {
      return entries.filter((e) => e.capabilityId === capabilityId);
    },

    getBySession(sessionId: string): readonly AuditEntry[] {
      return entries.filter((e) => e.sessionId === sessionId);
    },

    getRecent(limit: number): readonly AuditEntry[] {
      return entries.slice(-limit);
    },

    clear(): void {
      entries.length = 0;
    },

    count(): number {
      return entries.length;
    },
  };
}
