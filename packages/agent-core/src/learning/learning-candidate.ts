// ---------------------------------------------------------------------------
// @orbit/agent-core – Learning Candidate (M9 – Wave 2-B)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';

// ---- Types ----

export type CandidateSource = 'user_correction' | 'repeated_pattern' | 'explicit_feedback' | 'success_pattern';
export type CandidateStatus = 'proposed' | 'confirmed' | 'rejected' | 'graduated' | 'archived';

export interface LearningCandidate {
  readonly id: string;
  readonly source: CandidateSource;
  readonly domain: string;
  readonly pattern: string;
  readonly description: string;
  readonly confidence: number;
  readonly status: CandidateStatus;
  readonly createdAt: string;
  readonly confirmedAt?: string;
  readonly graduatedAt?: string;
  readonly usageCount: number;
  readonly successCount: number;
  readonly failureCount: number;
}

// ---- Factory functions ----

export function createCandidate(
  source: CandidateSource,
  domain: string,
  pattern: string,
  description: string,
): LearningCandidate {
  return {
    id: generateId('lc'),
    source,
    domain,
    pattern,
    description,
    confidence: 0.5,
    status: 'proposed',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    successCount: 0,
    failureCount: 0,
  };
}

export function confirmCandidate(candidate: LearningCandidate): LearningCandidate {
  return {
    ...candidate,
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
    confidence: Math.min(1, candidate.confidence + 0.2),
  };
}

export function rejectCandidate(candidate: LearningCandidate): LearningCandidate {
  return {
    ...candidate,
    status: 'rejected',
    confidence: 0,
  };
}
