// ---------------------------------------------------------------------------
// @orbit/agent-core – Async Task Scheduler (M7 – Wave 2-B)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { AsyncJob, TaskQueue } from './async-task-queue.js';

// ---- Types ----

export interface ScheduledCronTask {
  readonly id: string;
  readonly type: string;
  readonly cronExpression: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly enabled: boolean;
  readonly lastRunAt?: string;
  readonly nextRunAt?: string;
}

export interface TaskCronScheduler {
  schedule(
    task: Omit<ScheduledCronTask, 'id' | 'lastRunAt' | 'nextRunAt'>,
  ): ScheduledCronTask;
  unschedule(taskId: string): boolean;
  enable(taskId: string): boolean;
  disable(taskId: string): boolean;
  getScheduled(): readonly ScheduledCronTask[];
  tick(now: string): readonly AsyncJob[];
}

// ---- Cron helpers ----

/** Parse simple cron expressions and return interval in minutes. */
function parseIntervalMinutes(expr: string): number | null {
  switch (expr) {
    case '@hourly':
      return 60;
    case '@daily':
      return 60 * 24;
    case '@weekly':
      return 60 * 24 * 7;
    default: {
      const match = /^@every:(\d+)m$/.exec(expr);
      if (match) return parseInt(match[1], 10);
      return null;
    }
  }
}

/** Check if a scheduled task should fire at the given time. */
function shouldFire(task: MutableScheduledCronTask, nowMs: number): boolean {
  if (!task.enabled) return false;

  const interval = parseIntervalMinutes(task.cronExpression);
  if (interval === null) return false;

  const intervalMs = interval * 60_000;

  if (!task.nextRunAt) {
    // First run: fire after one interval from creation
    return true;
  }

  const nextMs = new Date(task.nextRunAt).getTime();
  return nowMs >= nextMs;
}

function computeNextRun(expr: string, fromMs: number): string {
  const interval = parseIntervalMinutes(expr);
  if (interval === null) return new Date(fromMs).toISOString();
  return new Date(fromMs + interval * 60_000).toISOString();
}

// ---- Mutable type ----

interface MutableScheduledCronTask {
  id: string;
  type: string;
  cronExpression: string;
  payload: Readonly<Record<string, unknown>>;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

function freeze(t: MutableScheduledCronTask): ScheduledCronTask {
  return t as ScheduledCronTask;
}

// ---- Implementation ----

export function createTaskCronScheduler(queue: TaskQueue): TaskCronScheduler {
  const tasks = new Map<string, MutableScheduledCronTask>();

  function schedule(
    input: Omit<ScheduledCronTask, 'id' | 'lastRunAt' | 'nextRunAt'>,
  ): ScheduledCronTask {
    const id = generateId('cron');
    const nowMs = Date.now();
    const task: MutableScheduledCronTask = {
      id,
      type: input.type,
      cronExpression: input.cronExpression,
      payload: { ...input.payload },
      enabled: input.enabled,
      nextRunAt: computeNextRun(input.cronExpression, nowMs),
    };
    tasks.set(id, task);
    return freeze(task);
  }

  function unschedule(taskId: string): boolean {
    return tasks.delete(taskId);
  }

  function enable(taskId: string): boolean {
    const task = tasks.get(taskId);
    if (!task) return false;
    if (task.enabled) return false;
    task.enabled = true;
    if (!task.nextRunAt) {
      task.nextRunAt = computeNextRun(task.cronExpression, Date.now());
    }
    return true;
  }

  function disable(taskId: string): boolean {
    const task = tasks.get(taskId);
    if (!task) return false;
    if (!task.enabled) return false;
    task.enabled = false;
    return true;
  }

  function getScheduled(): readonly ScheduledCronTask[] {
    return [...tasks.values()].map(freeze);
  }

  function tick(now: string): readonly AsyncJob[] {
    const nowMs = new Date(now).getTime();
    const enqueued: AsyncJob[] = [];

    for (const task of tasks.values()) {
      if (shouldFire(task, nowMs)) {
        const job = queue.enqueue(task.type, { ...task.payload } as Record<string, unknown>);
        task.lastRunAt = now;
        task.nextRunAt = computeNextRun(task.cronExpression, nowMs);
        enqueued.push(job);
      }
    }

    return enqueued;
  }

  return {
    schedule,
    unschedule,
    enable,
    disable,
    getScheduled,
    tick,
  };
}
