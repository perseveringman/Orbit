// ---------------------------------------------------------------------------
// @orbit/agent-core – Task Queue (M7)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';

// ---- Types ----

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface TaskRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priority: TaskPriority;
  status: TaskStatus;
  readonly createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
  progress: number;
  readonly metadata: Record<string, unknown>;
}

export interface TaskHandler {
  (
    task: TaskRecord,
    signal: AbortSignal,
    onProgress: (progress: number, message?: string) => void,
  ): Promise<string>;
}

// Priority ordering: higher number = higher priority
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

// ---- TaskQueue ----

export class TaskQueue {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly handlers = new Map<string, TaskHandler>();
  private readonly running = new Map<string, AbortController>();
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /** Register a named task handler. */
  registerHandler(name: string, handler: TaskHandler): void {
    this.handlers.set(name, handler);
  }

  /** Submit a task for execution. Returns the created TaskRecord. */
  submit(
    name: string,
    description: string,
    options?: { priority?: TaskPriority; metadata?: Record<string, unknown> },
  ): TaskRecord {
    const task: TaskRecord = {
      id: generateId('task'),
      name,
      description,
      priority: options?.priority ?? 'normal',
      status: 'pending',
      createdAt: Date.now(),
      progress: 0,
      metadata: { ...options?.metadata },
    };
    this.tasks.set(task.id, task);
    return task;
  }

  /** Process the next pending task (highest priority first). */
  async processNext(): Promise<TaskRecord | undefined> {
    if (this.running.size >= this.maxConcurrent) return undefined;

    const pending = this.getPendingByPriority();
    if (pending.length === 0) return undefined;

    const task = pending[0]!;
    const handler = this.handlers.get(task.name);
    if (!handler) {
      task.status = 'failed';
      task.error = `No handler registered for task "${task.name}"`;
      task.completedAt = Date.now();
      return task;
    }

    const controller = new AbortController();
    this.running.set(task.id, controller);

    task.status = 'running';
    task.startedAt = Date.now();

    const onProgress = (progress: number, _message?: string): void => {
      task.progress = Math.max(0, Math.min(1, progress));
    };

    try {
      const result = await handler(task, controller.signal, onProgress);
      // Guard against cancellation that occurred during execution
      if (this.isCancelled(task)) return task;
      task.status = 'completed';
      task.result = result;
      task.progress = 1;
      task.completedAt = Date.now();
    } catch (err: unknown) {
      if (this.isCancelled(task)) return task;
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : String(err);
      task.completedAt = Date.now();
    } finally {
      this.running.delete(task.id);
    }

    return task;
  }

  /** Cancel a running or pending task. */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (task.status !== 'pending' && task.status !== 'running') return false;

    task.status = 'cancelled';
    task.completedAt = Date.now();

    const controller = this.running.get(taskId);
    if (controller) {
      controller.abort();
      this.running.delete(taskId);
    }

    return true;
  }

  /** Get a task by id. */
  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  /** List tasks, optionally filtered by status. */
  list(filter?: { status?: TaskStatus; limit?: number }): readonly TaskRecord[] {
    let result = [...this.tasks.values()];

    if (filter?.status) {
      result = result.filter((t) => t.status === filter.status);
    }

    // Sort by creation time (newest first)
    result.sort((a, b) => b.createdAt - a.createdAt);

    if (filter?.limit !== undefined && filter.limit >= 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /** Get queue statistics. */
  getStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const stats = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const task of this.tasks.values()) {
      stats[task.status]++;
    }
    return stats;
  }

  /** Clear completed, failed, and cancelled tasks. Returns count removed. */
  cleanup(): number {
    let removed = 0;
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        this.tasks.delete(id);
        removed++;
      }
    }
    return removed;
  }

  // ---- Private helpers ----

  private getPendingByPriority(): TaskRecord[] {
    const pending: TaskRecord[] = [];
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') pending.push(task);
    }
    pending.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
    return pending;
  }

  /** Check if a task was cancelled externally while running. */
  private isCancelled(task: TaskRecord): boolean {
    return (task as { status: string }).status === 'cancelled';
  }
}
