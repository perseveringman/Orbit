// ---------------------------------------------------------------------------
// @orbit/agent-core – Learning Store (M9 – Wave 2-B)
// ---------------------------------------------------------------------------

import type { LearningCandidate, CandidateStatus } from './learning-candidate.js';

// ---- Types ----

export interface LearningStore {
  addCandidate(candidate: LearningCandidate): void;
  getCandidate(id: string): LearningCandidate | null;
  getCandidatesByStatus(status: CandidateStatus): readonly LearningCandidate[];
  getCandidatesByDomain(domain: string): readonly LearningCandidate[];
  updateCandidate(id: string, updates: Partial<LearningCandidate>): LearningCandidate | null;
  recordUsage(id: string, success: boolean): void;
  getGraduated(): readonly LearningCandidate[];
  prune(olderThan: string): number;
}

// ---- Mutable backing type ----

interface MutableCandidate {
  id: string;
  source: LearningCandidate['source'];
  domain: string;
  pattern: string;
  description: string;
  confidence: number;
  status: LearningCandidate['status'];
  createdAt: string;
  confirmedAt?: string;
  graduatedAt?: string;
  usageCount: number;
  successCount: number;
  failureCount: number;
}

function freeze(m: MutableCandidate): LearningCandidate {
  return m as LearningCandidate;
}

// ---- Implementation ----

export function createLearningStore(): LearningStore {
  const store = new Map<string, MutableCandidate>();

  function addCandidate(candidate: LearningCandidate): void {
    store.set(candidate.id, { ...candidate });
  }

  function getCandidate(id: string): LearningCandidate | null {
    const c = store.get(id);
    return c ? freeze(c) : null;
  }

  function getCandidatesByStatus(status: CandidateStatus): readonly LearningCandidate[] {
    const results: LearningCandidate[] = [];
    for (const c of store.values()) {
      if (c.status === status) results.push(freeze(c));
    }
    return results;
  }

  function getCandidatesByDomain(domain: string): readonly LearningCandidate[] {
    const results: LearningCandidate[] = [];
    for (const c of store.values()) {
      if (c.domain === domain) results.push(freeze(c));
    }
    return results;
  }

  function updateCandidate(
    id: string,
    updates: Partial<LearningCandidate>,
  ): LearningCandidate | null {
    const c = store.get(id);
    if (!c) return null;
    Object.assign(c, updates);
    return freeze(c);
  }

  function recordUsage(id: string, success: boolean): void {
    const c = store.get(id);
    if (!c) return;
    c.usageCount += 1;
    if (success) {
      c.successCount += 1;
      // Boost confidence on success (capped at 1)
      c.confidence = Math.min(1, c.confidence + 0.05);
    } else {
      c.failureCount += 1;
      // Decay confidence on failure (floored at 0)
      c.confidence = Math.max(0, c.confidence - 0.1);
    }
  }

  function getGraduated(): readonly LearningCandidate[] {
    return getCandidatesByStatus('graduated');
  }

  function prune(olderThan: string): number {
    let removed = 0;
    for (const [id, c] of store) {
      if (c.createdAt < olderThan && (c.status === 'rejected' || c.status === 'archived')) {
        store.delete(id);
        removed++;
      }
    }
    return removed;
  }

  return {
    addCandidate,
    getCandidate,
    getCandidatesByStatus,
    getCandidatesByDomain,
    updateCandidate,
    recordUsage,
    getGraduated,
    prune,
  };
}
