import type { ObjectUid } from './common.js';
import type { AppendEventInput, WriteLinkInput } from './query-types.js';

// ── Write Transaction Protocol (doc 12 §4.1) ──────────────────────
//
// Canonical write order:
//   1. Write to type table (domain-specific validation)
//   2. Sync/refresh object_index
//   3. Write links if relation changes
//   4. Append events
//   5. Async: update search projections (FTS, chunks, vector)

/**
 * Fluent builder interface for the canonical write ordering.
 * Implementations must execute steps in the defined order.
 */
export interface WriteTransaction {
  writeObject(type: string, payload: Record<string, unknown>): WriteTransaction;
  syncIndex(): WriteTransaction;
  writeLinks(links: readonly WriteLinkInput[]): WriteTransaction;
  appendEvents(events: readonly AppendEventInput[]): WriteTransaction;
  execute(): Promise<WriteTransactionResult>;
}

export interface WriteTransactionResult {
  readonly objectUid: ObjectUid;
  readonly versionToken: string;
  readonly linksCreated: number;
  readonly eventsAppended: number;
}

/**
 * Factory for creating write transactions.
 * Implementations bind this to a specific database / connection context.
 */
export interface WriteTransactionFactory {
  create(): WriteTransaction;
}
