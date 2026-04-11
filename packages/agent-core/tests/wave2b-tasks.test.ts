import { describe, expect, it, beforeEach } from 'vitest';

import {
  createTaskQueue,
  createTaskExecutor,
  createTaskCronScheduler,
  exportSyncState,
  importSyncState,
} from '../src/tasks/index.js';

import type {
  AsyncTaskQueue,
  TaskExecutor,
  TaskCronScheduler,
} from '../src/tasks/index.js';

// ===========================================================================
// Async Task Queue
// ===========================================================================

describe('AsyncTaskQueue (createTaskQueue)', () => {
  let queue: AsyncTaskQueue;

  beforeEach(() => {
    queue = createTaskQueue();
  });

  it('enqueue creates a pending job with defaults', () => {
    const job = queue.enqueue('email', { to: 'a@b.com' });
    expect(job.id).toContain('ajob_');
    expect(job.type).toBe('email');
    expect(job.status).toBe('pending');
    expect(job.priority).toBe('normal');
    expect(job.attempt).toBe(0);
    expect(job.maxAttempts).toBe(3);
    expect(job.payload).toEqual({ to: 'a@b.com' });
  });

  it('enqueue respects custom options', () => {
    const job = queue.enqueue('sync', {}, {
      priority: 'critical',
      maxAttempts: 5,
      sessionId: 's1',
      objectId: 'o1',
    });
    expect(job.priority).toBe('critical');
    expect(job.maxAttempts).toBe(5);
    expect(job.sessionId).toBe('s1');
    expect(job.objectId).toBe('o1');
  });

  it('dequeue returns highest priority job first', () => {
    queue.enqueue('low', {}, { priority: 'low' });
    queue.enqueue('critical', {}, { priority: 'critical' });
    queue.enqueue('normal', {}, { priority: 'normal' });

    const job = queue.dequeue();
    expect(job).not.toBeNull();
    expect(job!.type).toBe('critical');
    expect(job!.status).toBe('running');
  });

  it('dequeue returns oldest job among same priority', () => {
    const first = queue.enqueue('a', {}, { priority: 'normal' });
    queue.enqueue('b', {}, { priority: 'normal' });

    const job = queue.dequeue();
    expect(job!.id).toBe(first.id);
  });

  it('dequeue returns null when no pending jobs', () => {
    expect(queue.dequeue()).toBeNull();
  });

  it('dequeue skips future-scheduled jobs', () => {
    const futureDate = new Date(Date.now() + 60_000_000).toISOString();
    queue.enqueue('future', {}, { scheduledAt: futureDate });
    queue.enqueue('now', {});

    const job = queue.dequeue();
    expect(job!.type).toBe('now');
  });

  it('cancel marks job as cancelled', () => {
    const job = queue.enqueue('test', {});
    expect(queue.cancel(job.id)).toBe(true);
    const updated = queue.getJob(job.id);
    expect(updated!.status).toBe('cancelled');
  });

  it('cancel returns false for already completed job', () => {
    const job = queue.enqueue('test', {});
    queue.cancel(job.id);
    expect(queue.cancel(job.id)).toBe(false); // already cancelled
  });

  it('cancel returns false for unknown id', () => {
    expect(queue.cancel('nonexistent')).toBe(false);
  });

  it('retry moves a failed job back to pending', () => {
    const job = queue.enqueue('test', {});
    // Simulate failure by dequeue → internal status change
    queue.dequeue();
    // Manually set status to failed via the backing ref
    const ref = queue.getJob(job.id) as Record<string, unknown>;
    ref['status'] = 'failed';
    ref['attempt'] = 1;

    expect(queue.retry(job.id)).toBe(true);
    expect(queue.getJob(job.id)!.status).toBe('pending');
  });

  it('retry returns false if attempts exhausted', () => {
    const job = queue.enqueue('test', {}, { maxAttempts: 1 });
    queue.dequeue();
    const ref = queue.getJob(job.id) as Record<string, unknown>;
    ref['status'] = 'failed';
    ref['attempt'] = 1;

    expect(queue.retry(job.id)).toBe(false);
  });

  it('getJob returns null for unknown id', () => {
    expect(queue.getJob('nope')).toBeNull();
  });

  it('getJobsByStatus filters correctly', () => {
    queue.enqueue('a', {});
    queue.enqueue('b', {});
    queue.dequeue(); // moves one to running

    expect(queue.getJobsByStatus('pending')).toHaveLength(1);
    expect(queue.getJobsByStatus('running')).toHaveLength(1);
  });

  it('getJobsByType filters correctly', () => {
    queue.enqueue('email', {});
    queue.enqueue('email', {});
    queue.enqueue('sync', {});

    expect(queue.getJobsByType('email')).toHaveLength(2);
    expect(queue.getJobsByType('sync')).toHaveLength(1);
  });

  it('getPendingCount returns correct count', () => {
    queue.enqueue('a', {});
    queue.enqueue('b', {});
    expect(queue.getPendingCount()).toBe(2);

    queue.dequeue();
    expect(queue.getPendingCount()).toBe(1);
  });

  it('clear removes all jobs', () => {
    queue.enqueue('a', {});
    queue.enqueue('b', {});
    queue.clear();
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.dequeue()).toBeNull();
  });
});

