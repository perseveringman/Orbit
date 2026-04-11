// ---------------------------------------------------------------------------
// @orbit/agent-core – Tasks barrel export (M7)
// ---------------------------------------------------------------------------

export {
  TaskQueue,
  type TaskRecord,
  type TaskHandler,
  type TaskStatus,
  type TaskPriority,
} from './task-queue.js';

export {
  AGENT_PROFILES,
  getProfile,
  matchProfile,
  profileToAgentConfig,
  type AgentProfile,
} from './agent-profiles.js';

export {
  TaskScheduler,
  type ScheduledTask,
} from './task-scheduler.js';

// Async Task Framework (Wave 2-B)
export {
  createTaskQueue,
  type AsyncJob,
  type AsyncJobStatus,
  type AsyncJobPriority,
  type TaskQueue as AsyncTaskQueue,
  type EnqueueOptions,
} from './async-task-queue.js';

export {
  createTaskExecutor,
  type TaskExecutor,
  type TaskHandler as AsyncTaskHandler,
  type TaskExecutorOptions,
} from './async-task-executor.js';

export {
  createTaskCronScheduler,
  type TaskCronScheduler,
  type ScheduledCronTask,
} from './async-task-scheduler.js';

export {
  exportSyncState,
  importSyncState,
  type TaskSyncState,
} from './task-sync.js';
