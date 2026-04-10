// ---------------------------------------------------------------------------
// compile-pipeline.ts — 7-stage compile pipeline interfaces
// Source: doc 13 §4.1
// ---------------------------------------------------------------------------

// Local type aliases
type ObjectId = string;
type IsoDateTimeString = string;

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

export enum CompilePipelineStage {
  /** File watcher detects changes, updates file_index */
  Scan = 'scan',
  /** Extract frontmatter, body structure, block annotations, attachment bundle */
  Parse = 'parse',
  /** Project file into object_index and type tables */
  Project = 'project',
  /** Update FTS, chunk, vector, block_index */
  Index = 'index',
  /** Extract wikilinks, tags, entity candidates, write origin=human/ai relations */
  Link = 'link',
  /** If rules match, incrementally update wiki/ pages and compile_edges */
  Compile = 'compile',
  /** Record event_log, generate inbox suggestions or conflict alerts */
  Audit = 'audit',
}

/** Ordered array for iteration. */
export const COMPILE_STAGE_ORDER: readonly CompilePipelineStage[] = [
  CompilePipelineStage.Scan,
  CompilePipelineStage.Parse,
  CompilePipelineStage.Project,
  CompilePipelineStage.Index,
  CompilePipelineStage.Link,
  CompilePipelineStage.Compile,
  CompilePipelineStage.Audit,
] as const;

// ---------------------------------------------------------------------------
// Automation task type (doc 13 §4.2)
// ---------------------------------------------------------------------------

export type CompileTaskType = 'ingest' | 'reconcile' | 'compile_lint';

// ---------------------------------------------------------------------------
// Pipeline context & result
// ---------------------------------------------------------------------------

export interface CompileContext {
  /** Absolute path to the workspace root ($ORBIT_HOME). */
  readonly rootPath: string;
  /** Paths that triggered this pipeline run (relative to rootPath). */
  readonly changedPaths: readonly string[];
  /** What kind of automation triggered this run. */
  readonly taskType: CompileTaskType;
  /** Correlation id for tracing across stages. */
  readonly correlationId: string;
  /** ISO timestamp when the pipeline started. */
  readonly startedAt: IsoDateTimeString;
}

export interface StageResult {
  readonly stage: CompilePipelineStage;
  readonly ok: boolean;
  readonly objectsAffected: readonly ObjectId[];
  readonly errors: readonly string[];
  readonly durationMs: number;
}

export interface CompileResult {
  readonly context: CompileContext;
  readonly stages: readonly StageResult[];
  readonly ok: boolean;
  readonly totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Pipeline interface
// ---------------------------------------------------------------------------

/**
 * The compile pipeline contract. Implementations execute the 7 stages
 * in strict order, returning a detailed result.
 */
export interface CompilePipeline {
  execute(context: CompileContext): Promise<CompileResult>;
}
