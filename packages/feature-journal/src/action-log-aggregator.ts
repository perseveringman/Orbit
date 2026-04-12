import type {
  OrbitEvent,
  ActionLog,
  ActionLogImportance,
  PrivacyLevel,
  AgentAccess,
} from '@orbit/domain';

// ── Aggregation rule ───────────────────────────────────────

export interface AggregationRule {
  readonly actionKindPattern: string;
  readonly objectUidMatch: boolean;
  readonly timeWindowMinutes: number;
  readonly collapseStrategy: 'merge' | 'latest' | 'first';
}

// ── Defaults ───────────────────────────────────────────────

export const DEFAULT_AGGREGATION_RULES: readonly AggregationRule[] = [
  {
    actionKindPattern: 'object.updated',
    objectUidMatch: true,
    timeWindowMinutes: 15,
    collapseStrategy: 'merge',
  },
  {
    actionKindPattern: 'reading.progress',
    objectUidMatch: true,
    timeWindowMinutes: 30,
    collapseStrategy: 'latest',
  },
  {
    actionKindPattern: 'writing.draft_updated',
    objectUidMatch: true,
    timeWindowMinutes: 30,
    collapseStrategy: 'merge',
  },
  {
    actionKindPattern: 'task.status_changed',
    objectUidMatch: true,
    timeWindowMinutes: 5,
    collapseStrategy: 'latest',
  },
];

// ── Helpers ────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  const ts = Date.now().toString(36);
  _counter += 1;
  return `alog_${ts}_${_counter.toString(36)}`;
}

function toDayKey(isoString: string): string {
  return isoString.slice(0, 10);
}

function diffMinutes(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;
}

function maxPrivacy(a: PrivacyLevel, b: PrivacyLevel): PrivacyLevel {
  const order: Record<PrivacyLevel, number> = { normal: 0, sensitive: 1, sealed: 2 };
  return order[a] >= order[b] ? a : b;
}

function stricterAccess(a: AgentAccess, b: AgentAccess): AgentAccess {
  const order: Record<AgentAccess, number> = { full_local_only: 0, summary_only: 1, deny: 2 };
  return order[a] >= order[b] ? a : b;
}

function maxImportance(events: readonly OrbitEvent[]): ActionLogImportance {
  // Events with certain types get higher importance
  const majorTypes = new Set([
    'task.completed',
    'milestone.reached',
    'writing.published',
    'reading.finished',
  ]);
  for (const e of events) {
    if (majorTypes.has(e.eventType)) return 'major';
  }
  return 'normal';
}

function mergePayloads(events: readonly OrbitEvent[]): Readonly<Record<string, unknown>> | null {
  const merged: Record<string, unknown> = {};
  let hasData = false;
  for (const e of events) {
    if (e.payload) {
      hasData = true;
      Object.assign(merged, e.payload);
    }
  }
  return hasData ? merged : null;
}

function mergeRelatedUids(events: readonly OrbitEvent[]): readonly string[] | null {
  const uids = new Set<string>();
  for (const e of events) {
    if (e.relatedUids) {
      for (const uid of e.relatedUids) uids.add(uid);
    }
  }
  return uids.size > 0 ? [...uids] : null;
}

function findMatchingRule(
  event: OrbitEvent,
  rules: readonly AggregationRule[],
): AggregationRule | null {
  for (const rule of rules) {
    if (event.eventType === rule.actionKindPattern || event.eventType.startsWith(rule.actionKindPattern.replace('*', ''))) {
      return rule;
    }
  }
  return null;
}

// ── Core aggregation ───────────────────────────────────────

interface EventGroup {
  readonly rule: AggregationRule | null;
  readonly events: OrbitEvent[];
  readonly key: string;
}

