// ── Fetch Scheduler ─────────────────────────────────────────
import type { IsoDateTimeString } from '@orbit/domain';

// ── Schedule entry ──────────────────────────────────────────

export interface FetchScheduleEntry {
  readonly endpointId: string;
  readonly nextFetchAt: IsoDateTimeString;
  readonly intervalMinutes: number;
  readonly consecutiveErrors: number;
}

// ── Config ──────────────────────────────────────────────────

export interface FetchSchedulerConfig {
  readonly defaultIntervalMinutes: number;
  readonly minIntervalMinutes: number;
  readonly maxIntervalMinutes: number;
  readonly errorBackoffMultiplier: number;
  readonly maxConsecutiveErrors: number;
  readonly adaptiveEnabled: boolean;
}

export const DEFAULT_SCHEDULER_CONFIG: FetchSchedulerConfig = {
  defaultIntervalMinutes: 60,
  minIntervalMinutes: 15,
  maxIntervalMinutes: 1440,
  errorBackoffMultiplier: 2.0,
  maxConsecutiveErrors: 5,
  adaptiveEnabled: true,
};

// ── Core functions ──────────────────────────────────────────

export function computeNextFetchSchedule(
  entry: FetchScheduleEntry,
  config: FetchSchedulerConfig,
  fetchResult: 'success' | 'error' | 'no_new_items',
): FetchScheduleEntry {
  let intervalMinutes = entry.intervalMinutes;
  let consecutiveErrors = entry.consecutiveErrors;

  switch (fetchResult) {
    case 'success': {
      consecutiveErrors = 0;
      break;
    }
    case 'error': {
      consecutiveErrors += 1;
      intervalMinutes = intervalMinutes * config.errorBackoffMultiplier;
      if (consecutiveErrors >= config.maxConsecutiveErrors) {
        intervalMinutes = config.maxIntervalMinutes * 10;
      }
      break;
    }
    case 'no_new_items': {
      if (config.adaptiveEnabled) {
        intervalMinutes = intervalMinutes * 1.1;
      }
      break;
    }
  }

  intervalMinutes = Math.min(
    Math.max(intervalMinutes, config.minIntervalMinutes),
    fetchResult === 'error' && consecutiveErrors >= config.maxConsecutiveErrors
      ? config.maxIntervalMinutes * 10
      : config.maxIntervalMinutes,
  );

  const nextFetchAt = new Date(
    Date.now() + intervalMinutes * 60_000,
  ).toISOString() as IsoDateTimeString;

  return {
    endpointId: entry.endpointId,
    nextFetchAt,
    intervalMinutes,
    consecutiveErrors,
  };
}

export function selectDueEndpoints(
  schedules: readonly FetchScheduleEntry[],
  now: IsoDateTimeString,
): readonly FetchScheduleEntry[] {
  return schedules.filter((s) => s.nextFetchAt <= now);
}

export function computeAdaptiveInterval(
  recentPublishTimes: readonly IsoDateTimeString[],
  config: FetchSchedulerConfig,
): number {
  if (recentPublishTimes.length < 2) {
    return config.defaultIntervalMinutes;
  }

  const sorted = [...recentPublishTimes]
    .map((t) => new Date(t).getTime())
    .sort((a, b) => a - b);

  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalGap += sorted[i] - sorted[i - 1];
  }

  const avgGapMs = totalGap / (sorted.length - 1);
  const avgGapMinutes = avgGapMs / 60_000;

  return Math.min(
    Math.max(avgGapMinutes, config.minIntervalMinutes),
    config.maxIntervalMinutes,
  );
}
