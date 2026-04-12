import type {
  BehaviorInsight,
  BehaviorInsightType,
  IsoDateTimeString,
} from '@orbit/domain';

// ── Insight pattern ────────────────────────────────────────

export interface InsightPattern {
  readonly type: BehaviorInsightType;
  readonly detector: (data: InsightDetectorInput) => InsightDetectorResult | null;
  readonly minimumDataDays: number;
  readonly description: string;
}

export interface InsightDetectorInput {
  readonly actionLogCounts: Readonly<Record<string, number>>;
  readonly dayCount: number;
  readonly readingCount: number;
  readonly writingCount: number;
  readonly projectIds: readonly string[];
  readonly reviewCount: number;
}

export interface InsightDetectorResult {
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly confidence: number;
}

// ── Pattern implementations ────────────────────────────────

function detectFocusPattern(data: InsightDetectorInput): InsightDetectorResult | null {
  if (data.dayCount < 7) return null;

  const kinds = Object.keys(data.actionLogCounts);
  if (kinds.length === 0) return null;

  const sorted = kinds.sort((a, b) => data.actionLogCounts[b] - data.actionLogCounts[a]);
  const topKind = sorted[0];
  const topCount = data.actionLogCounts[topKind];
  const total = Object.values(data.actionLogCounts).reduce((s, v) => s + v, 0);

  if (total === 0) return null;

  const ratio = topCount / total;
  if (ratio < 0.4) return null;

  return {
    statement: `You spend ${Math.round(ratio * 100)}% of your activity on "${topKind}" tasks.`,
    evidence: { topKind, topCount, total, ratio },
    confidence: Math.min(ratio, 0.95),
  };
}

function detectInputToOutput(data: InsightDetectorInput): InsightDetectorResult | null {
  if (data.dayCount < 7) return null;
  if (data.readingCount === 0 && data.writingCount === 0) return null;

  const total = data.readingCount + data.writingCount;
  const readRatio = data.readingCount / total;

  if (readRatio > 0.8) {
    return {
      statement: `Your input-to-output ratio is heavily skewed toward reading (${data.readingCount} reads vs ${data.writingCount} writes).`,
      evidence: { readingCount: data.readingCount, writingCount: data.writingCount, readRatio },
      confidence: 0.7,
    };
  }

  if (readRatio < 0.2) {
    return {
      statement: `You are producing more than consuming — ${data.writingCount} writes vs ${data.readingCount} reads.`,
      evidence: { readingCount: data.readingCount, writingCount: data.writingCount, readRatio },
      confidence: 0.7,
    };
  }

  return null;
}

function detectProjectDrift(data: InsightDetectorInput): InsightDetectorResult | null {
  if (data.dayCount < 14) return null;
  if (data.projectIds.length <= 3) return null;

  return {
    statement: `Activity is scattered across ${data.projectIds.length} projects in the last ${data.dayCount} days. Consider focusing on fewer projects.`,
    evidence: { projectCount: data.projectIds.length, dayCount: data.dayCount },
    confidence: 0.6,
  };
}

function detectReviewGap(data: InsightDetectorInput): InsightDetectorResult | null {
  if (data.dayCount < 7) return null;
  if (data.reviewCount > 0) return null;

  return {
    statement: `No review activity detected in the last ${data.dayCount} days.`,
    evidence: { reviewCount: data.reviewCount, dayCount: data.dayCount },
    confidence: 0.5,
  };
}

// ── Pattern catalog ────────────────────────────────────────

export const INSIGHT_PATTERNS: readonly InsightPattern[] = [
  {
    type: 'focus_pattern',
    detector: detectFocusPattern,
    minimumDataDays: 7,
    description: 'Detect repeated focus or distraction patterns in daily activity',
  },
  {
    type: 'input_to_output',
    detector: detectInputToOutput,
    minimumDataDays: 7,
    description: 'Measure the ratio of reading (input) to writing (output)',
  },
  {
    type: 'project_drift',
    detector: detectProjectDrift,
    minimumDataDays: 14,
    description: 'Detect stalled or scattered project activity',
  },
  {
    type: 'review_gap',
    detector: detectReviewGap,
    minimumDataDays: 7,
    description: 'Detect missed reviews or declining review quality',
  },
];

// ── Factory ────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  const ts = Date.now().toString(36);
  _counter += 1;
  return `ins_${ts}_${_counter.toString(36)}`;
}

export function createBehaviorInsight(
  type: BehaviorInsightType,
  statement: string,
  evidence: Readonly<Record<string, unknown>>,
  scopeStart: IsoDateTimeString,
  scopeEnd: IsoDateTimeString,
  confidence: number,
): BehaviorInsight {
  const now = new Date().toISOString();
  const expiresMs = new Date(now).getTime() + 90 * 24 * 60 * 60 * 1000;

  return {
    objectType: 'behavior_insight',
    id: generateId(),
    insightType: type,
    scopeStart,
    scopeEnd,
    statement,
    evidence,
    confidence,
    sampleSize: null,
    status: 'proposed',
    visibility: 'user_visible',
    createdBy: 'agent',
    expiresAt: new Date(expiresMs).toISOString(),
    dismissedReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Expiry check ───────────────────────────────────────────

export function isExpired(insight: BehaviorInsight): boolean {
  return new Date(insight.expiresAt).getTime() <= Date.now();
}

// ── Dismiss ────────────────────────────────────────────────

export function dismissInsight(
  insight: BehaviorInsight,
  reason: string,
): BehaviorInsight {
  return {
    ...insight,
    status: 'dismissed',
    dismissedReason: reason,
    updatedAt: new Date().toISOString(),
  };
}
