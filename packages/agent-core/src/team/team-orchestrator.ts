// ---------------------------------------------------------------------------
// @orbit/agent-core – Team Orchestrator
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { LLMAdapter } from '../llm-adapter.js';
import type { RoleRegistry, ResolvedAgentConfig } from '../roles/types.js';
import {
  AgentExecutor,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
} from '../orchestration/agent-executor.js';
import type {
  AgentTeam,
  AgentTeamMember,
  CreateTeamInput,
  CreateTeamMemberInput,
  TeamDecomposedTask,
  TeamExecutionPlan,
  TeamMemberResult,
  TeamStatus,
  TeamStrategy,
  TeamTaskResult,
} from './types.js';
import { createLeadAgent, type LeadAgent } from './lead-agent.js';
import { createTaskDecomposer, type TeamTaskDecomposer } from './task-decomposer.js';

// ---- Tool registry shape (matches AgentExecutor constructor) ----

type ToolRegistryLike = {
  dispatch?(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ success: boolean; output: string; error?: string }>;
} | null;

// ---- Public interface ----

export interface TeamOrchestrator {
  createTeam(input: CreateTeamInput): AgentTeam;
  createTeamFromTask(task: string, roleRegistry: RoleRegistry): AgentTeam;
  addMember(teamId: string, member: CreateTeamMemberInput): AgentTeam | undefined;
  removeMember(teamId: string, agentId: string): AgentTeam | undefined;
  getTeam(teamId: string): AgentTeam | undefined;
  listTeams(): readonly AgentTeam[];
  deleteTeam(teamId: string): boolean;
  executeTeamTask(
    teamId: string,
    task: string,
    llm: LLMAdapter,
    toolRegistry: ToolRegistryLike,
    roleRegistry?: RoleRegistry,
  ): Promise<TeamTaskResult>;
  getTeamStatus(teamId: string): TeamStatus;
}

// ---- Implementation ----

class TeamOrchestratorImpl implements TeamOrchestrator {
  private readonly teams = new Map<string, AgentTeam>();
  private readonly leadAgent: LeadAgent;
  private readonly decomposer: TeamTaskDecomposer;

  constructor() {
    this.leadAgent = createLeadAgent();
    this.decomposer = createTaskDecomposer();
  }

  createTeam(input: CreateTeamInput): AgentTeam {
    const now = new Date().toISOString();
    const teamId = generateId('team');

    const members: AgentTeamMember[] = input.members.map((m, idx) => ({
      agentId: generateId('agent'),
      roleId: m.roleId ?? '',
      roleName: m.roleName ?? 'agent',
      responsibility: m.responsibility,
      priority: m.priority ?? input.members.length - idx,
    }));

    const leadAgentId = members.length > 0
      ? members.reduce((best, m) => (m.priority > best.priority ? m : best), members[0]).agentId
      : '';

    const team: AgentTeam = {
      id: teamId,
      name: input.name,
      description: input.description ?? '',
      leadAgentId,
      members,
      strategy: input.strategy ?? { type: 'sequential' },
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };

    this.teams.set(teamId, team);
    return team;
  }

  createTeamFromTask(task: string, roleRegistry: RoleRegistry): AgentTeam {
    const teamInput = this.leadAgent.assembleTeam(task, roleRegistry);
    return this.createTeam(teamInput);
  }

  addMember(teamId: string, member: CreateTeamMemberInput): AgentTeam | undefined {
    const team = this.teams.get(teamId);
    if (!team) return undefined;

    const newMember: AgentTeamMember = {
      agentId: generateId('agent'),
      roleId: member.roleId ?? '',
      roleName: member.roleName ?? 'agent',
      responsibility: member.responsibility,
      priority: member.priority ?? 0,
    };

    const updated: AgentTeam = {
      ...team,
      members: [...team.members, newMember],
      updatedAt: new Date().toISOString(),
    };

    this.teams.set(teamId, updated);
    return updated;
  }

