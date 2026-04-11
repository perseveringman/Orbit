// ---------------------------------------------------------------------------
// @orbit/agent-core – Agent Bridge (M10)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { OrbitAgentEvent } from '../events.js';
import type { MultiAgentOrchestrator } from '../orchestration/multi-agent-orchestrator.js';
import type { HealthChecker } from '../observability/health-checker.js';
import type { Tracer } from '../observability/tracer.js';
import type { AgentMetrics } from '../observability/metrics.js';
import type { Logger, BufferLogTransport } from '../observability/logger.js';
import { EventBus } from './event-bus.js';
import { AgentSessionState } from './agent-session-state.js';
import type { MessageTransport, FrontendMessage, BackendMessage } from './ipc-protocol.js';
import type { Unsubscribe } from './event-bus.js';

// ---- Options ----

export interface AgentBridgeOptions {
  readonly orchestrator?: MultiAgentOrchestrator;
  readonly healthChecker?: HealthChecker;
  readonly tracer?: Tracer;
  readonly metrics?: AgentMetrics;
  readonly logger?: Logger;
  readonly logTransport?: BufferLogTransport;
}

// ---- Session record ----

interface SessionRecord {
  readonly id: string;
  readonly surface: string;
  readonly createdAt: number;
  readonly state: AgentSessionState;
}

// ---- AgentBridge ----

export class AgentBridge {
  private readonly transport: MessageTransport;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly eventBus: EventBus;
  private readonly options: AgentBridgeOptions;
  private transportUnsub: Unsubscribe | undefined;
  private eventBusUnsub: Unsubscribe | undefined;

  constructor(transport: MessageTransport, options?: AgentBridgeOptions) {
    this.transport = transport;
    this.eventBus = new EventBus();
    this.options = options ?? {};
  }

  /**
   * Start listening for frontend messages and forwarding agent events.
   */
  start(): void {
    // Forward all agent events to the frontend transport
    this.eventBusUnsub = this.eventBus.onAny((event) => {
      this.transport.send({ type: 'agent:event', event });
    });

    // Listen for frontend messages
    this.transportUnsub = this.transport.onMessage((message) => {
      void this.handleMessage(message);
    });
  }

