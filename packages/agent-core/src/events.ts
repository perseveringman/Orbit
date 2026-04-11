// ---------------------------------------------------------------------------
// @orbit/agent-core – Event type hierarchy (M1)
// ---------------------------------------------------------------------------

// ---- Base event ----

export interface BaseEvent {
  readonly type: string;
  readonly runId: string;
  readonly timestamp: number;
}

// ---- Capability (Tool) Events ----

export interface CapabilityStartedEvent extends BaseEvent {
  readonly type: 'capability:started';
  readonly capabilityName: string;
  readonly args: Record<string, unknown>;
}

export interface CapabilityProgressEvent extends BaseEvent {
  readonly type: 'capability:progress';
  readonly capabilityName: string;
  readonly progress: number; // 0-1
  readonly message?: string;
}

export interface CapabilityCompletedEvent extends BaseEvent {
  readonly type: 'capability:completed';
  readonly capabilityName: string;
  readonly result: string;
  readonly durationMs: number;
}

export interface CapabilityErrorEvent extends BaseEvent {
  readonly type: 'capability:error';
  readonly capabilityName: string;
  readonly error: string;
  readonly durationMs: number;
}

export type CapabilityEvent =
  | CapabilityStartedEvent
  | CapabilityProgressEvent
  | CapabilityCompletedEvent
  | CapabilityErrorEvent;

// ---- Safety Events ----

export interface SafetyCheckPassedEvent extends BaseEvent {
  readonly type: 'safety:check-passed';
  readonly capabilityName: string;
  readonly tier: string;
}

export interface SafetyApprovalRequiredEvent extends BaseEvent {
  readonly type: 'safety:approval-required';
  readonly capabilityName: string;
  readonly tier: string;
  readonly reason: string;
}

export interface SafetyBlockedEvent extends BaseEvent {
  readonly type: 'safety:blocked';
  readonly capabilityName: string;
  readonly reason: string;
  readonly threats: readonly string[];
}

export type SafetyEvent =
  | SafetyCheckPassedEvent
  | SafetyApprovalRequiredEvent
  | SafetyBlockedEvent;

// ---- Compression Events ----

export interface CompressionStartedEvent extends BaseEvent {
  readonly type: 'compression:started';
  readonly originalTokens: number;
}

export interface CompressionCompletedEvent extends BaseEvent {
  readonly type: 'compression:completed';
  readonly originalTokens: number;
  readonly compressedTokens: number;
  readonly ratio: number;
}

export type CompressionEvent =
  | CompressionStartedEvent
  | CompressionCompletedEvent;

// ---- Agent Events ----

export interface AgentStartedEvent extends BaseEvent {
  readonly type: 'agent:started';
  readonly domain: string;
  readonly model: string;
}

export interface AgentReasoningEvent extends BaseEvent {
  readonly type: 'agent:reasoning';
  readonly content: string;
}

export interface AgentStreamDeltaEvent extends BaseEvent {
  readonly type: 'agent:stream-delta';
  readonly delta: string;
}

export interface AgentToolCallEvent extends BaseEvent {
  readonly type: 'agent:tool-call';
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly toolCallId: string;
}

export interface AgentToolResultEvent extends BaseEvent {
  readonly type: 'agent:tool-result';
  readonly toolName: string;
  readonly toolCallId: string;
  readonly success: boolean;
  readonly result: string;
  readonly durationMs: number;
}

export interface AgentIterationEvent extends BaseEvent {
  readonly type: 'agent:iteration';
  readonly iteration: number;
  readonly maxIterations: number;
  readonly tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface AgentCompletedEvent extends BaseEvent {
  readonly type: 'agent:completed';
  readonly domain: string;
  readonly responseContent: string;
  readonly totalTokens: number;
  readonly totalDurationMs: number;
}

export interface AgentErrorEvent extends BaseEvent {
  readonly type: 'agent:error';
  readonly domain: string;
  readonly error: string;
}

export type AgentEvent =
  | AgentStartedEvent
  | AgentReasoningEvent
  | AgentStreamDeltaEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | AgentIterationEvent
  | AgentCompletedEvent
  | AgentErrorEvent;

// ---- Orchestrator Events ----

export interface OrchestratorStartedEvent extends BaseEvent {
  readonly type: 'orchestrator:started';
  readonly sessionId: string;
  readonly surface: string;
}

export interface OrchestratorRoutedEvent extends BaseEvent {
  readonly type: 'orchestrator:routed';
  readonly domain: string;
  readonly reason: string;
}

export interface OrchestratorDelegatedEvent extends BaseEvent {
  readonly type: 'orchestrator:delegated';
  readonly targetDomain: string;
  readonly task: string;
  readonly childRunId: string;
}

export interface OrchestratorCompletedEvent extends BaseEvent {
  readonly type: 'orchestrator:completed';
  readonly sessionId: string;
  readonly totalTokens: number;
  readonly totalDurationMs: number;
}

export interface OrchestratorErrorEvent extends BaseEvent {
  readonly type: 'orchestrator:error';
  readonly error: string;
}

export interface OrchestratorCancelledEvent extends BaseEvent {
  readonly type: 'orchestrator:cancelled';
  readonly reason: string;
}

export type OrchestratorEvent =
  | OrchestratorStartedEvent
  | OrchestratorRoutedEvent
  | OrchestratorDelegatedEvent
  | OrchestratorCompletedEvent
  | OrchestratorErrorEvent
  | OrchestratorCancelledEvent;

// ---- Union of all events ----

export type OrbitAgentEvent =
  | CapabilityEvent
  | SafetyEvent
  | CompressionEvent
  | AgentEvent
  | OrchestratorEvent;

// ---- Type guards ----

export function isCapabilityEvent(e: OrbitAgentEvent): e is CapabilityEvent {
  return e.type.startsWith('capability:');
}

export function isSafetyEvent(e: OrbitAgentEvent): e is SafetyEvent {
  return e.type.startsWith('safety:');
}

export function isCompressionEvent(e: OrbitAgentEvent): e is CompressionEvent {
  return e.type.startsWith('compression:');
}

export function isAgentEvent(e: OrbitAgentEvent): e is AgentEvent {
  return e.type.startsWith('agent:');
}

export function isOrchestratorEvent(e: OrbitAgentEvent): e is OrchestratorEvent {
  return e.type.startsWith('orchestrator:');
}

// ---- Event factory ----

export function createEvent<T extends OrbitAgentEvent>(
  type: T['type'],
  runId: string,
  fields: Omit<T, 'type' | 'runId' | 'timestamp'>,
): T {
  return Object.assign({}, fields, {
    type,
    runId,
    timestamp: Date.now(),
  }) as T;
}
