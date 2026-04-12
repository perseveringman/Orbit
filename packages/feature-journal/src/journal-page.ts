import type {
  ActionLog,
  DayNote,
  JournalSummary,
  BehaviorInsight,
  IsoDateString,
} from '@orbit/domain';

// ── Date header ────────────────────────────────────────────

export interface JournalDateHeader {
  readonly dayKey: IsoDateString;
  readonly dayOfWeek: string;
  readonly isToday: boolean;
  readonly notableEventsCount: number;
}

// ── Timeline ───────────────────────────────────────────────

export interface TimelineGroup {
  readonly hour: number;
  readonly logs: readonly ActionLog[];
}

export interface JournalTimeline {
  readonly groups: readonly TimelineGroup[];
  readonly totalCount: number;
}

// ── Page model ─────────────────────────────────────────────

export interface JournalPage {
  readonly dateHeader: JournalDateHeader;
  readonly dayNote: DayNote | null;
  readonly timeline: JournalTimeline;
  readonly summary: JournalSummary | null;
  readonly insights: readonly BehaviorInsight[];
}

// ── Group action logs by hour ──────────────────────────────

export function groupByHour(logs: readonly ActionLog[]): readonly TimelineGroup[] {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  const map = new Map<number, ActionLog[]>();

  for (const log of sorted) {
    const hour = new Date(log.startedAt).getUTCHours();
    const existing = map.get(hour);
    if (existing) {
      existing.push(log);
    } else {
      map.set(hour, [log]);
    }
  }

  const groups: TimelineGroup[] = [];
  for (const [hour, hourLogs] of map) {
    groups.push({ hour, logs: hourLogs });
  }

  return groups.sort((a, b) => a.hour - b.hour);
}

// ── Day-of-week helper ─────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayOfWeek(dayKey: IsoDateString): string {
  const d = new Date(dayKey + 'T00:00:00Z');
  return DAY_NAMES[d.getUTCDay()];
}

function isToday(dayKey: IsoDateString): boolean {
  return dayKey === new Date().toISOString().slice(0, 10);
}

// ── Build journal page ─────────────────────────────────────

export function buildJournalPage(
  dayKey: IsoDateString,
  dayNote: DayNote | null,
  actionLogs: readonly ActionLog[],
  summary: JournalSummary | null,
  insights: readonly BehaviorInsight[],
): JournalPage {
  const majorLogs = actionLogs.filter((l) => l.importance === 'major');
  const groups = groupByHour(actionLogs);

  return {
    dateHeader: {
      dayKey,
      dayOfWeek: getDayOfWeek(dayKey),
      isToday: isToday(dayKey),
      notableEventsCount: majorLogs.length,
    },
    dayNote,
    timeline: {
      groups,
      totalCount: actionLogs.length,
    },
    summary,
    insights,
  };
}