// ===========================================================================
// Async Task Executor
// ===========================================================================

describe('TaskExecutor (createTaskExecutor)', () => {
  let queue: AsyncTaskQueue;
  let executor: TaskExecutor;

  beforeEach(() => {
    queue = createTaskQueue();
    executor = createTaskExecutor(queue, { pollIntervalMs: 10 });
  });

  it('starts and stops', () => {
    expect(executor.isRunning()).toBe(false);
    executor.start();
    expect(executor.isRunning()).toBe(true);
    executor.stop();
    expect(executor.isRunning()).toBe(false);
  });

  it('getActiveJob returns null when idle', () => {
    expect(executor.getActiveJob()).toBeNull();
  });

  it('registerHandler accepts handlers', () => {
    // Should not throw
    executor.registerHandler('test', async () => 'ok');
  });
});

// ===========================================================================
// Task Cron Scheduler
// ===========================================================================

describe('TaskCronScheduler (createTaskCronScheduler)', () => {
  let queue: AsyncTaskQueue;
  let scheduler: TaskCronScheduler;

  beforeEach(() => {
    queue = createTaskQueue();
    scheduler = createTaskCronScheduler(queue);
  });

  it('schedule creates a scheduled task', () => {
    const task = scheduler.schedule({
      type: 'cleanup',
      cronExpression: '@hourly',
      payload: {},
      enabled: true,
    });
    expect(task.id).toContain('cron_');
    expect(task.type).toBe('cleanup');
    expect(task.enabled).toBe(true);
    expect(task.nextRunAt).toBeDefined();
  });

  it('unschedule removes a task', () => {
    const task = scheduler.schedule({
      type: 'test',
      cronExpression: '@daily',
      payload: {},
      enabled: true,
    });
    expect(scheduler.unschedule(task.id)).toBe(true);
    expect(scheduler.getScheduled()).toHaveLength(0);
  });

  it('unschedule returns false for unknown id', () => {
    expect(scheduler.unschedule('nope')).toBe(false);
  });

  it('enable/disable toggles task state', () => {
    const task = scheduler.schedule({
      type: 'test',
      cronExpression: '@daily',
      payload: {},
      enabled: false,
    });
    expect(scheduler.enable(task.id)).toBe(true);
    expect(scheduler.getScheduled()[0].enabled).toBe(true);

    expect(scheduler.disable(task.id)).toBe(true);
    expect(scheduler.getScheduled()[0].enabled).toBe(false);
  });

  it('enable returns false if already enabled', () => {
    const task = scheduler.schedule({
      type: 'test',
      cronExpression: '@daily',
      payload: {},
      enabled: true,
    });
    expect(scheduler.enable(task.id)).toBe(false);
  });

  it('disable returns false if already disabled', () => {
    const task = scheduler.schedule({
      type: 'test',
      cronExpression: '@daily',
      payload: {},
      enabled: false,
    });
    expect(scheduler.disable(task.id)).toBe(false);
  });

  it('tick fires enabled tasks when due', () => {
    scheduler.schedule({
      type: 'hourly-job',
      cronExpression: '@every:5m',
      payload: { key: 'val' },
      enabled: true,
    });

    // Tick far in the future to ensure the task fires
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    const jobs = scheduler.tick(future);
    expect(jobs.length).toBe(1);
    expect(jobs[0].type).toBe('hourly-job');
    expect(queue.getPendingCount()).toBe(1);
  });

  it('tick does not fire disabled tasks', () => {
    scheduler.schedule({
      type: 'disabled-job',
      cronExpression: '@every:5m',
      payload: {},
      enabled: false,
    });

    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    const jobs = scheduler.tick(future);
    expect(jobs).toHaveLength(0);
  });

  it('tick updates lastRunAt and nextRunAt', () => {
    scheduler.schedule({
      type: 'tracked',
      cronExpression: '@hourly',
      payload: {},
      enabled: true,
    });

    const future = new Date(Date.now() + 120 * 60_000).toISOString();
    scheduler.tick(future);

    const tasks = scheduler.getScheduled();
    expect(tasks[0].lastRunAt).toBe(future);
    expect(tasks[0].nextRunAt).toBeDefined();
  });

  it('getScheduled returns all tasks', () => {
    scheduler.schedule({ type: 'a', cronExpression: '@daily', payload: {}, enabled: true });
    scheduler.schedule({ type: 'b', cronExpression: '@weekly', payload: {}, enabled: false });
    expect(scheduler.getScheduled()).toHaveLength(2);
  });

  it('supports @every:Xm cron pattern', () => {
    scheduler.schedule({
      type: 'frequent',
      cronExpression: '@every:10m',
      payload: {},
      enabled: true,
    });

    // 11 minutes in the future should trigger
    const future = new Date(Date.now() + 11 * 60_000).toISOString();
    const jobs = scheduler.tick(future);
    expect(jobs).toHaveLength(1);
  });
});

