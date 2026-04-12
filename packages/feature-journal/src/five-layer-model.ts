import type {
  PrivacyLevel,
  AgentAccess,
  OrbitEvent,
  ActionLog,
  DayNote,
  JournalSummary,
  BehaviorInsight,
} from '@orbit/domain';

// ── Layer type ─────────────────────────────────────────────

export type JournalLayer =
  | 'event'
  | 'action_log'
  | 'day_note'
  | 'journal_summary'
  | 'behavior_insight';

// ── Per-layer configuration ────────────────────────────────

export interface LayerConfig {
  readonly layer: JournalLayer;
  readonly retentionDays: number | null;
  readonly privacyDefault: PrivacyLevel;
  readonly agentAccessDefault: AgentAccess;
  readonly aggregationWindow: number | null;
}

// ── Default configurations ─────────────────────────────────

export const LAYER_CONFIGS: Readonly<Record<JournalLayer, LayerConfig>> = {
  event: {
    layer: 'event',
    retentionDays: 30,
    privacyDefault: 'normal',
    agentAccessDefault: 'full_local_only',
    aggregationWindow: null,
  },
  action_log: {
    layer: 'action_log',
    retentionDays: 90,
    privacyDefault: 'normal',
    agentAccessDefault: 'summary_only',
    aggregationWindow: 15,
  },
  day_note: {
    layer: 'day_note',
    retentionDays: null,
    privacyDefault: 'normal',
    agentAccessDefault: 'summary_only',
    aggregationWindow: null,
  },
  journal_summary: {
    layer: 'journal_summary',
    retentionDays: null,
    privacyDefault: 'normal',
    agentAccessDefault: 'summary_only',
    aggregationWindow: null,
  },
  behavior_insight: {
    layer: 'behavior_insight',
    retentionDays: 90,
    privacyDefault: 'normal',
    agentAccessDefault: 'deny',
    aggregationWindow: null,
  },
} as const;

export function getLayerConfig(layer: JournalLayer): LayerConfig {
  return LAYER_CONFIGS[layer];
}

// ── Composite day view ─────────────────────────────────────

export interface JournalDayView {
  readonly dayKey: string;
  readonly events: readonly OrbitEvent[];
  readonly actionLogs: readonly ActionLog[];
  readonly dayNote: DayNote | null;
  readonly summary: JournalSummary | null;
  readonly insights: readonly BehaviorInsight[];
}