  removeMember(teamId: string, agentId: string): AgentTeam | undefined {
    const team = this.teams.get(teamId);
    if (!team) return undefined;

    const filtered = team.members.filter((m) => m.agentId !== agentId);
    if (filtered.length === team.members.length) return undefined;

    const newLead =
      team.leadAgentId === agentId && filtered.length > 0
        ? filtered.reduce((best, m) => (m.priority > best.priority ? m : best), filtered[0]).agentId
        : team.leadAgentId;

    const updated: AgentTeam = {
      ...team,
      members: filtered,
      leadAgentId: newLead,
      updatedAt: new Date().toISOString(),
    };

    this.teams.set(teamId, updated);
    return updated;
  }

  getTeam(teamId: string): AgentTeam | undefined {
    return this.teams.get(teamId);
  }

  listTeams(): readonly AgentTeam[] {
    return [...this.teams.values()];
  }

  deleteTeam(teamId: string): boolean {
    return this.teams.delete(teamId);
  }

  async executeTeamTask(
    teamId: string,
    task: string,
    llm: LLMAdapter,
    toolRegistry: ToolRegistryLike,
    roleRegistry?: RoleRegistry,
  ): Promise<TeamTaskResult> {
    const team = this.teams.get(teamId);
    if (!team) {
      return {
        teamId,
        task,
        memberResults: [],
        summary: 'Team not found.',
        totalTokens: 0,
        totalDurationMs: 0,
        status: 'failed',
      };
    }

    if (team.members.length === 0) {
      return {
        teamId,
        task,
        memberResults: [],
        summary: 'Team has no members.',
        totalTokens: 0,
        totalDurationMs: 0,
        status: 'failed',
      };
    }

    // planning
    this.updateStatus(teamId, 'planning');

    const plan = roleRegistry
      ? this.decomposer.decompose(task, team.members, roleRegistry)
      : this.buildSimplePlan(task, team);

    const resolvedPlan: TeamExecutionPlan = { ...plan, teamId };

    // executing
    this.updateStatus(teamId, 'executing');

    const startTime = Date.now();
    let memberResults: TeamMemberResult[];

    try {
      switch (resolvedPlan.strategy.type) {
        case 'sequential':
          memberResults = await this.executeSequential(
            resolvedPlan,
            team,
            llm,
            toolRegistry,
            roleRegistry,
          );
          break;
        case 'parallel':
          memberResults = await this.executeParallel(
            resolvedPlan,
            team,
            llm,
            toolRegistry,
            roleRegistry,
          );
          break;
        case 'pipeline':
          memberResults = await this.executePipeline(
            resolvedPlan,
            team,
            llm,
            toolRegistry,
            roleRegistry,
          );
          break;
        case 'orchestrated':
          memberResults = await this.executeOrchestrated(
            resolvedPlan,
            team,
            llm,
            toolRegistry,
            roleRegistry,
          );
          break;
        default:
          memberResults = await this.executeSequential(
            resolvedPlan,
            team,
            llm,
            toolRegistry,
            roleRegistry,
          );
      }
    } catch (err: unknown) {
      this.updateStatus(teamId, 'failed');
      const message = err instanceof Error ? err.message : String(err);
      return {
        teamId,
        task,
        memberResults: [],
        summary: `Execution failed: ${message}`,
        totalTokens: 0,
        totalDurationMs: Date.now() - startTime,
        status: 'failed',
      };
    }

    // reviewing
    this.updateStatus(teamId, 'reviewing');

    const summary = this.leadAgent.summarizeResults(memberResults);
    const totalTokens = memberResults.reduce(
      (sum, r) => sum + r.output.tokenUsage.totalTokens,
      0,
    );
    const totalDurationMs = Date.now() - startTime;

    const hasErrors = memberResults.some((r) => r.status === 'error');
    const allFailed = memberResults.every((r) => r.status !== 'completed');
    const finalStatus: 'completed' | 'partial' | 'failed' = allFailed
      ? 'failed'
      : hasErrors
        ? 'partial'
        : 'completed';

    // completed / failed
    this.updateStatus(teamId, finalStatus === 'failed' ? 'failed' : 'completed');

    return {
      teamId,
      task,
      memberResults,
      summary,
      totalTokens,
      totalDurationMs,
      status: finalStatus,
    };
  }