  /**
   * Handle an incoming frontend message.
   */
  async handleMessage(message: FrontendMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'session:create':
          this.handleSessionCreate(message.surface);
          break;

        case 'session:list':
          this.handleSessionList();
          break;

        case 'agent:send':
          await this.handleAgentSend(message.sessionId, message.content);
          break;

        case 'agent:cancel':
          this.handleAgentCancel(message.sessionId);
          break;

        case 'agent:approve':
          this.handleAgentApprove(message.requestId, message.approved);
          break;

        case 'agent:retry':
          this.handleAgentRetry(message.sessionId);
          break;

        case 'agent:fork':
          this.handleAgentFork(message.sessionId);
          break;

        case 'health:check':
          await this.handleHealthCheck();
          break;

        case 'devtools:get-trace':
          this.handleGetTrace(message.traceId);
          break;

        case 'devtools:get-metrics':
          this.handleGetMetrics();
          break;

        case 'devtools:get-logs':
          this.handleGetLogs(message.filter);
          break;

        default:
          this.sendError(`Unknown message type: ${(message as any).type}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.sendError(errorMessage);
    }
  }

  /**
   * Get session state by session ID.
   */
  getSession(sessionId: string): AgentSessionState | undefined {
    return this.sessions.get(sessionId)?.state;
  }

  /**
   * Get the event bus used by this bridge.
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Stop the bridge and clean up all resources.
   */
  stop(): void {
    this.transportUnsub?.();
    this.eventBusUnsub?.();
    for (const record of this.sessions.values()) {
      record.state.destroy();
    }
    this.sessions.clear();
    this.eventBus.clear();
  }

  // ---- Message handlers ----

  private handleSessionCreate(surface: string): void {
    const sessionId = generateId('session');
    const state = new AgentSessionState(sessionId, this.eventBus);
    this.sessions.set(sessionId, {
      id: sessionId,
      surface,
      createdAt: Date.now(),
      state,
    });
    this.transport.send({ type: 'session:created', sessionId });
  }

  private handleSessionList(): void {
    const sessions = [...this.sessions.values()].map((r) => ({
      id: r.id,
      surface: r.surface,
      createdAt: r.createdAt,
    }));
    this.transport.send({ type: 'session:list-result', sessions });
  }

  private async handleAgentSend(sessionId: string, content: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) {
      this.sendError(`Session "${sessionId}" not found`);
      return;
    }

    record.state.addUserMessage(content);

    if (!this.options.orchestrator) {
      this.sendError('No orchestrator configured');
      return;
    }

    // Stream events from the orchestrator through the event bus
    const stream = this.options.orchestrator.executeStream(content);
    for await (const event of stream) {
      this.eventBus.emit(event);
    }
  }

  private handleAgentCancel(_sessionId: string): void {
    // Cancel is a best-effort operation. Without an AbortController reference,
    // we emit a cancelled event so the UI can update.
    this.options.logger?.info('Agent cancel requested', { sessionId: _sessionId });
  }

  private handleAgentApprove(_requestId: string, _approved: boolean): void {
    this.options.logger?.info('Approval response', {
      requestId: _requestId,
      approved: _approved,
    });
  }

  private handleAgentRetry(sessionId: string): void {
    const record = this.sessions.get(sessionId);
    if (!record) {
      this.sendError(`Session "${sessionId}" not found`);
      return;
    }
    // Reset the session error state
    record.state.reset();
  }

  private handleAgentFork(sessionId: string): void {
    const record = this.sessions.get(sessionId);
    if (!record) {
      this.sendError(`Session "${sessionId}" not found`);
      return;
    }

    const newSessionId = generateId('session');
    const newState = new AgentSessionState(newSessionId, this.eventBus);

    // Copy messages from the original session
    const originalState = record.state.getState();
    for (const msg of originalState.messages) {
      if (msg.role === 'user') {
        newState.addUserMessage(msg.content);
      }
    }

    this.sessions.set(newSessionId, {
      id: newSessionId,
      surface: record.surface,
      createdAt: Date.now(),
      state: newState,
    });

    this.transport.send({ type: 'session:created', sessionId: newSessionId });
  }

  private async handleHealthCheck(): Promise<void> {
    if (!this.options.healthChecker) {
      this.transport.send({
        type: 'health:result',
        status: 'unknown',
        checks: [],
      });
      return;
    }

    const result = await this.options.healthChecker.runAll();
    this.transport.send({
      type: 'health:result',
      status: result.overallStatus,
      checks: result.results.map((r) => ({
        name: r.name,
        status: r.status,
        message: r.message,
        durationMs: r.durationMs,
      })),
    });
  }

  private handleGetTrace(traceId: string): void {
    if (!this.options.tracer) {
      this.transport.send({ type: 'devtools:trace-result', spans: [] });
      return;
    }

    const spans = this.options.tracer.getTraceSpans(traceId);
    this.transport.send({
      type: 'devtools:trace-result',
      spans: spans.map((s) => ({
        traceId: s.context.traceId,
        spanId: s.context.spanId,
        parentSpanId: s.context.parentSpanId,
        name: s.name,
        kind: s.kind,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        attributes: s.attributes,
      })),
    });
  }

  private handleGetMetrics(): void {
    if (!this.options.metrics) {
      this.transport.send({ type: 'devtools:metrics-result', metrics: {} });
      return;
    }

    this.transport.send({
      type: 'devtools:metrics-result',
      metrics: this.options.metrics.snapshot(),
    });
  }

  private handleGetLogs(filter?: Record<string, unknown>): void {
    if (!this.options.logTransport) {
      this.transport.send({ type: 'devtools:logs-result', entries: [] });
      return;
    }

    const logFilter = filter
      ? {
          level: filter['level'] as string | undefined,
          module: filter['module'] as string | undefined,
          traceId: filter['traceId'] as string | undefined,
        }
      : undefined;

    const entries = this.options.logTransport.getEntries(logFilter as any);
    this.transport.send({
      type: 'devtools:logs-result',
      entries: entries.map((e) => ({ ...e })),
    });
  }

  private sendError(message: string): void {
    this.transport.send({ type: 'error', message });
  }
}
