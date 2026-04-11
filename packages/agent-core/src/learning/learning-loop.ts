// ---------------------------------------------------------------------------
// @orbit/agent-core – Learning Loop (M9 – Wave 2-B)
// 候选提炼 → 用户确认 → 灰度启用 → 审计
// ---------------------------------------------------------------------------

import type { CandidateSource, LearningCandidate } from './learning-candidate.js';
import { createCandidate, confirmCandidate, rejectCandidate } from './learning-candidate.js';
import type { LearningStore } from './learning-store.js';

// ---- Types ----

export interface LearningAuditEntry {
  readonly timestamp: string;
  readonly candidateId: string;
  readonly action: 'proposed' | 'confirmed' | 'rejected' | 'graduated' | 'archived' | 'used';
  readonly detail?: string;
}

export interface LearningLoop {
  propose(source: CandidateSource, domain: string, pattern: string, description: string): LearningCandidate;
  confirm(candidateId: string): LearningCandidate | null;
  reject(candidateId: string): LearningCandidate | null;
  graduate(candidateId: string): LearningCandidate | null;
  recordOutcome(candidateId: string, success: boolean): void;
  getActivePatterns(domain: string): readonly LearningCandidate[];
  getProposals(): readonly LearningCandidate[];
  getAuditLog(): readonly LearningAuditEntry[];
}

// ---- Implementation ----

export function createLearningLoop(store: LearningStore): LearningLoop {
  const auditLog: LearningAuditEntry[] = [];

  function audit(candidateId: string, action: LearningAuditEntry['action'], detail?: string): void {
    auditLog.push({
      timestamp: new Date().toISOString(),
      candidateId,
      action,
      detail,
    });
  }

  function propose(
    source: CandidateSource,
    domain: string,
    pattern: string,
    description: string,
  ): LearningCandidate {
    const candidate = createCandidate(source, domain, pattern, description);
    store.addCandidate(candidate);
    audit(candidate.id, 'proposed', `source=${source}`);
    return candidate;
  }

  function confirm(candidateId: string): LearningCandidate | null {
    const existing = store.getCandidate(candidateId);
    if (!existing || existing.status !== 'proposed') return null;

    const confirmed = confirmCandidate(existing);
    store.updateCandidate(candidateId, {
      status: confirmed.status,
      confirmedAt: confirmed.confirmedAt,
      confidence: confirmed.confidence,
    });
    audit(candidateId, 'confirmed');
    return store.getCandidate(candidateId);
  }

  function reject(candidateId: string): LearningCandidate | null {
    const existing = store.getCandidate(candidateId);
    if (!existing || (existing.status !== 'proposed' && existing.status !== 'confirmed')) return null;

    const rejected = rejectCandidate(existing);
    store.updateCandidate(candidateId, {
      status: rejected.status,
      confidence: rejected.confidence,
    });
    audit(candidateId, 'rejected');
    return store.getCandidate(candidateId);
  }

  function graduate(candidateId: string): LearningCandidate | null {
    const existing = store.getCandidate(candidateId);
    if (!existing || existing.status !== 'confirmed') return null;

    store.updateCandidate(candidateId, {
      status: 'graduated',
      graduatedAt: new Date().toISOString(),
    });
    audit(candidateId, 'graduated');
    return store.getCandidate(candidateId);
  }

  function recordOutcome(candidateId: string, success: boolean): void {
    store.recordUsage(candidateId, success);
    audit(candidateId, 'used', `success=${success}`);
  }

  function getActivePatterns(domain: string): readonly LearningCandidate[] {
    const confirmed = store.getCandidatesByStatus('confirmed');
    const graduated = store.getCandidatesByStatus('graduated');
    return [...confirmed, ...graduated].filter((c) => c.domain === domain);
  }

  function getProposals(): readonly LearningCandidate[] {
    return store.getCandidatesByStatus('proposed');
  }

  function getAuditLog(): readonly LearningAuditEntry[] {
    return [...auditLog];
  }

  return {
    propose,
    confirm,
    reject,
    graduate,
    recordOutcome,
    getActivePatterns,
    getProposals,
    getAuditLog,
  };
}