  getTeamStatus(teamId: string): TeamStatus {
    return this.teams.get(teamId)?.status ?? 'idle';
  }

  // ---- Execution strategies ----

  private async executeSequential(
    plan: TeamExecutionPlan,
    team: AgentTeam,
    llm: LLMAdapter,
    toolRegistry: ToolRegistryLike,
    roleRegistry?: RoleRegistry,
  ): Promise<TeamMemberResult[]> {
    const sorted = [...plan.tasks].sort((a, b) => b.priority - a.priority);
    const results: TeamMemberResult[] = [];

    for (const subtask of sorted) {
      const result = await this.executeSingleTask(
        subtask,
        team,
        llm,
        toolRegistry,
        roleRegistry,
      );
      results.push(result);
    }

    return results;
  }

  private async executeParallel(
    plan: TeamExecutionPlan,
    team: AgentTeam,
    llm: LLMAdapter,
    toolRegistry: ToolRegistryLike,
    roleRegistry?: RoleRegistry,
  ): Promise<TeamMemberResult[]> {
    const promises = plan.tasks.map((subtask) =>
      this.executeSingleTask(subtask, team, llm, toolRegistry, roleRegistry),
    );

    return Promise.all(promises);
  }

  private async executePipeline(
    plan: TeamExecutionPlan,
    team: AgentTeam,
    llm: LLMAdapter,
    toolRegistry: ToolRegistryLike,
    roleRegistry?: RoleRegistry,
  ): Promise<TeamMemberResult[]> {
    const results: TeamMemberResult[] = [];

    // Use pipeline order if available, otherwise use task order
    const taskOrder =
      plan.strategy.type === 'pipeline' && plan.strategy.order.length > 0
        ? this.orderTasksByIds(plan.tasks, plan.strategy.order)
        : [...plan.tasks];

    let previousOutput: string | undefined;

    for (const subtask of taskOrder) {
      const contextualTask: TeamDecomposedTask = previousOutput
        ? { ...subtask, context: previousOutput }
        : subtask;

      const result = await this.executeSingleTask(
        contextualTask,
        team,
        llm,
        toolRegistry,
        roleRegistry,
      );
      results.push(result);

      if (result.status === 'completed') {
        previousOutput = result.output.response;
      }
    }

    return results;
  }

  private async executeOrchestrated(
    plan: TeamExecutionPlan,
    team: AgentTeam,
    llm: LLMAdapter,
    toolRegistry: ToolRegistryLike,
    roleRegistry?: RoleRegistry,
  ): Promise<TeamMemberResult[]> {
    // Orchestrated: lead agent decides execution order dynamically.
    // Execute tasks respecting dependencies using a ready-queue approach.
    const results: TeamMemberResult[] = [];
    const completedIds = new Set<string>();
    const remaining = new Set(plan.tasks.map((t) => t.id));
    const taskMap = new Map(plan.tasks.map((t) => [t.id, t]));

    while (remaining.size > 0) {
      // Find tasks whose dependencies are all complete
      const ready: TeamDecomposedTask[] = [];
      for (const id of remaining) {
        const t = taskMap.get(id)!;
        const depsReady = t.dependsOn.every((dep) => completedIds.has(dep));
        if (depsReady) ready.push(t);
      }

      if (ready.length === 0) {
        // Deadlock – skip remaining tasks
        for (const id of remaining) {
          const t = taskMap.get(id)!;
          results.push({
            agentId: t.assignedAgentId,
            roleName: t.assignedRoleName,
            subtask: t.description,
            output: this.errorOutput(t.assignedRoleName, 'Dependency deadlock'),
            status: 'skipped',
          });
        }
        break;
      }

      // Execute all ready tasks in parallel
      const batchResults = await Promise.all(
        ready.map((t) =>
          this.executeSingleTask(t, team, llm, toolRegistry, roleRegistry),
        ),
      );

      for (let i = 0; i < ready.length; i++) {
        results.push(batchResults[i]);
        completedIds.add(ready[i].id);
        remaining.delete(ready[i].id);
      }
    }

    return results;
  }