// ===========================================================================
// Task Sync
// ===========================================================================

describe('Task Sync (exportSyncState / importSyncState)', () => {
  it('exportSyncState captures queue state', () => {
    const queue = createTaskQueue();
    queue.enqueue('a', {});
    queue.enqueue('b', {});

    const state = exportSyncState(queue, 'device-1');
    expect(state.deviceId).toBe('device-1');
    expect(state.checkpoint).toBeTruthy();
    expect(state.pendingJobs).toHaveLength(2);
    expect(state.completedJobIds).toHaveLength(0);
  });

  it('exportSyncState includes completed job ids', () => {
    const queue = createTaskQueue();
    const job = queue.enqueue('a', {});
    queue.dequeue();
    // Mark completed
    const ref = queue.getJob(job.id) as Record<string, unknown>;
    ref['status'] = 'completed';

    const state = exportSyncState(queue, 'device-1');
    expect(state.completedJobIds).toContain(job.id);
  });

  it('importSyncState imports remote pending jobs', () => {
    const localQueue = createTaskQueue();
    const remoteQueue = createTaskQueue();
    remoteQueue.enqueue('remote-task', { data: 1 });

    const remoteState = exportSyncState(remoteQueue, 'device-2');
    const result = importSyncState(localQueue, remoteState);

    expect(result.imported).toBe(1);
    expect(result.conflicts).toBe(0);
  });

  it('importSyncState detects conflicts for existing jobs', () => {
    const queue = createTaskQueue();
    const job = queue.enqueue('shared', {});

    // Create a sync state referencing the same job
    const syncState = {
      deviceId: 'device-2',
      checkpoint: new Date().toISOString(),
      pendingJobs: [job],
      completedJobIds: [],
    };

    const result = importSyncState(queue, syncState);
    expect(result.conflicts).toBe(1);
    expect(result.imported).toBe(0);
  });
});
