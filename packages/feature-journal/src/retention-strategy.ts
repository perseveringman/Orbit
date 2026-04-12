import type {
  ActionLogImportance,
  IsoDateTimeString,
} from '@orbit/domain';

// ── Retention tiers ────────────────────────────────────────

export type RetentionTier = 'core_permanent' | 'crumb_short' | 'insight_medium' | 'tech_log';

// ── Policy definition ──────────────────────────────────────

export interface RetentionPolicy {
  readonly tier: RetentionTier;
  readonly description: string;
  readonly minDays: number | null;
  readonly maxDays: number | null;
}

export const RETENTION_POLICIES: Readonly<Record<RetentionTier, RetentionPolicy>> = {
  core_permanent: {
    tier: 'core_permanent',
    description: 'Day notes, confirmed summaries, pinned insights — never expire',
    minDays: null,
    maxDays: null,
  },
  crumb_short: {
    tier: 'crumb_short',
    description: 'Action logs, hidden events — short retention',
    minDays: 7,
    maxDays: 30,
  },
  insight_medium: {
    tier: 'insight_medium',
    description: 'Behavior insights unless pinned — medium retention',
    minDays: 30,
    maxDays: 90,
  },
  tech_log: {
    tier: 'tech_log',
    description: 'System events, debug info — short retention',
    minDays: 7,
    maxDays: 30,
  },
} as const;

// ── Tier classification ────────────────────────────────────

type RetainableObjectType =
  | 'event'
  | 'action_log'
  | 'day_note'
  | 'journal_summary'
  | 'behavior_insight';

export function getRetentionTier(
  objectType: RetainableObjectType,
  importance?: ActionLogImportance,
): RetentionTier {
  switch (objectType) {
    case 'day_note':
    case 'journal_summary':
      return 'core_permanent';
    case 'action_log':
      return importance === 'major' ? 'core_permanent' : 'crumb_short';
    case 'behavior_insight':
      return 'insight_medium';
    case 'event':
      return 'tech_log';
  }
}

// ── Expiry calculation ─────────────────────────────────────

export function getExpiryDate(
  tier: RetentionTier,
  createdAt: IsoDateTimeString,
): IsoDateTimeString | null {
  const policy = RETENTION_POLICIES[tier];
  if (policy.maxDays === null) return null;

  const createdMs = new Date(createdAt).getTime();
  const expiryMs = createdMs + policy.maxDays * 24 * 60 * 60 * 1000;
  return new Date(expiryMs).toISOString();
}

// ── Retention check ────────────────────────────────────────

interface RetainableItem {
  readonly objectType: string;
  readonly createdAt: IsoDateTimeString;
  readonly importance?: ActionLogImportance;
  readonly status?: string;
}

export function isRetained(item: RetainableItem, now: IsoDateTimeString): boolean {
  // Pinned insights are always retained
  if (item.objectType === 'behavior_insight' && item.status === 'pinned') {
    return true;
  }

  const tier = getRetentionTier(
    item.objectType as RetainableObjectType,
    item.importance,
  );
  const expiryDate = getExpiryDate(tier, item.createdAt);

  if (expiryDate === null) return true;
  return new Date(now).getTime() < new Date(expiryDate).getTime();
}

// ── Collect expired items ──────────────────────────────────

export function collectExpiredItems<T extends RetainableItem>(
  items: readonly T[],
  now: IsoDateTimeString,
): readonly T[] {
  return items.filter((item) => !isRetained(item, now));
}
