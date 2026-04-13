// ---------------------------------------------------------------------------
// @orbit/agent-core – Built-in Tools barrel export (M8)
// ---------------------------------------------------------------------------

// Types
export type { BuiltinTool, ToolCategory, ToolOutput } from './types.js';

// Terminal tools
export { shellExecTool } from './terminal-tools.js';

// Filesystem tools
export {
  fileReadTool,
  fileWriteTool,
  fileListTool,
  fileSearchTool,
  grepTool,
} from './filesystem-tools.js';

// Web tools
export { webFetchTool, webSearchTool } from './web-tools.js';

// Interaction tools
export { askUserTool } from './interaction-tools.js';

// Utility tools
export {
  datetimeTool,
  jsonParseTool,
  textTransformTool,
  calculateTool,
} from './utility-tools.js';

// Toolset registry
export {
  ToolsetRegistry,
  createDefaultToolsetRegistry,
  CORE_TOOLSETS,
  type Toolset,
} from './toolset-registry.js';

// App tools
export {
  AppDataStore,
  createAppDataStore,
  projectCreateTool,
  projectListTool,
  projectUpdateTool,
  projectDeleteTool,
  milestoneCreateTool,
  milestoneListTool,
  milestoneUpdateTool,
  taskCreateTool,
  taskListTool,
  taskUpdateTool,
  taskCompleteTool,
  taskAssignTool,
  workspaceSearchTool,
  workspaceQueryTool,
  objectGetTool,
  objectLinkTool,
  APP_TOOLSETS,
} from './app-tools.js';

// Tool manager
export {
  createToolManager,
  type ToolSource,
  type ManagedTool,
  type ToolManagerConfig,
  type ToolManager,
  type ToolExecutionResult,
  type ToolCountSummary,
} from './tool-manager.js';

// Domain tools – Task/Project
export {
  TASK_DOMAIN_TOOLSETS,
  taskTransitionTool,
  taskGetValidTransitionsTool,
  taskParseIntentTool,
  todayPlanTool,
  todayScoreTaskTool,
  focusStartTool,
  focusEndTool,
  focusGetContextTool,
  reviewCreateTool,
  nextThingSuggestTool,
} from './task-domain-tools.js';

// Domain tools – Reader/Content
export {
  READER_DOMAIN_TOOLSETS,
  contentAddUrlTool,
  contentGetStatusTool,
  contentListTool,
  contentSearchTool,
  highlightCreateTool,
  highlightListTool,
  subscriptionCreateTool,
  subscriptionListTool,
  subscriptionToggleTool,
  translationTranslateTool,
} from './reader-domain-tools.js';

// Domain tools – Journal
export {
  JOURNAL_DOMAIN_TOOLSETS,
  journalLogEventTool,
  journalListEventsTool,
  journalGenerateSummaryTool,
  journalGetInsightsTool,
  journalWriteNoteTool,
  journalGetNoteTool,
  journalClassifyPrivacyTool,
} from './journal-domain-tools.js';

// Domain tools – Vision
export {
  VISION_DOMAIN_TOOLSETS,
  visionCreateTool,
  visionListTool,
  visionGetTool,
  visionUpdateTool,
  visionCreateVersionTool,
  visionListVersionsTool,
  visionCompareVersionsTool,
  reminderSetTool,
  directiveCreateTool,
  directiveListTool,
} from './vision-domain-tools.js';

// Domain tool registry
export { DOMAIN_TOOLSETS } from './domain-tool-registry.js';
