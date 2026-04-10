// ---------------------------------------------------------------------------
// @orbit/workspace-core — File-system-first data architecture
// ---------------------------------------------------------------------------

// Workspace view identifiers (backward-compatible)
export const WORKSPACE_VIEW_IDS = ['projects', 'tasks', 'today', 'focus', 'review', 'inbox', 'library', 'search'] as const;
export type WorkspaceViewId = (typeof WORKSPACE_VIEW_IDS)[number];

// Directory layout & path resolution
export {
  type WorkspaceLayer,
  type SourceObjectType,
  type WikiObjectType,
  SOURCES_DIRS,
  WIKI_DIRS,
  ORBIT_SYSTEM_DIRS,
  ALL_REQUIRED_DIRS,
  resolveObjectPath,
  resolveBundlePath,
} from './directory-layout.js';

// Workspace initialisation & validation
export {
  type WorkspaceHandle,
  type WorkspaceValidationResult,
  buildWorkspaceHandle,
  requiredAbsolutePaths,
  validateWorkspace,
  initWorkspace,
} from './workspace-init.js';

// Frontmatter contract
export {
  type OrbitFrontmatter,
  type WikiCompileFrontmatter,
  type CompileKind,
  type FrontmatterParseResult,
  parseFrontmatter,
  serializeFrontmatter,
  updateFrontmatter,
} from './frontmatter.js';

// File scanner interface
export {
  type FileIndexEntry,
  type FileChangeKind,
  type FileChange,
  type FileScanError,
  type FileScanResult,
  type FileScanner,
  computeContentHash,
} from './file-scanner.js';

// Compile pipeline interface
export {
  CompilePipelineStage,
  COMPILE_STAGE_ORDER,
  type CompileTaskType,
  type CompileContext,
  type StageResult,
  type CompileResult,
  type CompilePipeline,
} from './compile-pipeline.js';

// AI write boundary
export {
  type WriteTarget,
  type WritePermission,
  type ActorKind,
  type WritePermissionCheck,
  AI_WRITE_RULES,
  checkWritePermission,
  inferWriteTarget,
} from './write-boundary.js';
