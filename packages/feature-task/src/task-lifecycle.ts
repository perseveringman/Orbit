import type { Task, TaskStatus, IsoDateTimeString } from '@orbit/domain';
import type { ActorType } from '@orbit/domain';

// ── Status order ───────────────────────────────────────────

export const TASK_STATUS_ORDER: readonly TaskStatus[] = [
  'captured',
  'clarifying',
  'ready',
  'scheduled',
  'focused',
  'done',
  'blocked',
  'dropped',
] as const;

// ── Transition types ───────────────────────────────────────

export interface TaskTransition {
  readonly from: TaskStatus;
  readonly to: TaskStatus;
  readonly trigger: string;
  readonly timestamp: IsoDateTimeString;
  readonly actorType: ActorType;
}

// ── Valid transitions map ──────────────────────────────────

export const VALID_TRANSITIONS: ReadonlyMap<TaskStatus, readonly TaskStatus[]> = new Map<TaskStatus, readonly TaskStatus[]>([
  ['captured', ['clarifying', 'ready', 'dropped']],
  ['clarifying', ['ready', 'dropped']],
  ['ready', ['scheduled', 'blocked', 'dropped']],
  ['scheduled', ['focused', 'ready', 'blocked', 'dropped']],
  ['focused', ['done', 'blocked', 'dropped', 'ready']],
  ['done', []],
  ['blocked', ['ready', 'dropped']],
  ['dropped', ['captured']],
]);

// ── Functions ──────────────────────────────────────────────

export function canTransition(current: TaskStatus, target: TaskStatus): boolean {
  const allowed = VALID_TRANSITIONS.get(current);
  return allowed !== undefined && allowed.includes(target);
}

export function getValidNextStatuses(current: TaskStatus): readonly TaskStatus[] {
  return VALID_TRANSITIONS.get(current) ?? [];
}

export function transitionTask(
  task: Task,
  targetStatus: TaskStatus,
  trigger?: string,
): { readonly task: Task; readonly transition: TaskTransition } {
  if (!canTransition(task.status, targetStatus)) {
    throw new Error(
      `Invalid transition: cannot move from '${task.status}' to '${targetStatus}'`,
    );
  }

  const now = new Date().toISOString() as IsoDateTimeString;

  const updatedTask: Task = {
    ...task,
    status: targetStatus,
    updatedAt: now,
    completedAt: targetStatus === 'done' ? now : task.completedAt,
  };

  const transition: TaskTransition = {
    from: task.status,
    to: targetStatus,
    trigger: trigger ?? `${task.status}_to_${targetStatus}`,
    timestamp: now,
    actorType: 'user',
  };

  return { task: updatedTask, transition };
}
