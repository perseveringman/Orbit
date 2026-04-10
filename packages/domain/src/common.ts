// ── Scalar type aliases ────────────────────────────────────
/** ISO 8601 date string: "2025-01-15" */
export type IsoDateString = string;

/** ISO 8601 datetime string: "2025-01-15T08:30:00Z" */
export type IsoDateTimeString = string;

/** ULID-based stable object identifier */
export type ObjectId = string;

// ── Object metadata enums ──────────────────────────────────

export type ObjectOrigin = 'human' | 'ai' | 'system';
export type ObjectLayer = 'source' | 'wiki' | 'system';
export type ObjectVisibility = 'private' | 'workspace' | 'public';

// ── Base interface ─────────────────────────────────────────

export interface OrbitObjectBase {
  readonly id: string;
  readonly objectType: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Planning shared enums ──────────────────────────────────

export type PlanningHorizon =
  | 'five_year'
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day';

export type PlanningStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'done'
  | 'archived';

export type DecisionMode =
  | 'user_written'
  | 'agent_suggested'
  | 'user_confirmed';

export interface TimeWindow {
  readonly start: IsoDateString;
  readonly end: IsoDateString;
}

// ── Highlight anchor payload ───────────────────────────────

export type AnchorState = 'active' | 'fuzzy' | 'detached';

export interface AnchorPayload {
  readonly sourceVersion?: string;
  readonly locator: Readonly<Record<string, unknown>>;
  readonly quote: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly textHash: string;
  readonly state: AnchorState;
}
