// ---------------------------------------------------------------------------
// @orbit/agent-core – Agent Team types
// ---------------------------------------------------------------------------

import type { AgentOutput } from '../orchestration/agent-executor.js';

// ---- Strategy ----

export type TeamStrategy =
  | { readonly type: 'sequential' }
  | { readonly type: 'parallel' }
  | { readonly type: 'pipeline'; readonly order: readonly string[] }
  | { readonly type: 'orchestrated' };

// ---- Status ----

export type TeamStatus = 'idle' | 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed';

// ---- Team definition ----

export interface AgentTeamMember {
  readonly agentId: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly responsibility: string;
  readonly priority: number;
}

export interface AgentTeam {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly leadAgentId: string;
  readonly members: readonly AgentTeamMember[];
  readonly strategy: TeamStrategy;
  readonly status: TeamStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---- Execution results ----

export interface TeamTaskResult {
  readonly teamId: string;
  readonly task: string;
  readonly memberResults: readonly TeamMemberResult[];
  readonly summary: string;
  readonly totalTokens: number;
  readonly totalDurationMs: number;
  readonly status: 'completed' | 'partial' | 'failed';
}

export interface TeamMemberResult {
  readonly agentId: string;
  readonly roleName: string;
  readonly subtask: string;
  readonly output: AgentOutput;
  readonly status: 'completed' | 'error' | 'skipped';
}

// ---- Creation inputs ----

export interface CreateTeamInput {
  readonly name: string;
  readonly description?: string;
  readonly members: readonly CreateTeamMemberInput[];
  readonly strategy?: TeamStrategy;
}

export interface CreateTeamMemberInput {
  readonly roleId?: string;
  readonly roleName?: string;
  readonly responsibility: string;
  readonly priority?: number;
}

// ---- Task decomposition ----

export interface TeamDecomposedTask {
  readonly id: string;
  readonly description: string;
  readonly assignedAgentId: string;
  readonly assignedRoleName: string;
  readonly dependsOn: readonly string[];
  readonly priority: number;
  readonly context?: string;
}

export interface TeamExecutionPlan {
  readonly teamId: string;
  readonly goal: string;
  readonly tasks: readonly TeamDecomposedTask[];
  readonly strategy: TeamStrategy;
  readonly estimatedSteps: number;
}
