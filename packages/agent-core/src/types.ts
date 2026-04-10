// ---------------------------------------------------------------------------
// @orbit/agent-core – Type definitions
// ---------------------------------------------------------------------------

// ---- ID generation (no platform deps) ----

let _counter = 0;

export function generateId(prefix = 'id'): string {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter.toString(36)}`;
}

// ---- Message types ----

export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export interface AgentMessage {
  readonly id: string;
  readonly role: AgentRole;
  readonly content: string;
  readonly toolCalls?: readonly AgentToolCall[];
  readonly toolCallId?: string;
  readonly timestamp: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ---- Domain types ----

export const AGENT_DOMAINS = [
  'planning',
  'reading',
  'research',
  'writing',
  'review',
  'graph',
  'ops',
] as const;
export type AgentDomain = (typeof AGENT_DOMAINS)[number];

// ---- Surface types ----

export const AGENT_SURFACES = [
  'project',
  'reader',
  'research',
  'writing',
  'journal',
  'task-center',
  'global-chat',
] as const;
export type AgentSurface = (typeof AGENT_SURFACES)[number];

// ---- Risk levels ----

export const RISK_LEVELS = [
  'R0-read',
  'R1-internal-write',
  'R2-external-read',
  'R3-external-write',
] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

// ---- Approval policies ----

export const APPROVAL_POLICIES = [
  'A0-auto',
  'A1-transparent',
  'A2-confirm',
  'A3-dual-confirm',
] as const;
export type ApprovalPolicy = (typeof APPROVAL_POLICIES)[number];

// ---- Execution modes ----

export const EXECUTION_MODES = ['sync', 'async', 'resumable'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

// ---- Scope limits ----

export const SCOPE_LIMITS = [
  'current-object',
  'current-space',
  'current-project',
  'workspace',
  'global',
] as const;
export type ScopeLimit = (typeof SCOPE_LIMITS)[number];

// ---- Data boundaries ----

export const DATA_BOUNDARIES = [
  'local-only',
  'can-egress',
  'sensitive-redact',
] as const;
export type DataBoundary = (typeof DATA_BOUNDARIES)[number];

// ---- Session lineage ----

export const LINEAGE_TYPES = [
  'continues_from',
  'delegated_from',
  'spawned_by_object',
  'blocked_by_approval',
  'resumed_from_job',
  'compressed_into',
] as const;
export type LineageType = (typeof LINEAGE_TYPES)[number];

export interface SessionLineage {
  readonly type: LineageType;
  readonly sourceId: string;
}

// ---- Session status ----

export const SESSION_STATUSES = ['active', 'paused', 'completed', 'failed'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface AgentSession {
  readonly id: string;
  readonly workspaceId: string;
  readonly surface: AgentSurface;
  readonly anchorObjectIds: readonly string[];
  readonly lineage: readonly SessionLineage[];
  readonly status: SessionStatus;
  readonly messages: readonly AgentMessage[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---- Run model ----

export const RUN_STATUSES = [
  'running',
  'completed',
  'failed',
  'cancelled',
  'awaiting-approval',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface AgentRun {
  readonly id: string;
  readonly sessionId: string;
  readonly agentDomain: AgentDomain | 'orchestrator';
  readonly model: string;
  readonly status: RunStatus;
  readonly tokenUsage: TokenUsage;
  readonly steps: readonly AgentStep[];
  readonly createdAt: string;
  readonly completedAt?: string;
}

// ---- Step model ----

export const STEP_KINDS = [
  'reasoning',
  'tool-call',
  'tool-result',
  'delegation',
  'approval-wait',
  'summary',
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export interface AgentStep {
  readonly id: string;
  readonly runId: string;
  readonly kind: StepKind;
  readonly content: string;
  readonly toolName?: string;
  readonly toolArgs?: string;
  readonly toolResult?: string;
  readonly delegatedAgentDomain?: AgentDomain;
  readonly approvalRequestId?: string;
  readonly timestamp: string;
}

// ---- Tool definition ----

export interface ToolDefinition {
  readonly name: string;
  readonly domain: AgentDomain;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly riskLevel: RiskLevel;
  readonly approvalPolicy: ApprovalPolicy;
  readonly executionMode: ExecutionMode;
  readonly scopeLimit: ScopeLimit;
  readonly dataBoundary: DataBoundary;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

// ---- Memory types ----

export const MEMORY_LAYERS = [
  'L0-turn',
  'L1-session',
  'L2-object',
  'L3-user-longterm',
  'L4-procedural',
  'L5-archive',
] as const;
export type MemoryLayer = (typeof MEMORY_LAYERS)[number];

export interface MemoryEntry {
  readonly id: string;
  readonly layer: MemoryLayer;
  readonly content: string;
  readonly sourceObjectId?: string;
  readonly sourceSessionId?: string;
  readonly confidence: number;
  readonly expiresAt?: string;
  readonly createdAt: string;
}

// ---- Approval request ----

export interface ApprovalRequest {
  readonly id: string;
  readonly runId: string;
  readonly capabilityName: string;
  readonly riskLevel: RiskLevel;
  readonly policy: ApprovalPolicy;
  readonly reason: string;
  readonly impactSummary: string;
  readonly status: 'pending' | 'approved' | 'rejected' | 'expired';
  readonly createdAt: string;
  readonly resolvedAt?: string;
}

// ---- LLM adapter types ----

export interface ChatCompletionRequest {
  readonly model: string;
  readonly messages: readonly AgentMessage[];
  readonly tools?: readonly ToolDefinition[];
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface ChatCompletionChoice {
  readonly message: AgentMessage;
  readonly finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface ChatCompletionResponse {
  readonly id: string;
  readonly choices: readonly ChatCompletionChoice[];
  readonly usage: TokenUsage;
}

// ---- Orchestrator config ----

export interface OrchestratorConfig {
  readonly defaultModel: string;
  readonly maxIterations: number;
  readonly maxConcurrentDelegations: number;
  readonly maxDelegationDepth: number;
  readonly compressionThreshold: number;
}

// ---- Domain agent config ----

export interface DomainAgentConfig {
  readonly domain: AgentDomain;
  readonly systemPrompt: string;
  readonly allowedCapabilities: readonly string[];
  readonly blockedCapabilities: readonly string[];
  readonly maxIterations: number;
  readonly model?: string;
}
