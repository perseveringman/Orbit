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
