// ---------------------------------------------------------------------------
// file-scanner.ts — File index scanner interfaces & content hashing
// Source: doc 13 §3.5.1
// ---------------------------------------------------------------------------

import type { WorkspaceLayer } from './directory-layout.js';

// Local type aliases
type ObjectId = string;
type IsoDateTimeString = string;

// ---------------------------------------------------------------------------
// FileIndexEntry — mirrors the file_index table schema
// ---------------------------------------------------------------------------

export interface FileIndexEntry {
  readonly object_id: ObjectId;
  readonly layer: WorkspaceLayer;
  readonly canonical_path: string;
  readonly bundle_path: string | null;
  readonly mtime: string;
  readonly size: number;
  readonly content_hash: string;
  readonly parse_status: 'pending' | 'parsed' | 'error';
  readonly parse_error: string | null;
  readonly frontmatter_snapshot: string | null;
  readonly deleted_flg: 0 | 1;
}

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

export type FileChangeKind = 'added' | 'modified' | 'deleted' | 'renamed';

export interface FileChange {
  readonly kind: FileChangeKind;
  readonly path: string;
  readonly previousPath?: string;
  readonly entry: FileIndexEntry;
}

// ---------------------------------------------------------------------------
// Scan results
// ---------------------------------------------------------------------------

export interface FileScanError {
  readonly path: string;
  readonly message: string;
}

export interface FileScanResult {
  readonly entries: readonly FileIndexEntry[];
  readonly errors: readonly FileScanError[];
  readonly changes: readonly FileChange[];
}

// ---------------------------------------------------------------------------
// FileScanner interface
// ---------------------------------------------------------------------------

/**
 * Interface for the file scanning / watching system.
 * Implementations will use Node fs or platform-specific APIs.
 */
export interface FileScanner {
  /** Full scan of workspace, producing a complete file index. */
  scan(rootPath: string): Promise<FileScanResult>;

  /** Detect changes against a set of previously known entries. */
  detectChanges(
    rootPath: string,
    previousEntries: readonly FileIndexEntry[],
  ): Promise<FileScanResult>;
}

// ---------------------------------------------------------------------------
// Content hashing
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 content hash.
 *
 * This is a pure function that accepts the content as a string and returns
 * a hex-encoded SHA-256 digest. The actual crypto implementation is injected
 * so this package has no Node-specific imports.
 */
export async function computeContentHash(
  content: string,
  sha256Fn: (data: string) => Promise<string>,
): Promise<string> {
  return sha256Fn(content);
}
