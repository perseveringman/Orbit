// ---------------------------------------------------------------------------
// @orbit/agent-core – Agent Team barrel export
// ---------------------------------------------------------------------------

// Types
export type {
  TeamStrategy,
  TeamStatus,
  AgentTeamMember,
  AgentTeam,
  TeamTaskResult,
  TeamMemberResult,
  CreateTeamInput,
  CreateTeamMemberInput,
  TeamDecomposedTask,
  TeamExecutionPlan,
} from './types.js';

// Task Decomposer
export { createTaskDecomposer, type TeamTaskDecomposer } from './task-decomposer.js';

// Lead Agent
export { createLeadAgent, type LeadAgent, type TaskAnalysis } from './lead-agent.js';

// Team Orchestrator
export {
  createTeamOrchestrator,
  type TeamOrchestrator,
} from './team-orchestrator.js';
