// ---------------------------------------------------------------------------
// @orbit/agent-core – Learning subsystem barrel export (M9)
// ---------------------------------------------------------------------------

export {
  createCandidate,
  confirmCandidate,
  rejectCandidate,
  type CandidateSource,
  type CandidateStatus,
  type LearningCandidate,
} from './learning-candidate.js';

export {
  createLearningStore,
  type LearningStore,
} from './learning-store.js';

export {
  createLearningLoop,
  type LearningLoop,
  type LearningAuditEntry,
} from './learning-loop.js';
