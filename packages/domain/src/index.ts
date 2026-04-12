// ── New Wave 1 modules ─────────────────────────────────────

export * from './common.js';
export * from './object-types.js';
export * from './object-uid.js';
export * from './relation-vocabulary.js';
export * from './direction-objects.js';
export * from './execution-objects.js';
export * from './input-objects.js';
export * from './research-objects.js';
export * from './output-objects.js';
export * from './time-objects.js';
export * from './agent-objects.js';
export * from './other-objects.js';

// ── Backward-compatible legacy types ───────────────────────

export {
  type OrbitEntityId,
  type LegacyTaskStatus,
  type LegacyProjectStatus,
  type OrbitEntityBase,
  type WorkspaceRecord,
  type FeedRecord,
  type ProjectRecord,
  type TaskRecord,
  type ArticleRecord,
  type HighlightRecord,
  type TagRecord,
  type NoteRecord,
  type LegacyDomainObject,
  DOMAIN_RELATION_NAMES,
} from './compat.js';

// ── DomainObject — discriminated union (objectType) ────────

import type { Vision, Direction, Theme, Goal, Commitment, Review } from './direction-objects.js';
import type { Project, Milestone, Task, Directive } from './execution-objects.js';
import type { Article, Book, Highlight, Note, Asset, SourceEndpoint, ContentItem, DerivativeAsset } from './input-objects.js';
import type { ResearchSpace, ResearchQuestion, SourceSet, ResearchClaim, ResearchGap, ResearchArtifact } from './research-objects.js';
import type { Document, Draft, Post, VoiceProfile, OutputVariant } from './output-objects.js';
import type { OrbitEvent, ActionLog, DayNote, JournalSummary, BehaviorInsight } from './time-objects.js';
import type { AgentSession, AgentRun, AgentTask, CapabilityCall, ApprovalRequest } from './agent-objects.js';
import type { Tag, AiChat } from './other-objects.js';

export type DomainObject =
  // Direction
  | Vision | Direction | Theme | Goal | Commitment | Review
  // Execution
  | Project | Milestone | Task | Directive
  // Input
  | Article | Book | Highlight | Note | Asset | SourceEndpoint | ContentItem | DerivativeAsset
  // Research
  | ResearchSpace | ResearchQuestion | SourceSet | ResearchClaim | ResearchGap | ResearchArtifact
  // Output
  | Document | Draft | Post | VoiceProfile | OutputVariant
  // Time
  | OrbitEvent | ActionLog | DayNote | JournalSummary | BehaviorInsight
  // Agent
  | AgentSession | AgentRun | AgentTask | CapabilityCall | ApprovalRequest
  // Other
  | Tag | AiChat;

// ── Backward-compatible aliases ────────────────────────────

import { ORBIT_OBJECT_TYPES, isOrbitObjectType, getObjectTypeLabel } from './object-types.js';
import type { OrbitObjectType } from './object-types.js';

/** @deprecated Use ORBIT_OBJECT_TYPES */
export const ORBIT_OBJECT_KINDS = ORBIT_OBJECT_TYPES;

/** @deprecated Use OrbitObjectType */
export type OrbitObjectKind = OrbitObjectType;

/** @deprecated Use isOrbitObjectType */
export function isDomainObjectKind(value: string): value is OrbitObjectType {
  return isOrbitObjectType(value);
}

/** @deprecated Use getObjectTypeLabel */
export function getDomainObjectLabel(kind: OrbitObjectType): string {
  return getObjectTypeLabel(kind);
}

/** @deprecated Use createObjectUid */
export function buildDomainObjectKey(kind: OrbitObjectType, id: string): string {
  return `${kind}:${id}`;
}
