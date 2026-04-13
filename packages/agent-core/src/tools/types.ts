// ---------------------------------------------------------------------------
// @orbit/agent-core – Built-in Tool Types (M8)
// ---------------------------------------------------------------------------

/** Category of a built-in tool. */
export type ToolCategory =
  | 'terminal'
  | 'filesystem'
  | 'web'
  | 'interaction'
  | 'code'
  | 'utility'
  | 'planning'
  | 'workspace'
  | 'reader'
  | 'journal'
  | 'vision';

/** Output returned by every built-in tool execution. */
export interface ToolOutput {
  readonly success: boolean;
  readonly output: string;
  readonly metadata?: Record<string, unknown>;
}

/** A domain-agnostic built-in tool. */
export interface BuiltinTool {
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly parameters: Record<string, unknown>; // JSON Schema
  execute(args: Record<string, unknown>): Promise<ToolOutput>;
}
