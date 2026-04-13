/**
 * Mapping from OrbitObjectType to the corresponding SQLite table name.
 */
export const TYPE_TO_TABLE: Record<string, string> = {
  vision: 'visions',
  direction: 'directions',
  theme: 'themes',
  goal: 'goals',
  commitment: 'commitments',
  review: 'reviews',
  project: 'projects',
  milestone: 'milestones',
  task: 'tasks',
  directive: 'directives',
  article: 'articles',
  book: 'books',
  highlight: 'highlights',
  note: 'notes',
  asset: 'assets',
  source_endpoint: 'source_endpoints',
  content_item: 'content_items',
  derivative_asset: 'derivative_assets',
  research_space: 'research_spaces',
  research_question: 'research_questions',
  source_set: 'source_sets',
  research_claim: 'research_claims',
  research_gap: 'research_gaps',
  research_artifact: 'research_artifacts',
  document: 'documents',
  draft: 'drafts',
  post: 'posts',
  voice_profile: 'voice_profiles',
  output_variant: 'output_variants',
  action_log: 'action_logs',
  day_note: 'day_notes',
  journal_summary: 'journal_summaries',
  behavior_insight: 'behavior_insights',
  agent_session: 'agent_sessions',
  agent_run: 'agent_runs',
  agent_task: 'agent_tasks',
  capability_call: 'capability_calls',
  approval_request: 'approval_requests',
  tag: 'tags',
  ai_chat: 'ai_chats',
  event: 'events',
  workspace: 'workspaces',
  feed: 'feeds',
};

/**
 * Reverse mapping: table name → object type.
 */
export const TABLE_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_TABLE).map(([type, table]) => [table, type]),
);

/**
 * Convert a camelCase string to snake_case.
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert a snake_case string to camelCase.
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Convert all keys of a record from camelCase to snake_case.
 */
export function keysToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

/**
 * Convert all keys of a record from snake_case to camelCase.
 */
export function keysToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

/**
 * Get the table name for an object type.
 * Throws if the type is unknown.
 */
export function getTableForType(type: string): string {
  const table = TYPE_TO_TABLE[type];
  if (!table) throw new Error(`Unknown object type: ${type}`);
  return table;
}

/**
 * Get the current ISO datetime string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}
