// ── Common types ───────────────────────────────────────────────────
export type {
  ObjectUid,
  ObjectId,
  IsoDateTimeString,
  ObjectOrigin,
  ActorType,
  Layer,
  LinkStatus,
  SourceChannel,
} from './common.js';

// ── Query & record types ───────────────────────────────────────────
export type {
  ObjectQueryFilter,
  ObjectRecord,
  ObjectQueryResult,
  LinkRecord,
  LinkQueryFilter,
  WriteLinkInput,
  EventRecord,
  AppendEventInput,
  EventListResult,
  SearchScope,
  SearchResult,
} from './query-types.js';

// ── Repository interfaces ──────────────────────────────────────────
export type {
  ObjectRepository,
  LinkRepository,
  EventRepository,
  SearchRepository,
} from './repository.js';

// ── Mutation envelope ──────────────────────────────────────────────
export type { MutationEnvelope, CreateMutationEnvelopeInput } from './mutation-envelope.js';
export { createMutationEnvelope, isDeletionMutation, isCreationMutation } from './mutation-envelope.js';

// ── Agent views ────────────────────────────────────────────────────
export type {
  AgentItemView,
  AgentLinkView,
  AgentEventView,
  AgentQueryFilter,
  AgentLinkFilter,
  AgentWriteLinkInput,
  AgentAppendEventInput,
  AgentDataAccess,
} from './agent-views.js';

// ── Write transaction ──────────────────────────────────────────────
export type {
  WriteTransaction,
  WriteTransactionResult,
  WriteTransactionFactory,
} from './write-transaction.js';

// ── Cursor utilities ───────────────────────────────────────────────
export type { RepositoryCursor, ParsedCursor } from './cursor.js';
export { createCursor, parseCursor } from './cursor.js';

// ── Legacy aliases (backwards compat) ──────────────────────────────
export { createCursor as createRepositoryCursor } from './cursor.js';
