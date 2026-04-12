// ── Five-Layer Model ───────────────────────────────────────
export {
  type JournalLayer,
  type LayerConfig,
  LAYER_CONFIGS,
  getLayerConfig,
  type JournalDayView,
} from './five-layer-model.js';

// ── Semantic Events ────────────────────────────────────────
export {
  type SemanticEventCategory,
  type ObjectLifecycleEvent,
  type RelationChangeEvent,
  type ReadingEvent,
  type ResearchEvent,
  type WritingEvent,
  type ExecutionEvent,
  type JournalEvent,
  type SemanticEventType,
  SEMANTIC_EVENT_CATALOG,
  type SemanticEventInput,
  createSemanticEvent,
  categorizeEvent,
} from './semantic-events.js';

// ── Privacy Classifier ─────────────────────────────────────
export {
  PrivacyKeywords,
  classifyPrivacy,
  deriveAgentAccess,
  type PrivacyOverride,
  applyPrivacyOverride,
  canAgentAccess,
} from './privacy-classifier.js';

// ── Action Log Aggregator ──────────────────────────────────
export {
  type AggregationRule,
  DEFAULT_AGGREGATION_RULES,
  aggregateEvents,
  formatActionLogTitle,
} from './action-log-aggregator.js';

// ── Journal Page ───────────────────────────────────────────
export {
  type JournalDateHeader,
  type TimelineGroup,
  type JournalTimeline,
  type JournalPage,
  groupByHour,
  buildJournalPage,
} from './journal-page.js';

// ── Day Note Service ───────────────────────────────────────
export {
  type DayNoteService,
  createDayNote,
  updateDayNote,
} from './day-note-service.js';

// ── Summary Generator ──────────────────────────────────────
export {
  type SummaryRequest,
  type SummaryPromptBuilder,
  buildDaySummaryPrompt,
  buildWeekSummaryPrompt,
  buildMonthSummaryPrompt,
  createJournalSummary,
  shouldAutoGenerate,
} from './summary-generator.js';

// ── Behavior Insight Engine ────────────────────────────────
export {
  type InsightPattern,
  type InsightDetectorInput,
  type InsightDetectorResult,
  INSIGHT_PATTERNS,
  createBehaviorInsight,
  isExpired,
  dismissInsight,
} from './behavior-insight-engine.js';

// ── Retention Strategy ─────────────────────────────────────
export {
  type RetentionTier,
  type RetentionPolicy,
  RETENTION_POLICIES,
  getRetentionTier,
  getExpiryDate,
  isRetained,
  collectExpiredItems,
} from './retention-strategy.js';

// ── Privacy Mode ───────────────────────────────────────────
export {
  type RecordingMode,
  type ProtectedSession,
  type SealedObjectAccess,
  startProtectedSession,
  endProtectedSession,
  isInProtectedMode,
  requestSealedAccess,
  isSealedAccessValid,
} from './privacy-mode.js';
