// ---------------------------------------------------------------------------
// @orbit/agent-core – Task Sync (M7 – Wave 2-B)
// Cross-device sync for async tasks
// ---------------------------------------------------------------------------

import type { AsyncJob, TaskQueue } from './async-task-queue.js';

// ---- Types ----

export interface TaskSyncState {
  readonly deviceId: string;
  readonly checkpoint: string;
  readonly pendingJobs: readonly AsyncJob[];
  readonly completedJobIds: readonly string[];
}

// ---- Implementation ----

/** Export the current queue state for cross-device sync. */
export function exportSyncState(queue: TaskQueue, deviceId: string): TaskSyncState {
  const pending = queue.getJobsByStatus('pending');
  const running = queue.getJobsByStatus('running');
  const retrying = queue.getJobsByStatus('retrying');
  const completed = queue.getJobsByStatus('completed');
  const cancelled = queue.getJobsByStatus('cancelled');
  const failed = queue.getJobsByStatus('failed');

  const completedJobIds = [
    ...completed.map((j) => j.id),
    ...cancelled.map((j) => j.id),
    ...failed.map((j) => j.id),
  ];

  return {
    deviceId,
    checkpoint: new Date().toISOString(),
    pendingJobs: [...pending, ...running, ...retrying],
    completedJobIds,
  };
}

/** Import a remote device's sync state into the local queue. */
export function importSyncState(
  queue: TaskQueue,
  remote: TaskSyncState,
): { imported: number; conflicts: number } {
  let imported = 0;
  let conflicts = 0;

  // Cancel local jobs that the remote marks as completed
  for (const completedId of remote.completedJobIds) {
    const local = queue.getJob(completedId);
    if (local && (local.status === 'pending' || local.status === 'running')) {
      queue.cancel(completedId);
    }
  }

  // Import remote pending jobs that don't exist locally
  for (const remoteJob of remote.pendingJobs) {
    const local = queue.getJob(remoteJob.id);
    if (!local) {
      queue.enqueue(remoteJob.type, { ...remoteJob.payload } as Record<string, unknown>, {
        priority: remoteJob.priority,
        maxAttempts: remoteJob.maxAttempts,
        sessionId: remoteJob.sessionId,
        objectId: remoteJob.objectId,
      });
      imported++;
    } else {
      // Job exists locally — potential conflict
      conflicts++;
    }
  }

  return { imported, conflicts };
}