export function aggregateEvents(
  events: readonly OrbitEvent[],
  rules: readonly AggregationRule[] = DEFAULT_AGGREGATION_RULES,
): readonly ActionLog[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  const groups: EventGroup[] = [];

  for (const event of sorted) {
    const rule = findMatchingRule(event, rules);
    const groupKey = rule
      ? `${event.eventType}::${rule.objectUidMatch ? (event.objectUid ?? '_') : '_'}`
      : `_ungrouped_::${event.id}`;

    const existing = rule
      ? groups.find(
          (g) =>
            g.key === groupKey &&
            g.rule !== null &&
            diffMinutes(event.occurredAt, g.events[g.events.length - 1].occurredAt) <=
              g.rule.timeWindowMinutes,
        )
      : null;

    if (existing) {
      existing.events.push(event);
    } else {
      groups.push({ rule, events: [event], key: groupKey });
    }
  }

  return groups.map((g) => buildActionLog(g.events, g.rule));
}

function buildActionLog(
  events: readonly OrbitEvent[],
  rule: AggregationRule | null,
): ActionLog {
  const first = events[0];
  const last = events[events.length - 1];
  const now = new Date().toISOString();

  let detail: Readonly<Record<string, unknown>> | null;
  if (rule?.collapseStrategy === 'latest') {
    detail = last.payload;
  } else if (rule?.collapseStrategy === 'first') {
    detail = first.payload;
  } else {
    detail = mergePayloads(events);
  }

  const startMs = new Date(first.occurredAt).getTime();
  const endMs = new Date(last.occurredAt).getTime();
  const durationSeconds = endMs > startMs ? Math.round((endMs - startMs) / 1000) : null;

  let privacy: PrivacyLevel = 'normal';
  let access: AgentAccess = 'full_local_only';
  for (const e of events) {
    privacy = maxPrivacy(privacy, e.privacyLevel);
    access = stricterAccess(access, e.agentAccess);
  }

  return {
    objectType: 'action_log',
    id: generateId(),
    dayKey: toDayKey(first.occurredAt),
    actionKind: first.eventType,
    primaryObjectUid: first.objectUid,
    relatedUids: mergeRelatedUids(events),
    title: formatActionLogTitle(first.eventType),
    subtitle: events.length > 1 ? `${events.length} events collapsed` : null,
    detail,
    sourceEventIds: events.map((e) => e.id),
    importance: maxImportance(events),
    privacyLevel: privacy,
    agentAccess: access,
    startedAt: first.occurredAt,
    endedAt: last.occurredAt,
    durationSeconds,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Title formatting ───────────────────────────────────────

const ACTION_TITLES: Readonly<Record<string, string>> = {
  'object.created': 'Created',
  'object.updated': 'Updated',
  'object.deleted': 'Deleted',
  'object.archived': 'Archived',
  'object.restored': 'Restored',
  'relation.linked': 'Linked',
  'relation.unlinked': 'Unlinked',
  'relation.reordered': 'Reordered',
  'reading.started': 'Started reading',
  'reading.progress': 'Reading progress',
  'reading.finished': 'Finished reading',
  'reading.highlighted': 'Highlighted',
  'reading.annotated': 'Annotated',
  'research.query_created': 'New research query',
  'research.source_added': 'Source added',
  'research.claim_recorded': 'Claim recorded',
  'research.gap_identified': 'Gap identified',
  'writing.draft_created': 'Started writing',
  'writing.draft_updated': 'Updated draft',
  'writing.published': 'Published',
  'writing.word_count_changed': 'Word count changed',
  'task.created': 'Task created',
  'task.completed': 'Task completed',
  'task.status_changed': 'Task status changed',
  'milestone.reached': 'Milestone reached',
  'project.status_changed': 'Project status changed',
  'journal.note_created': 'Journal entry',
  'journal.note_updated': 'Journal updated',
  'journal.summary_generated': 'Summary generated',
  'journal.insight_proposed': 'Insight proposed',
};

export function formatActionLogTitle(
  actionKind: string,
  objectTitle?: string,
): string {
  const base = ACTION_TITLES[actionKind] ?? actionKind;
  return objectTitle ? `${base}: ${objectTitle}` : base;
}
