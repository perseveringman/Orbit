import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  // Events
  createEvent,
  // Frontend
  EventBus,
  AgentSessionState,
  InMemoryTransport,
  AgentBridge,
  // Observability
  HealthChecker,
  ProviderHealthCheck,
  Tracer,
  InMemoryExporter,
  AgentMetrics,
  Logger,
  BufferLogTransport,
} from '../src/index';

import type {
  OrbitAgentEvent,
  OrchestratorStartedEvent,
  OrchestratorCompletedEvent,
  OrchestratorErrorEvent,
  OrchestratorCancelledEvent,
  OrchestratorRoutedEvent,
  AgentStreamDeltaEvent,
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentIterationEvent,
  AgentCompletedEvent,
  AgentErrorEvent,
  AgentStartedEvent,
  SafetyApprovalRequiredEvent,
  FrontendMessage,
  BackendMessage,
  SessionUIState,
} from '../src/index';

// ---- Helpers ----

function makeEvent<T extends OrbitAgentEvent>(
  type: T['type'],
  fields: Omit<T, 'type' | 'runId' | 'timestamp'>,
): T {
  return createEvent<T>(type, 'run_test', fields);
}

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('delivers events to typed listeners', () => {
    const received: OrbitAgentEvent[] = [];
    bus.on<OrchestratorStartedEvent>('orchestrator:started', (e) => {
      received.push(e);
    });

    const event = makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
      sessionId: 's1',
      surface: 'chat',
    });
    bus.emit(event);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('orchestrator:started');
  });

  it('does not deliver events to wrong type listeners', () => {
    const received: OrbitAgentEvent[] = [];
    bus.on<OrchestratorCompletedEvent>('orchestrator:completed', (e) => {
      received.push(e);
    });

    bus.emit(
      makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
        sessionId: 's1',
        surface: 'chat',
      }),
    );

    expect(received).toHaveLength(0);
  });

  it('onAny receives all events', () => {
    const received: OrbitAgentEvent[] = [];
    bus.onAny((e) => received.push(e));

    bus.emit(
      makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
        sessionId: 's1',
        surface: 'chat',
      }),
    );
    bus.emit(
      makeEvent<OrchestratorCompletedEvent>('orchestrator:completed', {
        sessionId: 's1',
        totalTokens: 100,
        totalDurationMs: 500,
      }),
    );

    expect(received).toHaveLength(2);
  });

  it('once auto-unsubscribes after first delivery', () => {
    const received: OrbitAgentEvent[] = [];
    bus.once<OrchestratorStartedEvent>('orchestrator:started', (e) => {
      received.push(e);
    });

    const event = makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
      sessionId: 's1',
      surface: 'chat',
    });
    bus.emit(event);
    bus.emit(event);

    expect(received).toHaveLength(1);
  });

  it('unsubscribe removes the listener', () => {
    const received: OrbitAgentEvent[] = [];
    const unsub = bus.on<OrchestratorStartedEvent>('orchestrator:started', (e) => {
      received.push(e);
    });

    const event = makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
      sessionId: 's1',
      surface: 'chat',
    });
    bus.emit(event);
    unsub();
    bus.emit(event);

    expect(received).toHaveLength(1);
  });

  it('clear removes all listeners', () => {
    bus.on('orchestrator:started', () => {});
    bus.onAny(() => {});
    expect(bus.listenerCount()).toBe(2);

    bus.clear();
    expect(bus.listenerCount()).toBe(0);
  });

  it('listenerCount returns correct counts', () => {
    bus.on('orchestrator:started', () => {});
    bus.on('orchestrator:started', () => {});
    bus.on('orchestrator:completed', () => {});
    bus.onAny(() => {});

    expect(bus.listenerCount('orchestrator:started')).toBe(2);
    expect(bus.listenerCount('orchestrator:completed')).toBe(1);
    expect(bus.listenerCount('nonexistent')).toBe(0);
    expect(bus.listenerCount()).toBe(4); // 3 typed + 1 any
  });
});

// ---------------------------------------------------------------------------
// AgentSessionState
// ---------------------------------------------------------------------------

