import type {
  IsoDateTimeString,
  IsoDateString,
  PlanningStatus,
  DecisionMode,
  TimeWindow,
} from './common.js';

// ── Vision ─────────────────────────────────────────────────

export type VisionStatus = 'active' | 'archived';

export type VisionReminderMode =
  | 'review_only'
  | 'decision_points'
  | 'on_request'
  | 'silent';

export type VisionScope = 'life' | 'career' | 'theme';

export interface Vision {
  readonly objectType: 'vision';
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly currentVersionId: string;
  readonly status: VisionStatus;
  readonly reminderMode: VisionReminderMode;
  readonly scope: VisionScope;
  readonly ownerUserId: string;
  readonly sourceFileId: string | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly lastReaffirmedAt: IsoDateTimeString | null;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── VisionVersion ──────────────────────────────────────────

export type VisionAuthoredBy = 'user' | 'user-confirmed-agent-draft';

export interface VisionVersion {
  readonly id: string;
  readonly visionId: string;
  readonly versionNo: number;
  readonly sourceFileId: string;
  readonly bodyMarkdown: string;
  readonly summaryForAgent: string;
  readonly changeNote: string | null;
  readonly authoredBy: VisionAuthoredBy;
  readonly createdAt: IsoDateTimeString;
}

// ── Direction ──────────────────────────────────────────────

export interface Direction {
  readonly objectType: 'direction';
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly horizon: 'year';
  readonly status: PlanningStatus;
  readonly timeWindow: TimeWindow;
  readonly decisionMode: DecisionMode;
  readonly confidence: number | null;
  readonly reviewAt: IsoDateTimeString | null;
  readonly successSignals: readonly string[] | null;
  readonly visionId: string | null;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Theme ──────────────────────────────────────────────────

export interface Theme {
  readonly objectType: 'theme';
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly horizon: 'quarter';
  readonly status: PlanningStatus;
  readonly timeWindow: TimeWindow;
  readonly decisionMode: DecisionMode;
  readonly confidence: number | null;
  readonly reviewAt: IsoDateTimeString | null;
  readonly successSignals: readonly string[] | null;
  readonly directionId: string | null;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Goal ───────────────────────────────────────────────────

export interface Goal {
  readonly objectType: 'goal';
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly horizon: 'month' | 'quarter';
  readonly status: PlanningStatus;
  readonly timeWindow: TimeWindow;
  readonly decisionMode: DecisionMode;
  readonly confidence: number | null;
  readonly reviewAt: IsoDateTimeString | null;
  readonly successSignals: readonly string[] | null;
  readonly themeId: string | null;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Commitment ─────────────────────────────────────────────

export interface Commitment {
  readonly objectType: 'commitment';
  readonly id: string;
  readonly title: string;
  readonly body: string | null;
  readonly horizon: 'week';
  readonly status: PlanningStatus;
  readonly timeWindow: TimeWindow;
  readonly decisionMode: DecisionMode;
  readonly confidence: number | null;
  readonly reviewAt: IsoDateTimeString | null;
  readonly goalId: string | null;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Review ─────────────────────────────────────────────────

export type ReviewCycle =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

export type ReviewStatus = 'draft' | 'confirmed' | 'archived';

export interface Review {
  readonly objectType: 'review';
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly cycle: ReviewCycle;
  readonly status: ReviewStatus;
  readonly timeWindow: TimeWindow;
  readonly decisionMode: DecisionMode;
  readonly decisions: readonly string[] | null;
  readonly sourceFileId: string | null;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}
