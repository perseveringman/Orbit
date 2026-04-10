// ── Local type aliases ──────────────────────────────────────────────
// Defined locally to avoid build-order dependency on @orbit/domain.
// These mirror the canonical types in @orbit/domain.

/** Composite UID: `{object_type}:{object_id}`, e.g. `task:tsk_123` */
export type ObjectUid = string;

/** ULID-style stable identifier, e.g. `note_01JZ...` */
export type ObjectId = string;

/** ISO-8601 timestamp string */
export type IsoDateTimeString = string;

/** Who created the object or link */
export type ObjectOrigin = 'human' | 'ai' | 'system';

/** Actor performing a mutation or event */
export type ActorType = 'user' | 'agent' | 'system';

/** Data layer */
export type Layer = 'source' | 'wiki' | 'system';

/** Link lifecycle status */
export type LinkStatus = 'proposed' | 'active' | 'rejected' | 'archived';

/** Source channel for link creation */
export type SourceChannel =
  | 'manual'
  | 'wikilink'
  | 'drag_drop'
  | 'quick_capture'
  | 'agent_chat'
  | 'ingest'
  | 'review'
  | 'import';
