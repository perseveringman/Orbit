import { describe, expect, it } from 'vitest';

import {
  // Events
  createEvent,
  isCapabilityEvent,
  isSafetyEvent,
  isCompressionEvent,
  isAgentEvent,
  isOrchestratorEvent,
  // Execution Context
  createExecutionContext,
  // Orchestrator & deps
  Orchestrator,
  ToolRegistry,
  MemoryManager,
  InMemoryMemoryStore,
  SafetyGate,
  generateId,
} from '../src/index';

import type {
  OrbitAgentEvent,
  CapabilityStartedEvent,
  SafetyCheckPassedEvent,
  AgentReasoningEvent,
  OrchestratorStartedEvent,
  CompressionStartedEvent,
  AgentSession,
  ChatCompletionResponse,
  ToolDefinition,
} from '../src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolDef(overrides?: Partial<ToolDefinition>): ToolDefinition {
  return {
    name: 'test-tool',
    domain: 'reading',
    description: 'A test tool',
    inputSchema: { type: 'object', properties: {} },
    riskLevel: 'R0-read',
    approvalPolicy: 'A0-auto',
    executionMode: 'sync',
    scopeLimit: 'current-object',
    dataBoundary: 'local-only',
    ...overrides,
  };
}

function makeSession(overrides?: Partial<AgentSession>): AgentSession {
  return {
    id: 'ses-test',
    workspaceId: 'ws-1',
    surface: 'global-chat',
    anchorObjectIds: [],
    lineage: [],
    status: 'active',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe('Event type guards', () => {
  it('isCapabilityEvent matches capability:* types', () => {
    const event = createEvent<CapabilityStartedEvent>('capability:started', 'run-1', {
      capabilityName: 'search',
      args: { q: 'test' },
    });
    expect(isCapabilityEvent(event)).toBe(true);
    expect(isSafetyEvent(event)).toBe(false);
    expect(isAgentEvent(event)).toBe(false);
    expect(isOrchestratorEvent(event)).toBe(false);
    expect(isCompressionEvent(event)).toBe(false);
  });

  it('isSafetyEvent matches safety:* types', () => {
    const event = createEvent<SafetyCheckPassedEvent>('safety:check-passed', 'run-1', {
      capabilityName: 'read-object',
      tier: 'A0-auto',
    });
    expect(isSafetyEvent(event)).toBe(true);
    expect(isCapabilityEvent(event)).toBe(false);
    expect(isAgentEvent(event)).toBe(false);
    expect(isOrchestratorEvent(event)).toBe(false);
  });

  it('isCompressionEvent matches compression:* types', () => {
    const event = createEvent<CompressionStartedEvent>('compression:started', 'run-1', {
      originalTokens: 5000,
    });
    expect(isCompressionEvent(event)).toBe(true);
    expect(isCapabilityEvent(event)).toBe(false);
    expect(isAgentEvent(event)).toBe(false);
  });

  it('isAgentEvent matches agent:* types', () => {
    const event = createEvent<AgentReasoningEvent>('agent:reasoning', 'run-1', {
      content: 'Thinking...',
    });
    expect(isAgentEvent(event)).toBe(true);
    expect(isCapabilityEvent(event)).toBe(false);
    expect(isOrchestratorEvent(event)).toBe(false);
  });

  it('isOrchestratorEvent matches orchestrator:* types', () => {
    const event = createEvent<OrchestratorStartedEvent>('orchestrator:started', 'run-1', {
      sessionId: 'ses-1',
      surface: 'global-chat',
    });
    expect(isOrchestratorEvent(event)).toBe(true);
    expect(isAgentEvent(event)).toBe(false);
    expect(isCapabilityEvent(event)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createEvent helper
// ---------------------------------------------------------------------------

describe('createEvent', () => {
  it('creates event with correct type, runId, and timestamp', () => {
    const before = Date.now();
    const event = createEvent<OrchestratorStartedEvent>('orchestrator:started', 'run-42', {
      sessionId: 'ses-x',
      surface: 'reader',
    });
    const after = Date.now();

    expect(event.type).toBe('orchestrator:started');
    expect(event.runId).toBe('run-42');
    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
    expect(event.sessionId).toBe('ses-x');
    expect(event.surface).toBe('reader');
  });

  it('creates capability event with all fields', () => {
    const event = createEvent<CapabilityStartedEvent>('capability:started', 'run-1', {
      capabilityName: 'web-search',
      args: { query: 'orbit' },
    });
    expect(event.type).toBe('capability:started');
    expect(event.capabilityName).toBe('web-search');
    expect(event.args).toEqual({ query: 'orbit' });
  });
});

// ---------------------------------------------------------------------------
// createExecutionContext
// ---------------------------------------------------------------------------

describe('createExecutionContext', () => {
  it('creates context with required fields', () => {
    const ctx = createExecutionContext({
      runId: 'run-1',
      sessionId: 'ses-1',
      surface: 'global-chat',
    });

    expect(ctx.runId).toBe('run-1');
    expect(ctx.sessionId).toBe('ses-1');
    expect(ctx.surface).toBe('global-chat');
    expect(ctx.signal).toBeDefined();
    expect(ctx.signal.aborted).toBe(false);
    // emit should be a no-op by default
    expect(() => ctx.emit(createEvent<OrchestratorStartedEvent>('orchestrator:started', 'run-1', {
      sessionId: 'ses-1',
      surface: 'global-chat',
    }))).not.toThrow();
  });

  it('uses provided signal and onEvent', () => {
    const controller = new AbortController();
    const events: OrbitAgentEvent[] = [];

    const ctx = createExecutionContext({
      runId: 'run-2',
      sessionId: 'ses-2',
      surface: 'reader',
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(ctx.signal).toBe(controller.signal);
    ctx.emit(createEvent<AgentReasoningEvent>('agent:reasoning', 'run-2', { content: 'test' }));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('agent:reasoning');
  });
});

// ---------------------------------------------------------------------------
// executeStream – simple conversation (no tool calls)
// ---------------------------------------------------------------------------

describe('Orchestrator.executeStream', () => {
  it('yields correct event sequence for simple conversation', async () => {
    const registry = new ToolRegistry();
    const store = new InMemoryMemoryStore();
    const memory = new MemoryManager(store);
    const safety = new SafetyGate();

    const llm = {
      chatCompletion: async () => ({
        id: 'resp-1',
        choices: [
          {
            message: {
              id: 'msg-1',
              role: 'assistant' as const,
              content: 'Here is your plan.',
              timestamp: new Date().toISOString(),
            },
            finishReason: 'stop' as const,
          },
        ],
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      }),
    };

    const orch = new Orchestrator({}, registry, memory, safety, llm);

    const events: OrbitAgentEvent[] = [];
    const stream = orch.executeStream({
      session: makeSession(),
      userMessage: 'Plan my week',
      availableContext: [],
    });

    let result: IteratorResult<OrbitAgentEvent, unknown>;
    do {
      result = await stream.next();
      if (!result.done) {
        events.push(result.value);
      }
    } while (!result.done);

    const types = events.map((e) => e.type);

    // Must start with orchestrator:started
    expect(types[0]).toBe('orchestrator:started');
    // Then orchestrator:routed
    expect(types[1]).toBe('orchestrator:routed');
    // Then agent:started
    expect(types[2]).toBe('agent:started');
    // Should have agent:iteration
    expect(types).toContain('agent:iteration');
    // Should have agent:reasoning (because assistant returned content)
    expect(types).toContain('agent:reasoning');
    // Should end with agent:completed then orchestrator:completed
    expect(types[types.length - 2]).toBe('agent:completed');
    expect(types[types.length - 1]).toBe('orchestrator:completed');

    // Return value should be the OrchestratorOutput
    const output = result.value as { run: { status: string } };
    expect(output.run.status).toBe('completed');
  });

  it('yields capability and tool events for tool-call conversation', async () => {
    const registry = new ToolRegistry();
    registry.register(
      makeToolDef({ name: 'list-tasks', domain: 'planning' }),
      async () => 'Task 1, Task 2',
    );

    const store = new InMemoryMemoryStore();
    const memory = new MemoryManager(store);
    const safety = new SafetyGate();

    let callCount = 0;
    const llm = {
      chatCompletion: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 'resp-1',
            choices: [
              {
                message: {
                  id: 'msg-1',
                  role: 'assistant' as const,
                  content: '',
                  toolCalls: [
                    { id: 'tc1', name: 'list-tasks', arguments: '{}' },
                  ],
                  timestamp: new Date().toISOString(),
                },
                finishReason: 'tool_calls' as const,
              },
            ],
            usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
          };
        }
        return {
          id: 'resp-2',
          choices: [
            {
              message: {
                id: 'msg-2',
                role: 'assistant' as const,
                content: 'You have Task 1 and Task 2.',
                timestamp: new Date().toISOString(),
              },
              finishReason: 'stop' as const,
            },
          ],
          usage: { promptTokens: 50, completionTokens: 15, totalTokens: 65 },
        };
      },
    };

    const orch = new Orchestrator({}, registry, memory, safety, llm);

    const events: OrbitAgentEvent[] = [];
    const stream = orch.executeStream({
      session: makeSession({ surface: 'task-center' }),
      userMessage: 'List my tasks',
      availableContext: [],
    });

    let result: IteratorResult<OrbitAgentEvent, unknown>;
    do {
      result = await stream.next();
      if (!result.done) {
        events.push(result.value);
      }
    } while (!result.done);

    const types = events.map((e) => e.type);

    // Orchestrator lifecycle
    expect(types[0]).toBe('orchestrator:started');
    expect(types[1]).toBe('orchestrator:routed');
    expect(types[2]).toBe('agent:started');

    // Tool events should be present
    expect(types).toContain('capability:started');
    expect(types).toContain('capability:completed');
    expect(types).toContain('agent:tool-call');
    expect(types).toContain('agent:tool-result');
    expect(types).toContain('safety:check-passed');

    // Should have two iterations
    const iterationEvents = events.filter((e) => e.type === 'agent:iteration');
    expect(iterationEvents).toHaveLength(2);

    // Completion
    expect(types[types.length - 2]).toBe('agent:completed');
    expect(types[types.length - 1]).toBe('orchestrator:completed');

    // All events share the same runId
    const runIds = new Set(events.map((e) => e.runId));
    expect(runIds.size).toBe(1);

    // All events have timestamps
    for (const e of events) {
      expect(e.timestamp).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// execute() backward compatibility
// ---------------------------------------------------------------------------

describe('Orchestrator.execute backward compat', () => {
  it('returns same OrchestratorOutput as before', async () => {
    const registry = new ToolRegistry();
    const store = new InMemoryMemoryStore();
    const memory = new MemoryManager(store);
    const safety = new SafetyGate();

    const llm = {
      chatCompletion: async () => ({
        id: 'resp-1',
        choices: [
          {
            message: {
              id: 'msg-1',
              role: 'assistant' as const,
              content: 'Here is your plan.',
              timestamp: new Date().toISOString(),
            },
            finishReason: 'stop' as const,
          },
        ],
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      }),
    };

    const orch = new Orchestrator({}, registry, memory, safety, llm);

    const output = await orch.execute({
      session: makeSession(),
      userMessage: 'Plan my week',
      availableContext: [],
    });

    expect(output.run.status).toBe('completed');
    expect(output.run.agentDomain).toBe('planning');
    expect(output.responseMessage.content).toBe('Here is your plan.');
    expect(output.run.tokenUsage.totalTokens).toBe(70);
    expect(output.run.steps.length).toBeGreaterThan(0);
  });

  it('execute handles tool call loop same as before', async () => {
    const registry = new ToolRegistry();
    registry.register(
      makeToolDef({ name: 'list-tasks', domain: 'planning' }),
      async () => 'Task 1, Task 2',
    );

    const store = new InMemoryMemoryStore();
    const memory = new MemoryManager(store);
    const safety = new SafetyGate();

    let callCount = 0;
    const llm = {
      chatCompletion: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 'resp-1',
            choices: [
              {
                message: {
                  id: 'msg-1',
                  role: 'assistant' as const,
                  content: '',
                  toolCalls: [
                    { id: 'tc1', name: 'list-tasks', arguments: '{}' },
                  ],
                  timestamp: new Date().toISOString(),
                },
                finishReason: 'tool_calls' as const,
              },
            ],
            usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
          };
        }
        return {
          id: 'resp-2',
          choices: [
            {
              message: {
                id: 'msg-2',
                role: 'assistant' as const,
                content: 'You have Task 1 and Task 2.',
                timestamp: new Date().toISOString(),
              },
              finishReason: 'stop' as const,
            },
          ],
          usage: { promptTokens: 50, completionTokens: 15, totalTokens: 65 },
        };
      },
    };

    const orch = new Orchestrator({}, registry, memory, safety, llm);

    const output = await orch.execute({
      session: makeSession({ surface: 'task-center' }),
      userMessage: 'List my tasks',
      availableContext: [],
    });

    expect(output.run.status).toBe('completed');
    expect(output.responseMessage.content).toContain('Task 1');
    const stepKinds = output.run.steps.map((s) => s.kind);
    expect(stepKinds).toContain('tool-call');
    expect(stepKinds).toContain('tool-result');
    expect(output.run.tokenUsage.totalTokens).toBe(105);
  });
});
