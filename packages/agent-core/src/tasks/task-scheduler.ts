// ---------------------------------------------------------------------------
// @orbit/agent-core – Task Scheduler (M7)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { TaskQueue } from './task-queue.js';

// ---- Types ----

export interface ScheduledTask {
  readonly id: string;
  readonly taskName: string;
  readonly description: string;
  readonly intervalMs?: number;
  readonly delayMs?: number;
  readonly maxRuns?: number;
  runCount: number;
  readonly createdAt: number;
  nextRunAt: number;
  active: boolean;
}

// ---- TaskScheduler ----

export class TaskScheduler {
  private readonly scheduled = new Map<string, ScheduledTask>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly taskQueue: TaskQueue;

  constructor(taskQueue: TaskQueue) {
    this.taskQueue = taskQueue;
  }

  /** Schedule a periodic task that repeats at the given interval. */
  scheduleInterval(
    taskName: string,
    description: string,
    intervalMs: number,
    maxRuns?: number,
  ): ScheduledTask {
    const now = Date.now();
    const task: ScheduledTask = {
      id: generateId('sched'),
      taskName,
      description,
      intervalMs,
      maxRuns,
      runCount: 0,
      createdAt: now,
      nextRunAt: now + intervalMs,
      active: true,
    };
    this.scheduled.set(task.id, task);
    this.startTimer(task);
    return task;
  }

  /** Schedule a one-shot delayed task. */
  scheduleDelay(taskName: string, description: string, delayMs: number): ScheduledTask {
    const now = Date.now();
    const task: ScheduledTask = {
      id: generateId('sched'),
      taskName,
      description,
      delayMs,
      maxRuns: 1,
      runCount: 0,
      createdAt: now,
      nextRunAt: now + delayMs,
      active: true,
    };
    this.scheduled.set(task.id, task);
    this.startTimer(task);
    return task;
  }

  /** Cancel a scheduled task. */
  cancel(id: string): boolean {
    const task = this.scheduled.get(id);
    if (!task) return false;

    task.active = false;
    this.clearTimer(id);
    return true;
  }

  /** Pause a scheduled task. */
  pause(id: string): boolean {
    const task = this.scheduled.get(id);
    if (!task || !task.active) return false;

    task.active = false;
    this.clearTimer(id);
    return true;
  }

  /** Resume a paused scheduled task. */
  resume(id: string): boolean {
    const task = this.scheduled.get(id);
    if (!task || task.active) return false;

    // Check if maxRuns has been reached
    if (task.maxRuns !== undefined && task.runCount >= task.maxRuns) return false;

    task.active = true;
    const now = Date.now();
    if (task.nextRunAt <= now) {
      task.nextRunAt = now + (task.intervalMs ?? task.delayMs ?? 0);
    }
    this.startTimer(task);
    return true;
  }

  /** List all scheduled tasks. */
  list(): readonly ScheduledTask[] {
    return [...this.scheduled.values()];
  }

  /**
   * Tick: check for due tasks and submit them to the queue.
   * Returns IDs of tasks that were submitted.
   */
  tick(): readonly string[] {
    const now = Date.now();
    const submitted: string[] = [];

    for (const task of this.scheduled.values()) {
      if (!task.active) continue;
      if (task.nextRunAt > now) continue;

      // Max runs check
      if (task.maxRuns !== undefined && task.runCount >= task.maxRuns) {
        task.active = false;
        this.clearTimer(task.id);
        continue;
      }

      // Submit to queue
      this.taskQueue.submit(task.taskName, task.description);
      task.runCount++;
      submitted.push(task.id);

      // Update next run or deactivate
      if (task.intervalMs && (task.maxRuns === undefined || task.runCount < task.maxRuns)) {
        task.nextRunAt = now + task.intervalMs;
        this.clearTimer(task.id);
        this.startTimer(task);
      } else {
        task.active = false;
        this.clearTimer(task.id);
      }
    }

    return submitted;
  }

  /** Stop all scheduled tasks and clear timers. */
  stopAll(): void {
    for (const [id, task] of this.scheduled) {
      task.active = false;
      this.clearTimer(id);
    }
  }

  // ---- Private helpers ----

  private startTimer(task: ScheduledTask): void {
    const delay = Math.max(0, task.nextRunAt - Date.now());
    const timer = setTimeout(() => {
      this.tick();
    }, delay);
    this.timers.set(task.id, timer);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
