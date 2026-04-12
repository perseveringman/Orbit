import type { TaskStatus, IsoDateTimeString } from '@orbit/domain';
import type { ActorType } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export type TaskEventType =
  | 'status_changed'
  | 'assigned'
  | 'commented'
  | 'linked'
  | 'priority_changed'
  | 'deadline_changed';

export interface TaskEvent {
  readonly id: string;
  readonly taskId: string;
  readonly eventType: TaskEventType;
  readonly previousStatus: TaskStatus | null;
  readonly newStatus: TaskStatus | null;
  readonly timestamp: IsoDateTimeString;
  readonly actorType: ActorType;
  readonly metadata: Readonly<Record<string, unknown>> | null;
}

export interface RecordEventInput {
  readonly previousStatus?: TaskStatus | null;
  readonly newStatus?: TaskStatus | null;
  readonly actorType?: ActorType;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
}

// ── Functions ──────────────────────────────────────────────

let eventCounter = 0;

export function recordTaskEvent(
  taskId: string,
  eventType: TaskEventType,
  data?: RecordEventInput,
): TaskEvent {
  const now = new Date().toISOString() as IsoDateTimeString;
  eventCounter++;

  return {
    id: `evt-${eventCounter}-${Date.now()}`,
    taskId,
    eventType,
    previousStatus: data?.previousStatus ?? null,
    newStatus: data?.newStatus ?? null,
    timestamp: now,
    actorType: data?.actorType ?? 'user',
    metadata: data?.metadata ?? null,
  };
}

export function rebuildTaskStatus(events: readonly TaskEvent[]): TaskStatus {
  // Find the last status_changed event
  const statusEvents = events
    .filter((e) => e.eventType === 'status_changed' && e.newStatus !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (statusEvents.length === 0) {
    return 'captured';
  }

  return statusEvents[statusEvents.length - 1].newStatus!;
}

export function getTaskHistory(
  events: readonly TaskEvent[],
  taskId: string,
): readonly TaskEvent[] {
  return events
    .filter((e) => e.taskId === taskId)
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function getStatusDuration(
  events: readonly TaskEvent[],
  status: TaskStatus,
): number {
  const sorted = events
    .filter((e) => e.eventType === 'status_changed')
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let totalMs = 0;
  let enteredAt: number | null = null;

  for (const event of sorted) {
    if (event.newStatus === status && enteredAt === null) {
      enteredAt = new Date(event.timestamp).getTime();
    } else if (event.previousStatus === status && enteredAt !== null) {
      totalMs += new Date(event.timestamp).getTime() - enteredAt;
      enteredAt = null;
    }
  }

  // If still in that status, count until now
  if (enteredAt !== null) {
    totalMs += Date.now() - enteredAt;
  }

  return totalMs;
}
