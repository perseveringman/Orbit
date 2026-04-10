import type { ObjectUid } from './common.js';
import type {
  AppendEventInput,
  EventListResult,
  EventRecord,
  LinkQueryFilter,
  LinkRecord,
  ObjectQueryFilter,
  ObjectQueryResult,
  ObjectRecord,
  SearchResult,
  SearchScope,
  WriteLinkInput,
} from './query-types.js';

// ── Core Repository Interfaces (doc 12 §3.7) ──────────────────────

/**
 * CRUD operations on objects via the unified `object_index`.
 */
export interface ObjectRepository {
  query(filter: ObjectQueryFilter): Promise<ObjectQueryResult>;
  read(objectUid: ObjectUid): Promise<ObjectRecord | null>;
  write(type: string, payload: Record<string, unknown>): Promise<ObjectRecord>;
  delete(objectUid: ObjectUid): Promise<void>;
}

/**
 * Link graph operations.
 */
export interface LinkRepository {
  write(input: WriteLinkInput): Promise<LinkRecord>;
  list(filter: LinkQueryFilter): Promise<LinkRecord[]>;
  backlinks(targetUid: ObjectUid, filter?: LinkQueryFilter): Promise<LinkRecord[]>;
}

/**
 * Append-only event stream operations.
 */
export interface EventRepository {
  append(input: AppendEventInput): Promise<EventRecord>;
  listByStream(streamUid: ObjectUid, cursor?: string): Promise<EventListResult>;
  replay(cursor: string, limit?: number): Promise<EventListResult>;
}

/**
 * Full-text and semantic search operations.
 */
export interface SearchRepository {
  query(text: string, scope?: SearchScope): Promise<SearchResult[]>;
}
