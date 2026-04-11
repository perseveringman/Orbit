// ---------------------------------------------------------------------------
// @orbit/agent-core – Orchestration barrel export (M6)
// ---------------------------------------------------------------------------

export {
  AgentExecutor,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentOutputStatus,
} from './agent-executor.js';

export {
  TaskPlanner,
  type TaskPlan,
  type Subtask,
  type SubtaskResult,
  type ExecutionStrategy,
} from './task-planner.js';

export {
  MultiAgentOrchestrator,
  type MultiAgentConfig,
  type OrchestratorState,
  type PlanExecutionResult,
} from './multi-agent-orchestrator.js';
