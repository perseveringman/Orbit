// ---------------------------------------------------------------------------
// directory-layout.ts — Three-layer directory constants & path resolution
// Source: doc 13 §3.2
// ---------------------------------------------------------------------------

/** Workspace layer discriminant. */
export type WorkspaceLayer = 'source' | 'wiki' | 'system';

// ---------------------------------------------------------------------------
// sources/ layer directories
// ---------------------------------------------------------------------------

export const SOURCES_DIRS = {
  root: 'sources',
  notes: 'sources/notes',
  documents: 'sources/documents',
  journal: 'sources/journal',
  library: 'sources/library',
  libraryArticles: 'sources/library/articles',
  libraryBooks: 'sources/library/books',
  libraryWebClips: 'sources/library/web-clips',
  assets: 'sources/assets',
  exports: 'sources/exports',
} as const;

// ---------------------------------------------------------------------------
// wiki/ layer directories
// ---------------------------------------------------------------------------

export const WIKI_DIRS = {
  root: 'wiki',
  entities: 'wiki/entities',
  concepts: 'wiki/concepts',
  dossiers: 'wiki/dossiers',
  syntheses: 'wiki/syntheses',
  comparisons: 'wiki/comparisons',
  briefs: 'wiki/briefs',
  reports: 'wiki/reports',
} as const;

// ---------------------------------------------------------------------------
// .orbit/ system layer directories
// ---------------------------------------------------------------------------

export const ORBIT_SYSTEM_DIRS = {
  root: '.orbit',
  db: '.orbit/db',
  indexes: '.orbit/indexes',
  indexesVector: '.orbit/indexes/vector',
  indexesChunks: '.orbit/indexes/chunks',
  cache: '.orbit/cache',
  cacheExtraction: '.orbit/cache/extraction',
  cacheThumbnails: '.orbit/cache/thumbnails',
  cacheRenders: '.orbit/cache/renders',
  sync: '.orbit/sync',
  syncPending: '.orbit/sync/pending',
  crypto: '.orbit/crypto',
  cryptoEnvelopes: '.orbit/crypto/envelopes',
  schema: '.orbit/schema',
  state: '.orbit/state',
  stateCompileJobs: '.orbit/state/compile-jobs',
} as const;

/** All directories that must exist for a valid workspace. */
export const ALL_REQUIRED_DIRS: readonly string[] = [
  ...Object.values(SOURCES_DIRS),
  ...Object.values(WIKI_DIRS),
  ...Object.values(ORBIT_SYSTEM_DIRS),
] as const;

// ---------------------------------------------------------------------------
// Source object type → directory mapping
// ---------------------------------------------------------------------------

export type SourceObjectType =
  | 'note'
  | 'document'
  | 'journal'
  | 'article'
  | 'book'
  | 'web-clip'
  | 'asset';

export type WikiObjectType =
  | 'entity'
  | 'concept'
  | 'dossier'
  | 'synthesis'
  | 'comparison'
  | 'brief'
  | 'report';

const SOURCE_TYPE_DIR: Record<SourceObjectType, string> = {
  note: SOURCES_DIRS.notes,
  document: SOURCES_DIRS.documents,
  journal: SOURCES_DIRS.journal,
  article: SOURCES_DIRS.libraryArticles,
  book: SOURCES_DIRS.libraryBooks,
  'web-clip': SOURCES_DIRS.libraryWebClips,
  asset: SOURCES_DIRS.assets,
};

const WIKI_TYPE_DIR: Record<WikiObjectType, string> = {
  entity: WIKI_DIRS.entities,
  concept: WIKI_DIRS.concepts,
  dossier: WIKI_DIRS.dossiers,
  synthesis: WIKI_DIRS.syntheses,
  comparison: WIKI_DIRS.comparisons,
  brief: WIKI_DIRS.briefs,
  report: WIKI_DIRS.reports,
};

/** Types that are stored as bundles (directories) rather than single files. */
const BUNDLE_TYPES = new Set<string>(['article', 'book', 'web-clip', 'asset']);

/** Types that use YYYY date subdirectories. */
const DATE_SUBDIR_TYPES = new Set<string>(['journal', 'brief', 'report']);

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical file path for an object.
 * Bundle types return the primary content file within the bundle directory.
 * Single-file types return the .md file path directly.
 *
 * @param layer    - 'source' or 'wiki'
 * @param objType  - object type identifier
 * @param objectId - stable ULID-style object id (e.g. "note_01JZ...")
 * @param datePath - optional "YYYY/MM" segment for journal/brief/report types
 */
export function resolveObjectPath(
  layer: WorkspaceLayer,
  objType: string,
  objectId: string,
  datePath?: string,
): string {
  const base = resolveBaseDir(layer, objType);
  if (BUNDLE_TYPES.has(objType)) {
    return `${base}/${objectId}/content.md`;
  }
  if (DATE_SUBDIR_TYPES.has(objType)) {
    const dp = datePath ?? 'undated';
    return `${base}/${dp}/${objectId}.md`;
  }
  return `${base}/${objectId}.md`;
}

/**
 * Resolve the bundle directory path for a bundle-type object.
 * Returns `null` for non-bundle types.
 */
export function resolveBundlePath(
  layer: WorkspaceLayer,
  objType: string,
  objectId: string,
): string | null {
  if (!BUNDLE_TYPES.has(objType)) return null;
  const base = resolveBaseDir(layer, objType);
  return `${base}/${objectId}`;
}

function resolveBaseDir(layer: WorkspaceLayer, objType: string): string {
  if (layer === 'source') {
    const dir = SOURCE_TYPE_DIR[objType as SourceObjectType];
    if (!dir) throw new Error(`Unknown source object type: ${objType}`);
    return dir;
  }
  if (layer === 'wiki') {
    const dir = WIKI_TYPE_DIR[objType as WikiObjectType];
    if (!dir) throw new Error(`Unknown wiki object type: ${objType}`);
    return dir;
  }
  throw new Error(`Cannot resolve object paths in the system layer`);
}
