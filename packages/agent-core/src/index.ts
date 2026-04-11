// ---------------------------------------------------------------------------
// @orbit/agent-core – Public API
// ---------------------------------------------------------------------------

// Types & constants
export * from './types.js';

// Events (M1)
export * from './events.js';

// Execution Context (M1)
export { createExecutionContext, type ExecutionContext } from './execution-context.js';

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
  type CompressionResult as ContextCompressionResult,
} from './context-compressor.js';

// Safety Gate
export {
  SafetyGate,
  THREAT_PATTERNS,
  type SafetyCheckResult,
} from './safety-gate.js';

// Domain Agents
export { DOMAIN_AGENT_CONFIGS } from './domain-agents.js';

// LLM Adapter (legacy)
export type { LLMAdapter } from './llm-adapter.js';
export {
  LLMAdapterFromProvider,
  toOpenAIMessages,
  fromOpenAIResponse,
  toOpenAITools,
} from './llm-adapter.js';

// LLM Provider (M0.5)
export {
  ProviderRegistry,
  type LLMProvider,
  type ProviderConfig,
  type StreamChunk,
} from './llm-provider.js';

// Providers
export { OpenAIProvider, OpenAIAPIError } from './providers/openai-provider.js';
export { AnthropicProvider, AnthropicAPIError } from './providers/anthropic-provider.js';
export { OllamaProvider } from './providers/ollama-provider.js';

// Model Metadata
export {
  MODEL_CATALOG,
  getModelMetadata,
  estimateCost,
  type ModelMetadata,
} from './model-metadata.js';

// Cost Tracker
export {
  CostTracker,
  type CostRecord,
  type BudgetConfig,
  type BudgetStatus,
} from './cost-tracker.js';

// Rate Limiter
export {
  RateLimiter,
  jitteredBackoff,
  type RateLimitState,
} from './rate-limiter.js';

// Stream Utilities
export { parseSSEStream, collectStreamToResponse } from './stream-utils.js';

// Orchestrator
export {
  Orchestrator,
  type OrchestratorInput,
  type OrchestratorOutput,
} from './orchestrator.js';

// Capability Registry (M2)
export {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityHandler,
  type CapabilityResult,
  type CapabilityFilter,
  type CapabilityExample,
  type ParameterSchema,
  type PropertySchema,
  type ReturnSchema,
} from './capability-registry.js';

// Capability Validator (M2)
export {
  validateArgs,
  validateCapabilityDefinition,
  type ValidationResult,
} from './capability-validator.js';

// Memory subsystem (M4)
export * from './memory/index.js';

// Observability & DevTools
export * from './observability/index.js';

// Safety subsystem (M3-lite)
export * from './safety/index.js';

// Orchestration – Multi-Agent (M6)
export * from './orchestration/index.js';

// Built-in Tools (M8)
export * from './tools/index.js';

// Session & Compression Engine (M5)
export * from './session/index.js';

// Frontend Integration Layer (M10)
export * from './frontend/index.js';

// Async Tasks & Domain Agent Profiles (M7)
export * from './tasks/index.js';

// UX – Dialogue & Progress System (M11)
export * from './ux/index.js';
