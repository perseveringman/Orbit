// ---------------------------------------------------------------------------
// @orbit/agent-core – Multi-Agent Orchestrator (M6)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { LLMAdapter } from '../llm-adapter.js';
import type { ExecutionContext } from '../execution-context.js';
import type { OrbitAgentEvent } from '../events.js';
import { createEvent } from '../events.js';
import type {
  OrchestratorStartedEvent,
  OrchestratorRoutedEvent,
  OrchestratorDelegatedEvent,
  OrchestratorCompletedEvent,
  OrchestratorErrorEvent,
} from '../events.js';
import {
  AgentExecutor,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
} from './agent-executor.js';
import {
  TaskPlanner,
  type TaskPlan,
  type SubtaskResult,
  type ExecutionStrategy,
} from './task-planner.js';

// ---- Public types ----

export interface MultiAgentConfig {
  readonly maxConcurrentAgents: number;
  readonly maxTotalIterations: number;
  readonly delegationEnabled: boolean;
  readonly defaultModel: string;
}

export interface OrchestratorState {
  readonly activeAgents: readonly string[];
  readonly completedTasks: readonly SubtaskResult[];
  readonly totalTokens: number;
  readonly totalDurationMs: number;
}

export interface PlanExecutionResult {
  readonly results: readonly SubtaskResult[];
  readonly totalTokens: number;
  readonly totalDurationMs: number;
}

// ---- Keyword → domain mapping for routing ----

const KEYWORD_ROUTE_MAP: readonly { readonly keywords: readonly string[]; readonly domain: string }[] = [
  { keywords: ['plan', 'break down', 'task', 'schedule', 'prioritize'], domain: 'planning' },
  { keywords: ['read', 'find', 'look up', 'extract', 'show me'], domain: 'reading' },
  { keywords: ['research', 'search', 'investigate', 'compare', 'analyze'], domain: 'research' },
  { keywords: ['write', 'draft', 'compose', 'edit', 'rewrite'], domain: 'writing' },
  { keywords: ['review', 'check', 'critique', 'feedback', 'evaluate'], domain: 'review' },
  { keywords: ['link', 'connect', 'graph', 'relate', 'map'], domain: 'graph' },
  { keywords: ['import', 'export', 'sync', 'backup', 'clean', 'migrate'], domain: 'ops' },
];

// ---- Default config ----

const DEFAULT_MULTI_AGENT_CONFIG: MultiAgentConfig = {
  maxConcurrentAgents: 3,
  maxTotalIterations: 50,
  delegationEnabled: true,
  defaultModel: 'gpt-4o',
};

// ---- Multi-Agent Orchestrator ----

export class MultiAgentOrchestrator {
  private readonly agents = new Map<string, AgentExecutor>();
  private readonly agentConfigs = new Map<string, AgentConfig>();
  private readonly config: MultiAgentConfig;
  private readonly llm: LLMAdapter;
  private readonly toolRegistry: { dispatch?(name: string, args: Record<string, unknown>): Promise<{ success: boolean; output: string; error?: string }> } | null;

  // Mutable state
  private activeAgentNames: string[] = [];
  private completedResults: SubtaskResult[] = [];
  private totalTokens = 0;
  private totalDurationMs = 0;