  // ---- Single task execution ----

  private async executeSingleTask(
    subtask: TeamDecomposedTask,
    team: AgentTeam,
    llm: LLMAdapter,
    toolRegistry: ToolRegistryLike,
    roleRegistry?: RoleRegistry,
  ): Promise<TeamMemberResult> {
    const member = team.members.find((m) => m.agentId === subtask.assignedAgentId);
    if (!member) {
      return {
        agentId: subtask.assignedAgentId,
        roleName: subtask.assignedRoleName,
        subtask: subtask.description,
        output: this.errorOutput(subtask.assignedRoleName, 'Member not found in team'),
        status: 'error',
      };
    }

    const agentConfig = this.buildAgentConfig(member, roleRegistry);
    const executor = new AgentExecutor(agentConfig, llm, toolRegistry);

    const input: AgentInput = {
      task: subtask.description,
      context: subtask.context,
    };

    try {
      const output = await executor.execute(input);
      const status: 'completed' | 'error' =
        output.status === 'completed' || output.status === 'max-iterations'
          ? 'completed'
          : 'error';

      return {
        agentId: member.agentId,
        roleName: member.roleName,
        subtask: subtask.description,
        output,
        status,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        agentId: member.agentId,
        roleName: member.roleName,
        subtask: subtask.description,
        output: this.errorOutput(member.roleName, message),
        status: 'error',
      };
    }
  }

  // ---- Helpers ----

  private buildAgentConfig(
    member: AgentTeamMember,
    roleRegistry?: RoleRegistry,
  ): AgentConfig {
    // Try to resolve full config from role registry
    if (roleRegistry && member.roleId) {
      const resolved: ResolvedAgentConfig | undefined =
        roleRegistry.resolveAgentConfig(member.roleId);
      if (resolved) {
        return {
          name: resolved.name,
          domain: resolved.domain,
          systemPrompt: resolved.systemPrompt,
          model: resolved.model,
          maxIterations: resolved.maxIterations,
          temperature: resolved.temperature,
          allowedCapabilities: [...resolved.allowedTools],
          blockedCapabilities: [...resolved.blockedTools],
        };
      }
    }

    // Fallback: build a minimal config from member info
    return {
      name: member.roleName,
      domain: member.roleName.toLowerCase(),
      systemPrompt: `You are a ${member.roleName} agent. Your responsibility: ${member.responsibility}. Complete the assigned task thoroughly.`,
      maxIterations: 10,
      temperature: 0.7,
    };
  }

  private buildSimplePlan(task: string, team: AgentTeam): TeamExecutionPlan {
    const tasks: TeamDecomposedTask[] = team.members.map((m) => ({
      id: generateId('ttask'),
      description: `${m.responsibility}: ${task}`,
      assignedAgentId: m.agentId,
      assignedRoleName: m.roleName,
      dependsOn: [],
      priority: m.priority,
    }));

    return {
      teamId: team.id,
      goal: task,
      tasks,
      strategy: team.strategy,
      estimatedSteps: tasks.length,
    };
  }

  private orderTasksByIds(
    tasks: readonly TeamDecomposedTask[],
    order: readonly string[],
  ): TeamDecomposedTask[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const ordered: TeamDecomposedTask[] = [];

    for (const id of order) {
      const t = taskMap.get(id);
      if (t) {
        ordered.push(t);
        taskMap.delete(id);
      }
    }

    // Append any tasks not in the order list
    for (const t of taskMap.values()) {
      ordered.push(t);
    }

    return ordered;
  }

  private updateStatus(teamId: string, status: TeamStatus): void {
    const team = this.teams.get(teamId);
    if (!team) return;

    this.teams.set(teamId, {
      ...team,
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  private errorOutput(agentName: string, error: string): AgentOutput {
    return {
      agentName,
      response: `Error: ${error}`,
      steps: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      durationMs: 0,
      status: 'error',
    };
  }
}

// ---- Factory ----

export function createTeamOrchestrator(): TeamOrchestrator {
  return new TeamOrchestratorImpl();
}
