// ---------------------------------------------------------------------------
// @orbit/agent-core – Public API
// ---------------------------------------------------------------------------

// Types & constants
export * from './types.js';

// Tool Registry
export {
  ToolRegistry,
  type ToolEntry,
  type ToolFilters,
  type ToolResult,
  createToolResult,
  createToolError,
} from './tool-registry.js';

// Memory Manager
export {
  MemoryManager,
  InMemoryMemoryStore,
  type MemoryStore,
  type MemoryRecallQuery,
} from './memory-manager.js';

// Context Compressor
export {
  ContextCompressor,
  type CompressionConfig,
  type CompressionResult,
} from './context-compressor.js';

// Safety Gate
export {
  SafetyGate,
  THREAT_PATTERNS,
  type SafetyCheckResult,
} from './safety-gate.js';

// Domain Agents
export { DOMAIN_AGENT_CONFIGS } from './domain-agents.js';

// LLM Adapter
export type { LLMAdapter } from './llm-adapter.js';
export { toOpenAIMessages, fromOpenAIResponse, toOpenAITools } from './llm-adapter.js';

// Orchestrator
export {
  Orchestrator,
  type OrchestratorInput,
  type OrchestratorOutput,
} from './orchestrator.js';
