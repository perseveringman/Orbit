import { describe, expect, it, beforeEach } from 'vitest';

import {
  AgentExecutor,
  TaskPlanner,
  MultiAgentOrchestrator,
  generateId,
} from '../src/index';

import type {
  AgentConfig,
  AgentInput,
  AgentOutput,
  LLMAdapter,
  ChatCompletionResponse,
  OrbitAgentEvent,
  ExecutionContext,
} from '../src/index';

// ---------------------------------------------------------------------------
// Mock LLM adapter
// ---------------------------------------------------------------------------

function createMockLLM(overrides?: {
  content?: string;
  toolCalls?: { id: string; name: string; arguments: string }[];
  finishReason?: 'stop' | 'tool_calls';
}): LLMAdapter {
  const content = overrides?.content ?? 'mock response';
  const toolCalls = overrides?.toolCalls;
  const finishReason = overrides?.finishReason ?? 'stop';

  return {
    async chatCompletion(): Promise<ChatCompletionResponse> {
      return {
        id: generateId('resp'),
        choices: [
          {
            message: {
              id: generateId('msg'),
              role: 'assistant',
              content,
              toolCalls,
              timestamp: new Date().toISOString(),
            },
            finishReason,
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      };
    },
  };
}

// Count-based mock: returns tool calls on first N calls, then stops
function createIteratingLLM(toolCallCount: number): LLMAdapter {
  let calls = 0;
  return {
    async chatCompletion(): Promise<ChatCompletionResponse> {
      calls++;
      if (calls <= toolCallCount) {
        return {
          id: generateId('resp'),
          choices: [
            {
              message: {
                id: generateId('msg'),
                role: 'assistant',
                content: `iteration ${calls}`,
                toolCalls: [
                  { id: generateId('tc'), name: 'test-tool', arguments: '{}' },
                ],
                timestamp: new Date().toISOString(),
              },
              finishReason: 'tool_calls' as const,
            },
          ],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      }
      return {
        id: generateId('resp'),
        choices: [
          {
            message: {
              id: generateId('msg'),
              role: 'assistant',
              content: 'done',
              timestamp: new Date().toISOString(),
            },
            finishReason: 'stop' as const,
          },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    },
  };
}

function createErrorLLM(): LLMAdapter {
  return {
    async chatCompletion(): Promise<ChatCompletionResponse> {
      throw new Error('LLM service unavailable');
    },
  };
}

// ---------------------------------------------------------------------------
// Mock tool registry
// ---------------------------------------------------------------------------

function createMockToolRegistry() {
  return {
    async dispatch(name: string, _args: Record<string, unknown>) {
      return { success: true, output: `result from ${name}`, error: undefined };
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    name: 'test-agent',
    domain: 'planning',
    systemPrompt: 'You are a test agent.',
    maxIterations: 5,
    ...overrides,
  };
}

async function collectEvents(
  gen: AsyncGenerator<OrbitAgentEvent, AgentOutput | void>,
): Promise<OrbitAgentEvent[]> {
  const events: OrbitAgentEvent[] = [];
  let result: IteratorResult<OrbitAgentEvent, AgentOutput | void>;
  do {
    result = await gen.next();
    if (!result.done) {
      events.push(result.value);
    }
  } while (!result.done);
  return events;
}

// ---------------------------------------------------------------------------
// AgentExecutor
// ---------------------------------------------------------------------------

describe('AgentExecutor', () => {
  it('execute returns AgentOutput with correct fields', async () => {
    const executor = new AgentExecutor(makeAgentConfig(), createMockLLM(), null);
    const output = await executor.execute({ task: 'test task' });

    expect(output.agentName).toBe('test-agent');
    expect(output.response).toBe('mock response');
    expect(output.status).toBe('completed');
    expect(output.tokenUsage.totalTokens).toBe(15);
    expect(output.durationMs).toBeGreaterThanOrEqual(0);
    expect(output.steps.length).toBeGreaterThan(0);
    expect(output.steps[0].kind).toBe('reasoning');
  });

  it('handles LLM errors gracefully', async () => {
    const executor = new AgentExecutor(makeAgentConfig(), createErrorLLM(), null);
    const output = await executor.execute({ task: 'test task' });

    expect(output.status).toBe('error');
    expect(output.response).toContain('Error');
    expect(output.response).toContain('LLM service unavailable');
  });

  it('respects maxIterations', async () => {
    // LLM always returns tool calls, so it will loop until maxIterations
    const alwaysToolCallLLM: LLMAdapter = {
      async chatCompletion(): Promise<ChatCompletionResponse> {
        return {
          id: generateId('resp'),
          choices: [
            {
              message: {
                id: generateId('msg'),
                role: 'assistant',
                content: 'thinking...',
                toolCalls: [
                  { id: generateId('tc'), name: 'test-tool', arguments: '{}' },
                ],
                timestamp: new Date().toISOString(),
              },
              finishReason: 'tool_calls',
            },
          ],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      },
    };

    const config = makeAgentConfig({ maxIterations: 3 });
    const executor = new AgentExecutor(config, alwaysToolCallLLM, createMockToolRegistry());
    const output = await executor.execute({ task: 'loop forever' });

    expect(output.status).toBe('max-iterations');
    // 3 iterations × 15 tokens each
    expect(output.tokenUsage.totalTokens).toBe(45);
  });

  it('processes tool calls via registry', async () => {
    const llm = createIteratingLLM(1);
    const registry = createMockToolRegistry();
    const executor = new AgentExecutor(makeAgentConfig(), llm, registry);
    const output = await executor.execute({ task: 'use a tool' });

    expect(output.status).toBe('completed');
    const toolCallSteps = output.steps.filter((s) => s.kind === 'tool-call');
    const toolResultSteps = output.steps.filter((s) => s.kind === 'tool-result');
    expect(toolCallSteps.length).toBe(1);
    expect(toolResultSteps.length).toBe(1);
    expect(toolResultSteps[0].content).toBe('result from test-tool');
  });

  it('executeStream yields events', async () => {
    const executor = new AgentExecutor(makeAgentConfig(), createMockLLM(), null);
    const events = await collectEvents(executor.executeStream({ task: 'test' }));

    const types = events.map((e) => e.type);
    expect(types).toContain('agent:started');
    expect(types).toContain('agent:iteration');
    expect(types).toContain('agent:reasoning');
    expect(types).toContain('agent:completed');
  });

  it('getConfig returns the config', () => {
    const config = makeAgentConfig({ name: 'special' });
    const executor = new AgentExecutor(config, createMockLLM(), null);
    expect(executor.getConfig()).toBe(config);
  });

  it('includes context in system prompt when provided', async () => {
    let capturedMessages: readonly { role: string; content: string }[] = [];
    const spy: LLMAdapter = {
      async chatCompletion(req): Promise<ChatCompletionResponse> {
        capturedMessages = req.messages;
        return {
          id: generateId('resp'),
          choices: [
            {
              message: {
                id: generateId('msg'),
                role: 'assistant',
                content: 'ok',
                timestamp: new Date().toISOString(),
              },
              finishReason: 'stop',
            },
          ],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      },
    };

    const executor = new AgentExecutor(makeAgentConfig(), spy, null);
    await executor.execute({ task: 'hello', context: 'extra context here' });

    const systemMsg = capturedMessages.find((m) => m.role === 'system');
    expect(systemMsg?.content).toContain('extra context here');
  });
});

// ---------------------------------------------------------------------------
// TaskPlanner
// ---------------------------------------------------------------------------

describe('TaskPlanner', () => {
  const agents: AgentConfig[] = [
    makeAgentConfig({ name: 'planner', domain: 'planning' }),
    makeAgentConfig({ name: 'reader', domain: 'reading' }),
    makeAgentConfig({ name: 'researcher', domain: 'research' }),
    makeAgentConfig({ name: 'writer', domain: 'writing' }),
    makeAgentConfig({ name: 'reviewer', domain: 'review' }),
  ];

  it('creates a plan with subtasks', () => {
    const planner = new TaskPlanner(agents);
    const plan = planner.plan('research the topic', ['planner', 'researcher']);

    expect(plan.originalTask).toBe('research the topic');
    expect(plan.subtasks.length).toBeGreaterThan(0);
    expect(plan.id).toBeTruthy();
  });

  it('matches agents by domain keywords', () => {
    const planner = new TaskPlanner(agents);
    const plan = planner.plan('research the topic and write a summary', ['researcher', 'writer']);

    expect(plan.subtasks.length).toBeGreaterThanOrEqual(1);
    // At least one subtask should target the researcher or writer
    const agentNames = plan.subtasks.map((s) => s.targetAgent);
    const hasRelevantAgent = agentNames.some((n) => n === 'researcher' || n === 'writer');
    expect(hasRelevantAgent).toBe(true);
  });

  it('detects pipeline strategy for sequential numbered steps', () => {
    const planner = new TaskPlanner(agents);
    const plan = planner.plan(
      '1. Read the document\n2. Write a summary\n3. Review the summary',
      ['reader', 'writer', 'reviewer'],
    );

    expect(plan.subtasks.length).toBe(3);
    expect(plan.strategy).toBe('pipeline');
  });

  it('returns sequential for a single subtask', () => {
    const planner = new TaskPlanner(agents);
    const plan = planner.plan('plan the project', ['planner']);

    expect(plan.subtasks.length).toBe(1);
    expect(plan.strategy).toBe('sequential');
  });

  it('assigns priority in descending order', () => {
    const planner = new TaskPlanner(agents);
    const plan = planner.plan(
      '1. Research the topic\n2. Write a report',
      ['researcher', 'writer'],
    );

    if (plan.subtasks.length >= 2) {
      expect(plan.subtasks[0].priority).toBeGreaterThan(plan.subtasks[1].priority);
    }
  });
});

// ---------------------------------------------------------------------------
// MultiAgentOrchestrator
// ---------------------------------------------------------------------------

describe('MultiAgentOrchestrator', () => {
  let orchestrator: InstanceType<typeof MultiAgentOrchestrator>;
  let mockLLM: LLMAdapter;

  beforeEach(() => {
    mockLLM = createMockLLM();
    orchestrator = new MultiAgentOrchestrator({}, mockLLM, null);
  });

  it('registerAgent and listAgents', () => {
    orchestrator.registerAgent(makeAgentConfig({ name: 'agent-a', domain: 'planning' }));
    orchestrator.registerAgent(makeAgentConfig({ name: 'agent-b', domain: 'research' }));

    const agents = orchestrator.listAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.name)).toContain('agent-a');
    expect(agents.map((a) => a.name)).toContain('agent-b');
  });

  it('registerAgent throws on duplicate name', () => {
    orchestrator.registerAgent(makeAgentConfig({ name: 'dup' }));
    expect(() => orchestrator.registerAgent(makeAgentConfig({ name: 'dup' }))).toThrow(
      'already registered',
    );
  });

  it('unregisterAgent returns true for existing, false for missing', () => {
    orchestrator.registerAgent(makeAgentConfig({ name: 'temp' }));
    expect(orchestrator.unregisterAgent('temp')).toBe(true);
    expect(orchestrator.unregisterAgent('temp')).toBe(false);
    expect(orchestrator.listAgents()).toHaveLength(0);
  });

  it('executeAgent runs a single agent', async () => {
    orchestrator.registerAgent(makeAgentConfig({ name: 'solo' }));
    const output = await orchestrator.executeAgent('solo', { task: 'do something' });

    expect(output.agentName).toBe('solo');
    expect(output.status).toBe('completed');
    expect(output.response).toBe('mock response');
  });

  it('executeAgent throws for unknown agent', async () => {
    await expect(
      orchestrator.executeAgent('nonexistent', { task: 'test' }),
    ).rejects.toThrow('not found');
  });

  it('routeToAgent matches keywords to domains', () => {
    orchestrator.registerAgent(makeAgentConfig({ name: 'plan-agent', domain: 'planning' }));
    orchestrator.registerAgent(makeAgentConfig({ name: 'write-agent', domain: 'writing' }));
    orchestrator.registerAgent(makeAgentConfig({ name: 'research-agent', domain: 'research' }));

    expect(orchestrator.routeToAgent('plan the project')).toBe('plan-agent');
    expect(orchestrator.routeToAgent('write a summary')).toBe('write-agent');
    expect(orchestrator.routeToAgent('research this topic')).toBe('research-agent');
  });

  it('routeToAgent falls back to first agent', () => {
    orchestrator.registerAgent(makeAgentConfig({ name: 'default-agent', domain: 'planning' }));

    // Use a task with no matching keywords
    expect(orchestrator.routeToAgent('do something vague and unusual')).toBe('default-agent');
  });

  it('getState returns current state', async () => {
    orchestrator.registerAgent(makeAgentConfig({ name: 'state-agent' }));
    await orchestrator.executeAgent('state-agent', { task: 'test' });

    const state = orchestrator.getState();
    expect(state.activeAgents).toHaveLength(0); // completed, no longer active
    expect(state.totalTokens).toBeGreaterThan(0);
  });

  it('executePlan sequential runs subtasks in order', async () => {
    orchestrator.registerAgent(makeAgentConfig({ name: 'seq-agent', domain: 'planning' }));

    const plan = {
      id: generateId('plan'),
      originalTask: 'test plan',
      subtasks: [
        {
          id: 'st-1',
          description: 'first task',
          targetAgent: 'seq-agent',
          dependsOn: [] as readonly string[],
          priority: 2,
        },
        {
          id: 'st-2',
          description: 'second task',
          targetAgent: 'seq-agent',
          dependsOn: ['st-1'] as readonly string[],
          priority: 1,
        },
      ],
      strategy: 'sequential' as const,
    };

    const result = await orchestrator.executePlan(plan);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].subtaskId).toBe('st-1');
    expect(result.results[0].status).toBe('completed');
    expect(result.results[1].subtaskId).toBe('st-2');
    expect(result.results[1].status).toBe('completed');
    expect(result.totalTokens).toBe(30); // 15 + 15
  });

  it('executePlan skips subtask when dependency fails', async () => {
    const failLLM = createErrorLLM();
    const failOrch = new MultiAgentOrchestrator({}, failLLM, null);
    failOrch.registerAgent(makeAgentConfig({ name: 'fail-agent' }));

    const plan = {
      id: generateId('plan'),
      originalTask: 'test fail plan',
      subtasks: [
        {
          id: 'st-1',
          description: 'failing task',
          targetAgent: 'fail-agent',
          dependsOn: [] as readonly string[],
          priority: 2,
        },
        {
          id: 'st-2',
          description: 'depends on failing',
          targetAgent: 'fail-agent',
          dependsOn: ['st-1'] as readonly string[],
          priority: 1,
        },
      ],
      strategy: 'sequential' as const,
    };

    const result = await failOrch.executePlan(plan);

    expect(result.results[0].status).toBe('error');
    expect(result.results[1].status).toBe('skipped');
  });

  it('executePlan parallel runs independent subtasks', async () => {
    orchestrator.registerAgent(makeAgentConfig({ name: 'par-agent', domain: 'planning' }));

    const plan = {
      id: generateId('plan'),
      originalTask: 'parallel plan',
      subtasks: [
        {
          id: 'p-1',
          description: 'task A',
          targetAgent: 'par-agent',
          dependsOn: [] as readonly string[],
          priority: 1,
        },
        {
          id: 'p-2',
          description: 'task B',
          targetAgent: 'par-agent',
          dependsOn: [] as readonly string[],
          priority: 1,
        },
      ],
      strategy: 'parallel' as const,
    };

    const result = await orchestrator.executePlan(plan);

    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.status === 'completed')).toBe(true);
  });

  it('executePlan pipeline passes output forward', async () => {
    let callCount = 0;
    const pipelineLLM: LLMAdapter = {
      async chatCompletion(req): Promise<ChatCompletionResponse> {
        callCount++;
        // Check that second call includes pipeline context
        const systemMsg = req.messages.find((m) => m.role === 'system');
        const content = callCount === 1 ? 'step 1 output' : `processed: ${systemMsg?.content ?? ''}`;
        return {
          id: generateId('resp'),
          choices: [
            {
              message: {
                id: generateId('msg'),
                role: 'assistant',
                content,
                timestamp: new Date().toISOString(),
              },
              finishReason: 'stop',
            },
          ],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      },
    };

    const pipeOrch = new MultiAgentOrchestrator({}, pipelineLLM, null);
    pipeOrch.registerAgent(makeAgentConfig({ name: 'pipe-agent' }));

    const plan = {
      id: generateId('plan'),
      originalTask: 'pipeline plan',
      subtasks: [
        {
          id: 'pp-1',
          description: 'step 1',
          targetAgent: 'pipe-agent',
          dependsOn: [] as readonly string[],
          priority: 2,
        },
        {
          id: 'pp-2',
          description: 'step 2',
          targetAgent: 'pipe-agent',
          dependsOn: ['pp-1'] as readonly string[],
          priority: 1,
        },
      ],
      strategy: 'pipeline' as const,
    };

    const result = await pipeOrch.executePlan(plan);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].output.response).toBe('step 1 output');
    // Second call should have received pipeline context
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Integration: multi-agent flow
// ---------------------------------------------------------------------------

describe('Integration: multi-agent flow', () => {
  it('end-to-end: plan, register agents, execute plan', async () => {
    const llm = createMockLLM();

    const plannerConfig = makeAgentConfig({ name: 'planner', domain: 'planning' });
    const writerConfig = makeAgentConfig({ name: 'writer', domain: 'writing' });
    const reviewerConfig = makeAgentConfig({ name: 'reviewer', domain: 'review' });

    // Create planner and plan
    const planner = new TaskPlanner([plannerConfig, writerConfig, reviewerConfig]);
    const plan = planner.plan(
      '1. Plan the article\n2. Write the draft\n3. Review the draft',
      ['planner', 'writer', 'reviewer'],
    );

    expect(plan.subtasks.length).toBe(3);

    // Create orchestrator and register agents
    const orchestrator = new MultiAgentOrchestrator(
      { maxConcurrentAgents: 2 },
      llm,
      null,
    );
    orchestrator.registerAgent(plannerConfig);
    orchestrator.registerAgent(writerConfig);
    orchestrator.registerAgent(reviewerConfig);

    // Execute the plan
    const result = await orchestrator.executePlan(plan);

    expect(result.results.length).toBe(3);
    expect(result.results.every((r) => r.status === 'completed')).toBe(true);
    expect(result.totalTokens).toBe(45); // 3 × 15
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);

    const state = orchestrator.getState();
    expect(state.completedTasks.length).toBe(3);
  });

  it('executeStream yields orchestrator events', async () => {
    const llm = createMockLLM();
    const orchestrator = new MultiAgentOrchestrator({}, llm, null);
    orchestrator.registerAgent(makeAgentConfig({ name: 'stream-agent', domain: 'planning' }));

    const events = await collectEvents(
      orchestrator.executeStream('plan something') as AsyncGenerator<OrbitAgentEvent, void>,
    );

    const types = events.map((e) => e.type);
    expect(types).toContain('orchestrator:started');
    expect(types).toContain('orchestrator:routed');
    expect(types).toContain('orchestrator:completed');
  });

  it('exports are accessible from main index', async () => {
    // Verify all M6 exports are available
    expect(AgentExecutor).toBeDefined();
    expect(TaskPlanner).toBeDefined();
    expect(MultiAgentOrchestrator).toBeDefined();
  });
});
