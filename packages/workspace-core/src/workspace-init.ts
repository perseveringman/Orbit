// ---------------------------------------------------------------------------
// workspace-init.ts — Directory creation/validation contracts
// ---------------------------------------------------------------------------

import {
  ALL_REQUIRED_DIRS,
  SOURCES_DIRS,
  WIKI_DIRS,
  ORBIT_SYSTEM_DIRS,
} from './directory-layout.js';

/** Opaque handle to a validated workspace root. */
export interface WorkspaceHandle {
  readonly rootPath: string;
  readonly sourcesPath: string;
  readonly wikiPath: string;
  readonly systemPath: string;
  readonly dbPath: string;
}

/** Result of workspace validation. */
export interface WorkspaceValidationResult {
  readonly valid: boolean;
  readonly missingDirs: readonly string[];
}

/**
 * Build a WorkspaceHandle from a root path.
 * This is a pure derivation — it does NOT touch the file system.
 */
export function buildWorkspaceHandle(rootPath: string): WorkspaceHandle {
  return {
    rootPath,
    sourcesPath: `${rootPath}/${SOURCES_DIRS.root}`,
    wikiPath: `${rootPath}/${WIKI_DIRS.root}`,
    systemPath: `${rootPath}/${ORBIT_SYSTEM_DIRS.root}`,
    dbPath: `${rootPath}/${ORBIT_SYSTEM_DIRS.db}`,
  };
}

/**
 * Return the list of all absolute directory paths that must exist
 * for the workspace at `rootPath` to be considered complete.
 */
export function requiredAbsolutePaths(rootPath: string): readonly string[] {
  return ALL_REQUIRED_DIRS.map((rel) => `${rootPath}/${rel}`);
}

/**
 * Validate a workspace root against the required directory layout.
 *
 * This is a *pure* function that accepts an `existsFn` callback so
 * callers can plug in Node `fs`, a virtual FS, or test stubs.
 *
 * @param rootPath  Absolute path to $ORBIT_HOME
 * @param existsFn  Async predicate: returns true if a directory exists
 */
export async function validateWorkspace(
  rootPath: string,
  existsFn: (dirPath: string) => Promise<boolean>,
): Promise<WorkspaceValidationResult> {
  const missing: string[] = [];
  for (const rel of ALL_REQUIRED_DIRS) {
    const abs = `${rootPath}/${rel}`;
    const exists = await existsFn(abs);
    if (!exists) missing.push(rel);
  }
  return { valid: missing.length === 0, missingDirs: missing };
}

/**
 * Create every required directory for a workspace.
 *
 * Accepts a `mkdirFn` callback so callers can plug in Node `fs.mkdir`
 * with `{ recursive: true }`, a virtual FS, or test stubs.
 *
 * @returns A WorkspaceHandle for the initialised workspace.
 */
export async function initWorkspace(
  rootPath: string,
  mkdirFn: (dirPath: string) => Promise<void>,
): Promise<WorkspaceHandle> {
  for (const rel of ALL_REQUIRED_DIRS) {
    await mkdirFn(`${rootPath}/${rel}`);
  }
  return buildWorkspaceHandle(rootPath);
}
