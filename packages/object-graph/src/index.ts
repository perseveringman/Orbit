// ── Types ──
export type {
  ObjectUid,
  ObjectId,
  IsoDateTimeString,
  ObjectOrigin,
  LinkStatus,
  SourceChannel,
  RelationFamily,
  RelationType,
  ObjectReference,
  Link,
  EvidenceType,
  LinkEvidence,
  LinkFilter,
  CreateLinkInput,
  UpdateLinkInput,
  ContextBundle,
  WorkChainResult,
  EvidenceTraceResult,
  HydratedObject,
} from './types.js';

export { RELATION_FAMILIES } from './types.js';

// ── Link CRUD ──
export type { LinkRepository } from './link-crud.js';

// ── Hydration ──
export type { ObjectHydrator } from './hydration.js';

// ── Relation suggestions ──
export type {
  SuggestionSource,
  SuggestionSignal,
  RelationSuggestion,
  SuppressRule,
  RelationSuggestionEngine,
} from './relation-suggestion.js';

// ── Cross-object queries ──
export type { CrossObjectQueryService } from './cross-object-queries.js';

// ── Graph index ──
export type { ObjectGraphNode, ObjectGraphIndex } from './graph-index.js';

export {
  buildObjectGraphIndex,
  getOutlinks,
  getBacklinks,
  getNeighborUids,
  collectNeighborhood,
  findOrphanNodes,
  findRejectedAiLinks,
} from './graph-index.js';

// ── Link density ──
export type { LinkDensityMetrics, FeedPriorityInput } from './link-density.js';

export { computeLinkDensity, computeFeedPriority } from './link-density.js';

// ── Link activation ──
export type { LinkActivationPolicy, ActivationDecision } from './link-activation.js';

export {
  DEFAULT_ACTIVATION_POLICY,
  shouldAutoActivate,
  decideActivation,
} from './link-activation.js';
