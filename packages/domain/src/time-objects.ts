import type { IsoDateTimeString, IsoDateString } from './common.js';

// ── Shared time enums ──────────────────────────────────────

export type PrivacyLevel = 'normal' | 'sensitive' | 'sealed';
export type AgentAccess = 'deny' | 'summary_only' | 'full_local_only';
export type RetentionClass = 'core' | 'crumb' | 'audit';
export type CaptureMode = 'explicit' | 'implicit' | 'imported' | 'derived';
export type ActorType = 'user' | 'agent' | 'system';

export type EventSurface =
  | 'reader'
  | 'research'
  | 'writing'
  | 'journal'
  | 'task'
  | 'app';

// ── Event (L1 — atomic truth) ──────────────────────────────

export interface OrbitEvent {
  readonly objectType: 'event';
  readonly id: string;
  readonly streamUid: string;
  readonly eventType: string;
  readonly actorType: ActorType;
  readonly actorId: string | null;
  readonly surface: EventSurface;
  readonly objectUid: string | null;
  readonly relatedUids: readonly string[] | null;
  readonly payload: Readonly<Record<string, unknown>> | null;
  readonly captureMode: CaptureMode;
  readonly privacyLevel: PrivacyLevel;
  readonly agentAccess: AgentAccess;
  readonly retentionClass: RetentionClass;
  readonly occurredAt: IsoDateTimeString;
  readonly redactedAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── ActionLog (L2 — aggregated for Journal) ────────────────

export type ActionLogImportance = 'hidden' | 'normal' | 'major';

export interface ActionLog {
  readonly objectType: 'action_log';
  readonly id: string;
  readonly dayKey: IsoDateString;
  readonly actionKind: string;
  readonly primaryObjectUid: string | null;
  readonly relatedUids: readonly string[] | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly detail: Readonly<Record<string, unknown>> | null;
  readonly sourceEventIds: readonly string[];
  readonly importance: ActionLogImportance;
  readonly privacyLevel: PrivacyLevel;
  readonly agentAccess: AgentAccess;
  readonly startedAt: IsoDateTimeString;
  readonly endedAt: IsoDateTimeString;
  readonly durationSeconds: number | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── DayNote (L3 — user journal entry) ──────────────────────

export interface DayNote {
  readonly objectType: 'day_note';
  readonly id: string;
  readonly dayKey: IsoDateString;
  readonly noteKind: 'journal';
  readonly markdown: string;
  readonly filePath: string | null;
  readonly privacyLevel: PrivacyLevel;
  readonly agentAccess: AgentAccess;
  readonly reflectsOnUids: readonly string[] | null;
  readonly recordingMode: 'normal' | 'protected' | 'manual' | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── JournalSummary (L4 — AI-generated compression) ────────

export type JournalSummaryScope = 'day' | 'week' | 'month';
export type SummaryGenerator = 'system' | 'agent' | 'user_edited';

export interface JournalSummary {
  readonly objectType: 'journal_summary';
  readonly id: string;
  readonly scope: JournalSummaryScope;
  readonly scopeKey: string;
  readonly sourceActionLogIds: readonly string[];
  readonly sourceNoteIds: readonly string[] | null;
  readonly summaryMarkdown: string;
  readonly generatedBy: SummaryGenerator;
  readonly privacyLevel: PrivacyLevel;
  readonly agentAccess: AgentAccess;
  readonly versionNo: number;
  readonly supersededBy: string | null;
  readonly expiresAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── BehaviorInsight (L5 — pattern hypothesis) ──────────────

export type BehaviorInsightType =
  | 'focus_pattern'
  | 'input_to_output'
  | 'project_drift'
  | 'review_gap';

export type BehaviorInsightStatus =
  | 'proposed'
  | 'active'
  | 'dismissed'
  | 'pinned'
  | 'expired';

export type InsightVisibility = 'user_visible' | 'hidden_until_review';

export interface BehaviorInsight {
  readonly objectType: 'behavior_insight';
  readonly id: string;
  readonly insightType: BehaviorInsightType;
  readonly scopeStart: IsoDateTimeString;
  readonly scopeEnd: IsoDateTimeString;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly confidence: number | null;
  readonly sampleSize: number | null;
  readonly status: BehaviorInsightStatus;
  readonly visibility: InsightVisibility;
  readonly createdBy: 'agent' | 'user_confirmed';
  readonly expiresAt: IsoDateTimeString;
  readonly dismissedReason: string | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}