describe('AgentSessionState', () => {
  let bus: EventBus;
  let session: AgentSessionState;

  beforeEach(() => {
    bus = new EventBus();
    session = new AgentSessionState('session_1', bus);
  });

  it('starts with idle state', () => {
    const state = session.getState();
    expect(state.sessionId).toBe('session_1');
    expect(state.status).toBe('idle');
    expect(state.messages).toHaveLength(0);
    expect(state.currentToolCalls).toHaveLength(0);
    expect(state.tokenUsage).toEqual({ prompt: 0, completion: 0, total: 0 });
  });

  it('addUserMessage adds a user message', () => {
    session.addUserMessage('Hello');
    const state = session.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].content).toBe('Hello');
    expect(state.messages[0].streaming).toBe(false);
  });

  it('getMessage returns a message by ID', () => {
    session.addUserMessage('Test');
    const state = session.getState();
    const msg = session.getMessage(state.messages[0].id);
    expect(msg).toBeDefined();
    expect(msg!.content).toBe('Test');
  });

  it('getMessage returns undefined for unknown ID', () => {
    expect(session.getMessage('nonexistent')).toBeUndefined();
  });

  it('subscribe notifies on state changes', () => {
    const states: SessionUIState[] = [];
    session.subscribe((s) => states.push(s));

    session.addUserMessage('Hi');
    expect(states).toHaveLength(1);
    expect(states[0].messages).toHaveLength(1);
  });

  it('unsubscribe stops notifications', () => {
    const states: SessionUIState[] = [];
    const unsub = session.subscribe((s) => states.push(s));

    session.addUserMessage('A');
    unsub();
    session.addUserMessage('B');

    expect(states).toHaveLength(1);
  });

  it('reset returns to initial state', () => {
    session.addUserMessage('Hello');
    session.processEvent(
      makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
        sessionId: 'session_1',
        surface: 'chat',
      }),
    );
    expect(session.getState().status).toBe('thinking');

    session.reset();
    const state = session.getState();
    expect(state.status).toBe('idle');
    expect(state.messages).toHaveLength(0);
    expect(state.sessionId).toBe('session_1');
  });

  // -- Event processing tests --

  it('orchestrator:started → thinking', () => {
    session.processEvent(
      makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
        sessionId: 'session_1',
        surface: 'chat',
      }),
    );
    expect(session.getState().status).toBe('thinking');
  });

  it('orchestrator:completed → idle', () => {
    session.processEvent(
      makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
        sessionId: 'session_1',
        surface: 'chat',
      }),
    );
    session.processEvent(
      makeEvent<OrchestratorCompletedEvent>('orchestrator:completed', {
        sessionId: 'session_1',
        totalTokens: 100,
        totalDurationMs: 500,
      }),
    );
    expect(session.getState().status).toBe('idle');
  });

  it('orchestrator:error → error', () => {
    session.processEvent(
      makeEvent<OrchestratorErrorEvent>('orchestrator:error', {
        error: 'Something went wrong',
      }),
    );
    const state = session.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Something went wrong');
  });

  it('orchestrator:cancelled → idle', () => {
    session.processEvent(
      makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
        sessionId: 'session_1',
        surface: 'chat',
      }),
    );
    session.processEvent(
      makeEvent<OrchestratorCancelledEvent>('orchestrator:cancelled', {
        reason: 'User cancelled',
      }),
    );
    expect(session.getState().status).toBe('idle');
  });

  it('agent:stream-delta → streaming with appended content', () => {
    session.processEvent(
      makeEvent<AgentStreamDeltaEvent>('agent:stream-delta', {
        delta: 'Hello ',
      }),
    );
    expect(session.getState().status).toBe('streaming');
    expect(session.getState().messages).toHaveLength(1);
    expect(session.getState().messages[0].content).toBe('Hello ');
    expect(session.getState().messages[0].streaming).toBe(true);

    session.processEvent(
      makeEvent<AgentStreamDeltaEvent>('agent:stream-delta', {
        delta: 'world!',
      }),
    );
    expect(session.getState().messages).toHaveLength(1);
    expect(session.getState().messages[0].content).toBe('Hello world!');
  });

  it('agent:tool-call → tool-executing', () => {
    session.processEvent(
      makeEvent<AgentToolCallEvent>('agent:tool-call', {
        toolName: 'file_read',
        args: { path: '/test' },
        toolCallId: 'tc_1',
      }),
    );
    const state = session.getState();
    expect(state.status).toBe('tool-executing');
    expect(state.currentToolCalls).toHaveLength(1);
    expect(state.currentToolCalls[0].name).toBe('file_read');
    expect(state.currentToolCalls[0].status).toBe('running');
  });

  it('agent:tool-result → updates tool call status', () => {
    session.processEvent(
      makeEvent<AgentToolCallEvent>('agent:tool-call', {
        toolName: 'file_read',
        args: { path: '/test' },
        toolCallId: 'tc_1',
      }),
    );
    session.processEvent(
      makeEvent<AgentToolResultEvent>('agent:tool-result', {
        toolName: 'file_read',
        toolCallId: 'tc_1',
        success: true,
        result: 'file content',
        durationMs: 50,
      }),
    );
    const state = session.getState();
    expect(state.status).toBe('thinking');
    expect(state.currentToolCalls[0].status).toBe('completed');
    expect(state.currentToolCalls[0].result).toBe('file content');
    expect(state.currentToolCalls[0].durationMs).toBe(50);
  });

  it('agent:tool-result with error → error status on tool call', () => {
    session.processEvent(
      makeEvent<AgentToolCallEvent>('agent:tool-call', {
        toolName: 'file_read',
        args: {},
        toolCallId: 'tc_2',
      }),
    );
    session.processEvent(
      makeEvent<AgentToolResultEvent>('agent:tool-result', {
        toolName: 'file_read',
        toolCallId: 'tc_2',
        success: false,
        result: 'not found',
        durationMs: 10,
      }),
    );
    expect(session.getState().currentToolCalls[0].status).toBe('error');
  });

  it('multiple tool calls: still tool-executing while some are running', () => {
    session.processEvent(
      makeEvent<AgentToolCallEvent>('agent:tool-call', {
        toolName: 'file_read',
        args: {},
        toolCallId: 'tc_a',
      }),
    );
    session.processEvent(
      makeEvent<AgentToolCallEvent>('agent:tool-call', {
        toolName: 'file_write',
        args: {},
        toolCallId: 'tc_b',
      }),
    );
    // Complete only the first
    session.processEvent(
      makeEvent<AgentToolResultEvent>('agent:tool-result', {
        toolName: 'file_read',
        toolCallId: 'tc_a',
        success: true,
        result: 'ok',
        durationMs: 10,
      }),
    );
    expect(session.getState().status).toBe('tool-executing');

    // Complete the second
    session.processEvent(
      makeEvent<AgentToolResultEvent>('agent:tool-result', {
        toolName: 'file_write',
        toolCallId: 'tc_b',
        success: true,
        result: 'ok',
        durationMs: 20,
      }),
    );
    expect(session.getState().status).toBe('thinking');
  });

  it('safety:approval-required → waiting-approval', () => {
    session.processEvent(
      makeEvent<SafetyApprovalRequiredEvent>('safety:approval-required', {
        capabilityName: 'file_delete',
        tier: 'destructive',
        reason: 'Deleting files requires approval',
      }),
    );
    expect(session.getState().status).toBe('waiting-approval');
  });

  it('agent:iteration → updates tokenUsage', () => {
    session.processEvent(
      makeEvent<AgentIterationEvent>('agent:iteration', {
        iteration: 1,
        maxIterations: 10,
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    );
    const usage = session.getState().tokenUsage;
    expect(usage.prompt).toBe(100);
    expect(usage.completion).toBe(50);
    expect(usage.total).toBe(150);
  });

  it('agent:completed finalizes streaming message', () => {
    session.processEvent(
      makeEvent<AgentStreamDeltaEvent>('agent:stream-delta', { delta: 'Hello' }),
    );
    expect(session.getState().messages[0].streaming).toBe(true);

    session.processEvent(
      makeEvent<AgentCompletedEvent>('agent:completed', {
        domain: 'test',
        responseContent: 'Hello',
        totalTokens: 100,
        totalDurationMs: 200,
      }),
    );
    expect(session.getState().messages[0].streaming).toBe(false);
  });

  it('agent:completed adds message if none streaming', () => {
    session.processEvent(
      makeEvent<AgentCompletedEvent>('agent:completed', {
        domain: 'test',
        responseContent: 'Full response',
        totalTokens: 100,
        totalDurationMs: 200,
      }),
    );
    expect(session.getState().messages).toHaveLength(1);
    expect(session.getState().messages[0].content).toBe('Full response');
    expect(session.getState().messages[0].streaming).toBe(false);
  });

  it('agent:error → error status', () => {
    session.processEvent(
      makeEvent<AgentErrorEvent>('agent:error', {
        domain: 'test',
        error: 'LLM timeout',
      }),
    );
    const state = session.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('LLM timeout');
  });

  it('orchestrator:routed → sets activeAgent', () => {
    session.processEvent(
      makeEvent<OrchestratorRoutedEvent>('orchestrator:routed', {
        domain: 'writing',
        reason: 'keyword match',
      }),
    );
    expect(session.getState().activeAgent).toBe('writing');
  });

  it('agent:started → sets activeAgent', () => {
    session.processEvent(
      makeEvent<AgentStartedEvent>('agent:started', {
        domain: 'coding',
        model: 'gpt-4o',
      }),
    );
    expect(session.getState().activeAgent).toBe('coding');
  });

  it('processes events from the event bus automatically', () => {
    bus.emit(
      makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
        sessionId: 'session_1',
        surface: 'chat',
      }),
    );
    // Event bus listener fires processEvent on the session
    expect(session.getState().status).toBe('thinking');
  });

  it('destroy detaches from event bus', () => {
    session.destroy();
    bus.emit(
      makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
        sessionId: 'session_1',
        surface: 'chat',
      }),
    );
    // Should remain idle since we detached
    expect(session.getState().status).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// InMemoryTransport
