// ---------------------------------------------------------------------------
// @orbit/agent-core – Memory subsystem barrel export (M4)
// ---------------------------------------------------------------------------

export {
  InMemoryStore,
  type MemoryStore,
  type MemoryQuery,
  type ScoredMemory,
} from './memory-store.js';

export {
  MemoryLayerManager,
  DEFAULT_LAYER_CONFIGS,
  type LayerConfig,
  type LayerStats,
} from './memory-layer-manager.js';

export {
  ContextBuilder,
  type ContextBlock,
  type ContextBudget,
} from './context-builder.js';
