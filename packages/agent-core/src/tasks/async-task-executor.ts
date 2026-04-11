// ---------------------------------------------------------------------------
// @orbit/agent-core – Async Task Executor (M7 – Wave 2-B)
// ---------------------------------------------------------------------------

import type { AsyncJob, TaskQueue } from './async-task-queue.js';

// ---- Types ----

export type TaskHandler = (job: AsyncJob) => Promise<unknown>;

export interface TaskExecutorOptions {
  readonly pollIntervalMs?: number;
}

export interface TaskExecutor {
  registerHandler(type: string, handler: TaskHandler): void;
  start(): void;
  stop(): void;
  isRunning(): boolean;
  getActiveJob(): AsyncJob | null;
}

// ---- Implementation ----

export function createTaskExecutor(
  queue: TaskQueue,
  options?: TaskExecutorOptions,
): TaskExecutor {
  const handlers = new Map<string, TaskHandler>();
  let running = false;
  let activeJob: AsyncJob | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pollInterval = options?.pollIntervalMs ?? 500;

  function registerHandler(type: string, handler: TaskHandler): void {
    handlers.set(type, handler);
  }

  async function processOne(): Promise<void> {
    const job = queue.dequeue();
    if (!job) return;

    const handler = handlers.get(job.type);
    if (!handler) {
      // No handler — mark failed via the queue's internal state
      // We access the job from the queue to mutate status
      const mutable = queue.getJob(job.id);
      if (mutable) {
        queue.cancel(job.id);
      }
      return;
    }

    activeJob = job;
    try {
      const result = await handler(job);
      // Mark completed: update via internal reference
      const ref = queue.getJob(job.id);
      if (ref && ref.status === 'running') {
        // Use object mutation through the queue's backing store
        const backing = findBacking(job.id);
        if (backing) {
          backing.status = 'completed';
          backing.result = result;
          backing.completedAt = new Date().toISOString();
          backing.updatedAt = new Date().toISOString();
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const backing = findBacking(job.id);
      if (backing) {
        backing.attempt += 1;
        backing.lastError = errorMessage;
        backing.updatedAt = new Date().toISOString();

        if (backing.attempt < backing.maxAttempts) {
          // Re-enqueue with backoff: schedule in the future
          const backoffMs = Math.min(1000 * Math.pow(2, backing.attempt), 60_000);
          backing.status = 'retrying';
          backing.scheduledAt = new Date(Date.now() + backoffMs).toISOString();
          // After marking retrying, flip back to pending so dequeue picks it up after scheduledAt
          backing.status = 'pending';
        } else {
          backing.status = 'failed';
          backing.completedAt = new Date().toISOString();
        }
      }
    } finally {
      activeJob = null;
    }
  }

  interface MutableJob {
    status: string;
    result?: unknown;
    completedAt?: string;
    updatedAt?: string;
    attempt: number;
    lastError?: string;
    scheduledAt?: string;
    maxAttempts: number;
  }

  // The queue's getJob returns the same backing object as a readonly view.
  function findBacking(jobId: string): MutableJob | null {
    const job = queue.getJob(jobId);
    return job as unknown as MutableJob | null;
  }

  function poll(): void {
    if (!running) return;

    void processOne().finally(() => {
      if (running) {
        timer = setTimeout(poll, pollInterval);
      }
    });
  }

  function start(): void {
    if (running) return;
    running = true;
    timer = setTimeout(poll, 0);
  }

  function stop(): void {
    running = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function isRunning(): boolean {
    return running;
  }

  function getActiveJob(): AsyncJob | null {
    return activeJob;
  }

  return {
    registerHandler,
    start,
    stop,
    isRunning,
    getActiveJob,
  };
}
