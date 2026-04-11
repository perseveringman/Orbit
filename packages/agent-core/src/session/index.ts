// ---------------------------------------------------------------------------
// @orbit/agent-core – Session subsystem barrel export (M5)
// ---------------------------------------------------------------------------

export { TokenEstimator } from './token-estimator.js';

export {
  SessionManager,
  type SessionRecord,
  type SessionForkOptions,
} from './session-manager.js';

export {
  CompressionEngine,
  HeadTailStrategy,
  ImportanceStrategy,
  SlidingWindowStrategy,
  createDefaultCompressionEngine,
  type CompressionStrategy,
  type CompressionOptions,
  type CompressionResult,
} from './compression-engine.js';
