import type {
  ActorType,
  OrbitEvent,
  EventSurface,
} from '@orbit/domain';

// ── Semantic event categories ──────────────────────────────

export type SemanticEventCategory =
  | 'object_lifecycle'
  | 'relation_change'
  | 'reading'
  | 'research'
  | 'writing'
  | 'execution'
  | 'journal';

// ── Event type literals per category ───────────────────────

export type ObjectLifecycleEvent =
  | 'object.created'
  | 'object.updated'
  | 'object.deleted'
  | 'object.archived'
  | 'object.restored';

export type RelationChangeEvent =
  | 'relation.linked'
  | 'relation.unlinked'
  | 'relation.reordered';

export type ReadingEvent =
  | 'reading.started'
  | 'reading.progress'
  | 'reading.finished'
  | 'reading.highlighted'
  | 'reading.annotated';

export type ResearchEvent =
  | 'research.query_created'
  | 'research.source_added'
  | 'research.claim_recorded'
  | 'research.gap_identified';

export type WritingEvent =
  | 'writing.draft_created'
  | 'writing.draft_updated'
  | 'writing.published'
  | 'writing.word_count_changed';

export type ExecutionEvent =
  | 'task.created'
  | 'task.completed'
  | 'task.status_changed'
  | 'milestone.reached'
  | 'project.status_changed';

export type JournalEvent =
  | 'journal.note_created'
  | 'journal.note_updated'
  | 'journal.summary_generated'
  | 'journal.insight_proposed';

export type SemanticEventType =
  | ObjectLifecycleEvent
  | RelationChangeEvent
  | ReadingEvent
  | ResearchEvent
  | WritingEvent
  | ExecutionEvent
  | JournalEvent;

// ── Event catalog ──────────────────────────────────────────

interface EventTypeDescriptor {
  readonly type: SemanticEventType;
  readonly description: string;
}

export const SEMANTIC_EVENT_CATALOG: Readonly<
  Record<SemanticEventCategory, readonly EventTypeDescriptor[]>
> = {
  object_lifecycle: [
    { type: 'object.created', description: 'A new object was created' },
    { type: 'object.updated', description: 'An object was modified' },
    { type: 'object.deleted', description: 'An object was deleted' },
    { type: 'object.archived', description: 'An object was archived' },
    { type: 'object.restored', description: 'An object was restored from archive' },
  ],
  relation_change: [
    { type: 'relation.linked', description: 'Two objects were linked' },
    { type: 'relation.unlinked', description: 'A relation between objects was removed' },
    { type: 'relation.reordered', description: 'Relations were reordered' },
  ],
  reading: [
    { type: 'reading.started', description: 'User started reading an article' },
    { type: 'reading.progress', description: 'Reading progress updated' },
    { type: 'reading.finished', description: 'User finished reading' },
    { type: 'reading.highlighted', description: 'User highlighted text' },
    { type: 'reading.annotated', description: 'User added an annotation' },
  ],
  research: [
    { type: 'research.query_created', description: 'A research query was created' },
    { type: 'research.source_added', description: 'A source was added to research' },
    { type: 'research.claim_recorded', description: 'A research claim was recorded' },
    { type: 'research.gap_identified', description: 'A research gap was identified' },
  ],
  writing: [
    { type: 'writing.draft_created', description: 'A new draft was created' },
    { type: 'writing.draft_updated', description: 'A draft was updated' },
    { type: 'writing.published', description: 'A document was published' },
    { type: 'writing.word_count_changed', description: 'Word count changed significantly' },
  ],
  execution: [
    { type: 'task.created', description: 'A new task was created' },
    { type: 'task.completed', description: 'A task was completed' },
    { type: 'task.status_changed', description: 'Task status changed' },
    { type: 'milestone.reached', description: 'A milestone was reached' },
    { type: 'project.status_changed', description: 'Project status changed' },
  ],
  journal: [
    { type: 'journal.note_created', description: 'A journal note was created' },
    { type: 'journal.note_updated', description: 'A journal note was updated' },
    { type: 'journal.summary_generated', description: 'A journal summary was generated' },
    { type: 'journal.insight_proposed', description: 'A behavior insight was proposed' },
  ],
} as const;

// ── Category → surface mapping ─────────────────────────────

const CATEGORY_TO_SURFACE: Readonly<Record<SemanticEventCategory, EventSurface>> = {
  object_lifecycle: 'app',
  relation_change: 'app',
  reading: 'reader',
  research: 'research',
  writing: 'writing',
  execution: 'task',
  journal: 'journal',
};

// ── Helpers ────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  const ts = Date.now().toString(36);
  _counter += 1;
  return `evt_${ts}_${_counter.toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Factory ────────────────────────────────────────────────

export interface SemanticEventInput {
  readonly actorType: ActorType;
  readonly actorId?: string | null;
  readonly objectUid?: string | null;
  readonly relatedUids?: readonly string[] | null;
  readonly payload?: Readonly<Record<string, unknown>> | null;
  readonly streamUid?: string;
}

export function createSemanticEvent(
  category: SemanticEventCategory,
  eventType: SemanticEventType,
  actor: SemanticEventInput,
  payload?: Readonly<Record<string, unknown>> | null,
): OrbitEvent {
  const now = nowIso();
  return {
    objectType: 'event',
    id: generateId(),
    streamUid: actor.streamUid ?? 'default',
    eventType,
    actorType: actor.actorType,
    actorId: actor.actorId ?? null,
    surface: CATEGORY_TO_SURFACE[category],
    objectUid: actor.objectUid ?? null,
    relatedUids: actor.relatedUids ?? null,
    payload: payload ?? actor.payload ?? null,
    captureMode: 'explicit',
    privacyLevel: 'normal',
    agentAccess: 'full_local_only',
    retentionClass: 'crumb',
    occurredAt: now,
    redactedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Categorize an existing event ───────────────────────────

const PREFIX_TO_CATEGORY: readonly (readonly [string, SemanticEventCategory])[] = [
  ['object.', 'object_lifecycle'],
  ['relation.', 'relation_change'],
  ['reading.', 'reading'],
  ['research.', 'research'],
  ['writing.', 'writing'],
  ['task.', 'execution'],
  ['milestone.', 'execution'],
  ['project.', 'execution'],
  ['journal.', 'journal'],
];

export function categorizeEvent(event: OrbitEvent): SemanticEventCategory {
  for (const [prefix, category] of PREFIX_TO_CATEGORY) {
    if (event.eventType.startsWith(prefix)) {
      return category;
    }
  }
  return 'object_lifecycle';
}
