// ── Pagination Cursor Utilities ────────────────────────────────────

/** Opaque cursor string for keyset pagination */
export type RepositoryCursor = string;

/** Parsed cursor components */
export interface ParsedCursor {
  readonly updatedAt: string;
  readonly id: string;
}

const CURSOR_SEPARATOR = '::';

/**
 * Creates an opaque cursor string from an `updatedAt` timestamp and object id.
 * Format: `{updatedAt}::{id}`
 */
export function createCursor(updatedAt: string, id: string): RepositoryCursor {
  return `${updatedAt}${CURSOR_SEPARATOR}${id}`;
}

/**
 * Parses a cursor string back into its `updatedAt` and `id` components.
 * Returns `null` if the cursor format is invalid.
 */
export function parseCursor(cursor: RepositoryCursor): ParsedCursor | null {
  const idx = cursor.indexOf(CURSOR_SEPARATOR);
  if (idx < 0) return null;

  const updatedAt = cursor.slice(0, idx);
  const id = cursor.slice(idx + CURSOR_SEPARATOR.length);

  if (!updatedAt || !id) return null;
  return { updatedAt, id };
}
