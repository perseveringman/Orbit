// ---------------------------------------------------------------------------
// @orbit/agent-core – Async Task Queue (M7 – Wave 2-B)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';

// ---- Types ----

export type AsyncJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';
export type AsyncJobPriority = 'low' | 'normal' | 'high' | 'critical';

export interface AsyncJob {
  readonly id: string;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: AsyncJobStatus;
  readonly priority: AsyncJobPriority;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly scheduledAt?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly lastError?: string;
  readonly result?: unknown;
  readonly sessionId?: string;
  readonly objectId?: string;
}

export interface EnqueueOptions {
  readonly priority?: AsyncJobPriority;
  readonly maxAttempts?: number;
  readonly scheduledAt?: string;
  readonly sessionId?: string;
  readonly objectId?: string;
}

export interface TaskQueue {
  enqueue(type: string, payload: Record<string, unknown>, options?: EnqueueOptions): AsyncJob;
  dequeue(): AsyncJob | null;
  cancel(jobId: string): boolean;
  retry(jobId: string): boolean;
  getJob(jobId: string): AsyncJob | null;
  getJobsByStatus(status: AsyncJobStatus): readonly AsyncJob[];
  getJobsByType(type: string): readonly AsyncJob[];
  getPendingCount(): number;
  clear(): void;
}

// Priority ordering: higher number = dequeued first
const PRIORITY_WEIGHT: Record<AsyncJobPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

// ---- Mutable job helper ----

interface MutableAsyncJob {
  id: string;
  type: string;
  payload: Readonly<Record<string, unknown>>;
  status: AsyncJobStatus;
  priority: AsyncJobPriority;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  attempt: number;
  maxAttempts: number;
  lastError?: string;
  result?: unknown;
  sessionId?: string;
  objectId?: string;
}

function freeze(job: MutableAsyncJob): AsyncJob {
  return job as AsyncJob;
}

// ---- Implementation ----

export function createTaskQueue(): TaskQueue {
  const jobs: MutableAsyncJob[] = [];
  const index = new Map<string, MutableAsyncJob>();

  function now(): string {
    return new Date().toISOString();
  }

  function enqueue(
    type: string,
    payload: Record<string, unknown>,
    options?: EnqueueOptions,
  ): AsyncJob {
    const job: MutableAsyncJob = {
      id: generateId('ajob'),
      type,
      payload: { ...payload },
      status: 'pending',
      priority: options?.priority ?? 'normal',
      createdAt: now(),
      updatedAt: now(),
      scheduledAt: options?.scheduledAt,
      attempt: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      sessionId: options?.sessionId,
      objectId: options?.objectId,
    };
    jobs.push(job);
    index.set(job.id, job);
    return freeze(job);
  }

  function dequeue(): AsyncJob | null {
    const currentTime = now();

    // Find best candidate: pending, not scheduled in the future, highest priority, then oldest
    let best: MutableAsyncJob | null = null;
    let bestIdx = -1;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (job.status !== 'pending') continue;
      if (job.scheduledAt && job.scheduledAt > currentTime) continue;

      if (
        best === null ||
        PRIORITY_WEIGHT[job.priority] > PRIORITY_WEIGHT[best.priority] ||
        (PRIORITY_WEIGHT[job.priority] === PRIORITY_WEIGHT[best.priority] &&
          job.createdAt < best.createdAt)
      ) {
        best = job;
        bestIdx = i;
      }
    }

    if (!best || bestIdx < 0) return null;

    best.status = 'running';
    best.startedAt = currentTime;
    best.updatedAt = currentTime;
    return freeze(best);
  }

  function cancel(jobId: string): boolean {
    const job = index.get(jobId);
    if (!job) return false;
    if (job.status === 'completed' || job.status === 'cancelled') return false;

    job.status = 'cancelled';
    job.updatedAt = now();
    job.completedAt = now();
    return true;
  }

  function retry(jobId: string): boolean {
    const job = index.get(jobId);
    if (!job) return false;
    if (job.status !== 'failed') return false;
    if (job.attempt >= job.maxAttempts) return false;

    job.status = 'pending';
    job.updatedAt = now();
    return true;
  }

  function getJob(jobId: string): AsyncJob | null {
    const job = index.get(jobId);
    return job ? freeze(job) : null;
  }

  function getJobsByStatus(status: AsyncJobStatus): readonly AsyncJob[] {
    return jobs.filter((j) => j.status === status).map(freeze);
  }

  function getJobsByType(type: string): readonly AsyncJob[] {
    return jobs.filter((j) => j.type === type).map(freeze);
  }

  function getPendingCount(): number {
    return jobs.filter((j) => j.status === 'pending').length;
  }

  function clear(): void {
    jobs.length = 0;
    index.clear();
  }

  return {
    enqueue,
    dequeue,
    cancel,
    retry,
    getJob,
    getJobsByStatus,
    getJobsByType,
    getPendingCount,
    clear,
  };
}
