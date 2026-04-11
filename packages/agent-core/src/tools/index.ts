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