// ---------------------------------------------------------------------------

describe('InMemoryTransport', () => {
  let transport: InMemoryTransport;

  beforeEach(() => {
    transport = new InMemoryTransport();
  });

  it('send records messages', () => {
    const msg: BackendMessage = { type: 'session:created', sessionId: 's1' };
    transport.send(msg);
    expect(transport.sentMessages).toHaveLength(1);
    expect(transport.sentMessages[0]).toEqual(msg);
  });

  it('onMessage receives simulated messages', () => {
    const received: FrontendMessage[] = [];
    transport.onMessage((msg) => received.push(msg));

    transport.simulateMessage({ type: 'session:list' });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('session:list');
  });

  it('onMessage unsubscribe stops delivery', () => {
    const received: FrontendMessage[] = [];
    const unsub = transport.onMessage((msg) => received.push(msg));

    transport.simulateMessage({ type: 'session:list' });
    unsub();
    transport.simulateMessage({ type: 'health:check' });

    expect(received).toHaveLength(1);
  });

  it('multiple handlers receive the same message', () => {
    const received1: FrontendMessage[] = [];
    const received2: FrontendMessage[] = [];
    transport.onMessage((msg) => received1.push(msg));
    transport.onMessage((msg) => received2.push(msg));

    transport.simulateMessage({ type: 'health:check' });
    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// IPC Protocol – type-check
// ---------------------------------------------------------------------------

describe('IPC Protocol types', () => {
  it('FrontendMessage discriminates on type', () => {
    const msg: FrontendMessage = {
      type: 'agent:send',
      sessionId: 's1',
      content: 'Hello',
    };
    expect(msg.type).toBe('agent:send');
    if (msg.type === 'agent:send') {
      expect(msg.content).toBe('Hello');
      expect(msg.sessionId).toBe('s1');
    }
  });

  it('BackendMessage discriminates on type', () => {
    const msg: BackendMessage = {
      type: 'error',
      message: 'Something went wrong',
    };
    expect(msg.type).toBe('error');
    if (msg.type === 'error') {
      expect(msg.message).toBe('Something went wrong');
    }
  });

  it('all FrontendMessage variants are valid', () => {
    const variants: FrontendMessage[] = [
      { type: 'agent:send', sessionId: 's1', content: 'Hi' },
      { type: 'agent:cancel', sessionId: 's1' },
      { type: 'agent:approve', requestId: 'r1', approved: true },
      { type: 'agent:retry', sessionId: 's1' },
      { type: 'agent:fork', sessionId: 's1' },
      { type: 'session:create', surface: 'chat' },
      { type: 'session:list' },
      { type: 'health:check' },
      { type: 'devtools:get-trace', traceId: 't1' },
      { type: 'devtools:get-metrics' },
      { type: 'devtools:get-logs', filter: { level: 'error' } },
    ];
    expect(variants).toHaveLength(11);
  });

  it('all BackendMessage variants are valid', () => {
    const event = makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
      sessionId: 's1',
      surface: 'chat',
    });
    const variants: BackendMessage[] = [
      { type: 'agent:event', event },
      { type: 'session:created', sessionId: 's1' },
      { type: 'session:list-result', sessions: [{ id: 's1', surface: 'chat', createdAt: 0 }] },
      { type: 'health:result', status: 'healthy', checks: [] },
      { type: 'devtools:trace-result', spans: [] },
      { type: 'devtools:metrics-result', metrics: {} },
      { type: 'devtools:logs-result', entries: [] },
      { type: 'error', message: 'fail' },
    ];
    expect(variants).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// AgentBridge
// ---------------------------------------------------------------------------

describe('AgentBridge', () => {
  let transport: InMemoryTransport;
  let bridge: AgentBridge;

  beforeEach(() => {
    transport = new InMemoryTransport();
    bridge = new AgentBridge(transport);
    bridge.start();
  });

  afterEach(() => {
    bridge.stop();
  });

  it('handles session:create', async () => {
    await bridge.handleMessage({ type: 'session:create', surface: 'chat' });

    expect(transport.sentMessages).toHaveLength(1);
    expect(transport.sentMessages[0].type).toBe('session:created');
    if (transport.sentMessages[0].type === 'session:created') {
      const sessionId = transport.sentMessages[0].sessionId;
      expect(sessionId).toBeTruthy();
      expect(bridge.getSession(sessionId)).toBeDefined();
    }
  });

  it('handles session:list', async () => {
    await bridge.handleMessage({ type: 'session:create', surface: 'chat' });
    await bridge.handleMessage({ type: 'session:create', surface: 'editor' });
    await bridge.handleMessage({ type: 'session:list' });

    const listMsg = transport.sentMessages.find((m) => m.type === 'session:list-result');
    expect(listMsg).toBeDefined();
    if (listMsg?.type === 'session:list-result') {
      expect(listMsg.sessions).toHaveLength(2);
    }
  });

  it('handles agent:send with no orchestrator → error', async () => {
    await bridge.handleMessage({ type: 'session:create', surface: 'chat' });
    const sessionId = (transport.sentMessages[0] as any).sessionId;

    await bridge.handleMessage({ type: 'agent:send', sessionId, content: 'Hello' });

    const errMsg = transport.sentMessages.find((m) => m.type === 'error');
    expect(errMsg).toBeDefined();
    if (errMsg?.type === 'error') {
      expect(errMsg.message).toContain('No orchestrator');
    }
  });

  it('handles agent:send with unknown session → error', async () => {
    await bridge.handleMessage({ type: 'agent:send', sessionId: 'unknown', content: 'Hello' });

    const errMsg = transport.sentMessages.find((m) => m.type === 'error');
    expect(errMsg).toBeDefined();
    if (errMsg?.type === 'error') {
      expect(errMsg.message).toContain('not found');
    }
  });

  it('handles agent:cancel', async () => {
    // Should not throw
    await bridge.handleMessage({ type: 'agent:cancel', sessionId: 's1' });
  });

  it('handles agent:approve', async () => {
    // Should not throw
    await bridge.handleMessage({ type: 'agent:approve', requestId: 'r1', approved: true });
  });

  it('handles agent:retry resets session', async () => {
    await bridge.handleMessage({ type: 'session:create', surface: 'chat' });
    const sessionId = (transport.sentMessages[0] as any).sessionId;

    const session = bridge.getSession(sessionId)!;
    session.processEvent(
      makeEvent<OrchestratorErrorEvent>('orchestrator:error', { error: 'fail' }),
    );
    expect(session.getState().status).toBe('error');

    await bridge.handleMessage({ type: 'agent:retry', sessionId });
    expect(session.getState().status).toBe('idle');
  });

  it('handles agent:fork creates new session', async () => {
    await bridge.handleMessage({ type: 'session:create', surface: 'chat' });
    const sessionId = (transport.sentMessages[0] as any).sessionId;

    const session = bridge.getSession(sessionId)!;
    session.addUserMessage('Hello');

    await bridge.handleMessage({ type: 'agent:fork', sessionId });

    // Should have two session:created messages
    const createdMessages = transport.sentMessages.filter((m) => m.type === 'session:created');
    expect(createdMessages).toHaveLength(2);
  });

  it('handles health:check with no healthChecker', async () => {
    await bridge.handleMessage({ type: 'health:check' });

    const result = transport.sentMessages.find((m) => m.type === 'health:result');
    expect(result).toBeDefined();
    if (result?.type === 'health:result') {
      expect(result.status).toBe('unknown');
    }
  });

  it('handles health:check with healthChecker', async () => {
    const hc = new HealthChecker();
    hc.register(new ProviderHealthCheck('test-provider', async () => true));

    bridge.stop();
    bridge = new AgentBridge(transport, { healthChecker: hc });
    bridge.start();
    transport.sentMessages.length = 0;

    await bridge.handleMessage({ type: 'health:check' });

    const result = transport.sentMessages.find((m) => m.type === 'health:result');
    expect(result).toBeDefined();
    if (result?.type === 'health:result') {
      expect(result.status).toBe('healthy');
      expect(result.checks.length).toBeGreaterThan(0);
    }
  });

  it('handles devtools:get-trace with no tracer', async () => {
    await bridge.handleMessage({ type: 'devtools:get-trace', traceId: 't1' });

    const result = transport.sentMessages.find((m) => m.type === 'devtools:trace-result');
    expect(result).toBeDefined();
    if (result?.type === 'devtools:trace-result') {
      expect(result.spans).toHaveLength(0);
    }
  });

  it('handles devtools:get-trace with tracer', async () => {
    const exporter = new InMemoryExporter();
    const tracer = new Tracer([exporter]);
    const span = tracer.startSpan('test-op', 'agent');
    const traceId = span.context.traceId;
    span.end();

    bridge.stop();
    bridge = new AgentBridge(transport, { tracer });
    bridge.start();
    transport.sentMessages.length = 0;

    await bridge.handleMessage({ type: 'devtools:get-trace', traceId });

    const result = transport.sentMessages.find((m) => m.type === 'devtools:trace-result');
    expect(result).toBeDefined();
    if (result?.type === 'devtools:trace-result') {
      expect(result.spans.length).toBeGreaterThan(0);
    }
  });

  it('handles devtools:get-metrics with no metrics', async () => {
    await bridge.handleMessage({ type: 'devtools:get-metrics' });

    const result = transport.sentMessages.find((m) => m.type === 'devtools:metrics-result');
    expect(result).toBeDefined();
    if (result?.type === 'devtools:metrics-result') {
      expect(result.metrics).toEqual({});
    }
  });

  it('handles devtools:get-metrics with metrics', async () => {
    const metrics = new AgentMetrics();
    metrics.llmRequestsTotal.inc({ provider: 'openai' });

    bridge.stop();
    bridge = new AgentBridge(transport, { metrics });
    bridge.start();
    transport.sentMessages.length = 0;

    await bridge.handleMessage({ type: 'devtools:get-metrics' });

    const result = transport.sentMessages.find((m) => m.type === 'devtools:metrics-result');
    expect(result).toBeDefined();
    if (result?.type === 'devtools:metrics-result') {
      expect(Object.keys(result.metrics).length).toBeGreaterThan(0);
    }
  });

  it('handles devtools:get-logs with no logTransport', async () => {
    await bridge.handleMessage({ type: 'devtools:get-logs' });

    const result = transport.sentMessages.find((m) => m.type === 'devtools:logs-result');
    expect(result).toBeDefined();
    if (result?.type === 'devtools:logs-result') {
      expect(result.entries).toHaveLength(0);
    }
  });

  it('handles devtools:get-logs with logTransport', async () => {
    const logTransport = new BufferLogTransport();
    const logger = new Logger('test', { transports: [logTransport] });
    logger.info('Test log message');

    bridge.stop();
    bridge = new AgentBridge(transport, { logTransport });
    bridge.start();
    transport.sentMessages.length = 0;

    await bridge.handleMessage({ type: 'devtools:get-logs' });

    const result = transport.sentMessages.find((m) => m.type === 'devtools:logs-result');
    expect(result).toBeDefined();
    if (result?.type === 'devtools:logs-result') {
      expect(result.entries.length).toBeGreaterThan(0);
    }
  });

  it('forwards agent events to transport', () => {
    const eventBus = bridge.getEventBus();
    transport.sentMessages.length = 0;

    const event = makeEvent<OrchestratorStartedEvent>('orchestrator:started', {
      sessionId: 's1',
      surface: 'chat',
    });
    eventBus.emit(event);

    const agentEvent = transport.sentMessages.find((m) => m.type === 'agent:event');
    expect(agentEvent).toBeDefined();
    if (agentEvent?.type === 'agent:event') {
      expect(agentEvent.event.type).toBe('orchestrator:started');
    }
  });

  it('stop cleans up resources', () => {
    bridge.stop();
    // After stop, getSession should return undefined for any ID
    expect(bridge.getSession('any')).toBeUndefined();
  });

  it('handles messages via transport.simulateMessage', async () => {
    // Simulate a message through the transport (integration test)
    transport.simulateMessage({ type: 'session:create', surface: 'inline' });

    // Need to wait for async handler
    await new Promise((resolve) => setTimeout(resolve, 10));

    const created = transport.sentMessages.find((m) => m.type === 'session:created');
    expect(created).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// afterEach import (needed for cleanup in AgentBridge tests above)
// ---------------------------------------------------------------------------

import { afterEach } from 'vitest';