  constructor(
    config: Partial<MultiAgentConfig>,
    llm: LLMAdapter,
    toolRegistry: { dispatch?(name: string, args: Record<string, unknown>): Promise<{ success: boolean; output: string; error?: string }> } | null,
  ) {
    this.config = { ...DEFAULT_MULTI_AGENT_CONFIG, ...config };
    this.llm = llm;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Register a new agent configuration.
   */
  registerAgent(config: AgentConfig): void {
    if (this.agents.has(config.name)) {
      throw new Error(`Agent "${config.name}" is already registered`);
    }
    const executor = new AgentExecutor(config, this.llm, this.toolRegistry);
    this.agents.set(config.name, executor);
    this.agentConfigs.set(config.name, config);
  }

  /**
   * Unregister an agent by name.
   */
  unregisterAgent(name: string): boolean {
    const deleted = this.agents.delete(name);
    this.agentConfigs.delete(name);
    return deleted;
  }

  /**
   * Execute a single agent by name.
   */
  async executeAgent(
    agentName: string,
    input: AgentInput,
    context?: ExecutionContext,
  ): Promise<AgentOutput> {
    const executor = this.agents.get(agentName);
    if (!executor) {
      throw new Error(`Agent "${agentName}" not found`);
    }

    this.activeAgentNames.push(agentName);
    try {
      const output = await executor.execute(input, context);
      this.totalTokens += output.tokenUsage.totalTokens;
      this.totalDurationMs += output.durationMs;
      return output;
    } finally {
      this.activeAgentNames = this.activeAgentNames.filter((n) => n !== agentName);
    }
  }

  /**
   * Execute a task plan (multiple agents).
   */
  async executePlan(
    plan: TaskPlan,
    context?: ExecutionContext,
  ): Promise<PlanExecutionResult> {
    const startTime = Date.now();
    const results: SubtaskResult[] = [];
    let planTokens = 0;

    switch (plan.strategy) {
      case 'sequential':
        for (const subtask of plan.subtasks) {
          const result = await this.executeSubtask(subtask, results, context);
          results.push(result);
          planTokens += result.output.tokenUsage.totalTokens;
        }
        break;

      case 'parallel':
        await this.executeParallel(plan.subtasks, results, context);
        for (const r of results) {
          planTokens += r.output.tokenUsage.totalTokens;
        }
        break;

      case 'pipeline':
        for (let i = 0; i < plan.subtasks.length; i++) {
          const subtask = plan.subtasks[i];
          const previousOutput = i > 0 ? results[i - 1]?.output.response : undefined;
          const result = await this.executeSubtask(subtask, results, context, previousOutput);
          results.push(result);
          planTokens += result.output.tokenUsage.totalTokens;
        }
        break;
    }

    this.completedResults.push(...results);
    const planDuration = Date.now() - startTime;
    this.totalTokens += planTokens;
    this.totalDurationMs += planDuration;

    return {
      results,
      totalTokens: planTokens,
      totalDurationMs: planDuration,
    };
  }

  /**
   * Stream events from multi-agent execution.
   * Creates a plan and executes it, yielding events along the way.
   */
  async *executeStream(
    task: string,
    context?: ExecutionContext,
  ): AsyncGenerator<OrbitAgentEvent> {
    const runId = generateId('run');

    yield createEvent<OrchestratorStartedEvent>('orchestrator:started', runId, {
      sessionId: context?.sessionId ?? '',
      surface: context?.surface ?? 'global-chat',
    });

    const targetAgent = this.routeToAgent(task);

    yield createEvent<OrchestratorRoutedEvent>('orchestrator:routed', runId, {
      domain: this.agentConfigs.get(targetAgent)?.domain ?? 'unknown',
      reason: 'keyword-heuristic',
    });

    // If delegation is disabled or single agent suffices, run directly
    if (!this.config.delegationEnabled || this.agents.size <= 1) {
      const executor = this.agents.get(targetAgent);
      if (executor) {
        const stream = executor.executeStream({ task, parentRunId: runId }, context);
        let result: IteratorResult<OrbitAgentEvent, AgentOutput>;
        do {
          result = await stream.next();
          if (!result.done) {
            yield result.value;
          }
        } while (!result.done);
      }
    } else {
      // Multi-agent: plan and execute
      const planner = new TaskPlanner([...this.agentConfigs.values()]);
      const plan = planner.plan(task, [...this.agentConfigs.keys()]);

      for (const subtask of plan.subtasks) {
        yield createEvent<OrchestratorDelegatedEvent>('orchestrator:delegated', runId, {
          targetDomain: this.agentConfigs.get(subtask.targetAgent)?.domain ?? 'unknown',
          task: subtask.description,
          childRunId: generateId('run'),
        });

        const executor = this.agents.get(subtask.targetAgent);
        if (executor) {
          const stream = executor.executeStream(
            { task: subtask.description, parentRunId: runId },
            context,
          );
          let result: IteratorResult<OrbitAgentEvent, AgentOutput>;
          do {
            result = await stream.next();
            if (!result.done) {
              yield result.value;
            }
          } while (!result.done);
        }
      }
    }

    yield createEvent<OrchestratorCompletedEvent>('orchestrator:completed', runId, {
      sessionId: context?.sessionId ?? '',
      totalTokens: this.totalTokens,
      totalDurationMs: this.totalDurationMs,
    });
  }

  /**
   * Route a task to the best agent using keyword heuristics.
   */
  routeToAgent(task: string): string {
    const lower = task.toLowerCase();

    // Match keywords to agent domains
    for (const { keywords, domain } of KEYWORD_ROUTE_MAP) {
      if (keywords.some((kw) => lower.includes(kw))) {
        // Find an agent with this domain
        for (const [name, config] of this.agentConfigs) {
          if (config.domain === domain) {
            return name;
          }
        }
      }
    }

    // Fall back to first registered agent
    const first = this.agents.keys().next();
    return first.done ? 'unknown' : first.value;
  }

  /**
   * Get current orchestrator state.
   */
  getState(): OrchestratorState {
    return {
      activeAgents: [...this.activeAgentNames],
      completedTasks: [...this.completedResults],
      totalTokens: this.totalTokens,
      totalDurationMs: this.totalDurationMs,
    };
  }

  /**
   * List all registered agent configurations.
   */
  listAgents(): readonly AgentConfig[] {
    return [...this.agentConfigs.values()];
  }

  // ---- Private helpers ----

  private async executeSubtask(
    subtask: { readonly id: string; readonly description: string; readonly targetAgent: string; readonly dependsOn: readonly string[] },
    completedResults: readonly SubtaskResult[],
    context?: ExecutionContext,
    pipelineInput?: string,
  ): Promise<SubtaskResult> {
    // Check dependencies are met
    for (const depId of subtask.dependsOn) {
      const dep = completedResults.find((r) => r.subtaskId === depId);
      if (!dep || dep.status === 'error') {
        return {
          subtaskId: subtask.id,
          output: this.errorOutput(subtask.targetAgent, 'Dependency not met or failed'),
          status: 'skipped',
        };
      }
    }

    const executor = this.agents.get(subtask.targetAgent);
    if (!executor) {
      return {
        subtaskId: subtask.id,
        output: this.errorOutput(subtask.targetAgent, `Agent "${subtask.targetAgent}" not found`),
        status: 'error',
      };
    }

    try {
      const input: AgentInput = {
        task: subtask.description,
        context: pipelineInput,
      };

      const output = await executor.execute(input, context);
      return {
        subtaskId: subtask.id,
        output,
        status: output.status === 'completed' || output.status === 'max-iterations'
          ? 'completed'
          : 'error',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        subtaskId: subtask.id,
        output: this.errorOutput(subtask.targetAgent, message),
        status: 'error',
      };
    }
  }

  private async executeParallel(
    subtasks: readonly { readonly id: string; readonly description: string; readonly targetAgent: string; readonly dependsOn: readonly string[] }[],
    results: SubtaskResult[],
    context?: ExecutionContext,
  ): Promise<void> {
    // Execute in batches up to maxConcurrentAgents
    const queue = [...subtasks];

    while (queue.length > 0) {
      const batch = queue.splice(0, this.config.maxConcurrentAgents);
      const batchPromises = batch.map((subtask) =>
        this.executeSubtask(subtask, results, context),
      );
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
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
