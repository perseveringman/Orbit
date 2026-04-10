import type { IsoDateTimeString } from './common.js';

// ── Shared agent enums ─────────────────────────────────────

export type RiskLevel = 'R0-read' | 'R1-internal-write' | 'R2-external-read' | 'R3-external-write';

export type ApprovalTier = 'A0' | 'A1' | 'A2' | 'A3';

export type MemoryLayer = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export type AgentDomain =
  | 'planning'
  | 'reading'
  | 'research'
  | 'writing'
  | 'review'
  | 'graph'
  | 'ops';

export type ExecutionMode = 'sync' | 'async' | 'resumable';

export type ScopeLimit = 'current_object' | 'current_space' | 'current_project' | 'global';

export type CapabilityKind = 'query' | 'command' | 'mutation' | 'integration';

export type CapabilityExposure = 'internal-only' | 'internal+mcp' | 'mcp-readonly' | 'brokered-external';

export type ApprovalPolicy = 'none' | 'soft' | 'required' | 'dual-confirm';

export type DataBoundary = 'local' | 'exportable' | 'sensitive_requires_redaction';

export type ProviderBinding = 'local_engine' | 'builtin_service' | 'mcp_connector' | 'third_party_api';

// ── AgentSession ───────────────────────────────────────────

export type AgentSessionStatus = 'created' | 'active' | 'paused' | 'completed' | 'archived';

export interface AgentSession {
  readonly objectType: 'agent_session';
  readonly id: string;
  readonly surface: string;
  readonly anchorObjects: readonly string[];
  readonly intent: string;
  readonly status: AgentSessionStatus;
  readonly continuesFrom: string | null;
  readonly delegatedFrom: string | null;
  readonly spawnedByObject: string | null;
  readonly blockedByApproval: string | null;
  readonly resumedFromJob: string | null;
  readonly compressedInto: string | null;
  readonly tokenBudget: number | null;
  readonly activeMemoryLayers: readonly MemoryLayer[];
  readonly userId: string;
  readonly endedAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── AgentRun ───────────────────────────────────────────────

export type AgentRunStatus = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'cancelled';

export interface AgentRun {
  readonly objectType: 'agent_run';
  readonly id: string;
  readonly sessionId: string;
  readonly domainAgent: AgentDomain;
  readonly model: string;
  readonly strategy: string | null;
  readonly executionMode: ExecutionMode;
  readonly userInput: string | null;
  readonly tokenBudget: number | null;
  readonly tokensUsed: number | null;
  readonly allowedCapabilities: readonly string[] | null;
  readonly status: AgentRunStatus;
  readonly startedAt: IsoDateTimeString;
  readonly endedAt: IsoDateTimeString | null;
  readonly errorSummary: string | null;
  readonly parentRunId: string | null;
  readonly childRunIds: readonly string[] | null;
  readonly runSummary: string | null;
  readonly affectedObjects: readonly string[] | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── AgentTask ──────────────────────────────────────────────

export type AgentTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_approval'
  | 'awaiting_job'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentTaskKind = 'main' | 'sub' | 'async';

export interface AgentTask {
  readonly objectType: 'agent_task';
  readonly id: string;
  readonly runId: string;
  readonly parentTaskId: string | null;
  readonly kind: AgentTaskKind;
  readonly description: string;
  readonly targetObjects: readonly string[] | null;
  readonly status: AgentTaskStatus;
  readonly blockedByApproval: string | null;
  readonly blockedByJob: string | null;
  readonly capabilityCallIds: readonly string[] | null;
  readonly resultSummary: string | null;
  readonly affectedObjects: readonly string[] | null;
  readonly startedAt: IsoDateTimeString | null;
  readonly endedAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── CapabilityCall ─────────────────────────────────────────

export type CapabilityCallStatus =
  | 'prepared'
  | 'context_scanned'
  | 'policy_checked'
  | 'awaiting_approval'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'denied'
  | 'skipped';

export interface SafetyGateRecord {
  readonly contextScanPassed: boolean;
  readonly contextScanFlags: readonly string[] | null;
  readonly policyCheckPassed: boolean;
  readonly policyCheckReason: string | null;
  readonly approvalRequired: boolean;
  readonly approvalRequestId: string | null;
  readonly approvalResult: 'granted' | 'denied' | 'expired' | 'not_required' | null;
  readonly egressPerformed: boolean;
  readonly egressTarget: string | null;
  readonly egressScope: string | null;
  readonly auditLogId: string;
}

export interface CapabilityCallCost {
  readonly tokens: number | null;
  readonly networkCalls: number | null;
  readonly monetaryCents: number | null;
  readonly latencyMs: number | null;
}

export interface CapabilityCall {
  readonly objectType: 'capability_call';
  readonly id: string;
  readonly taskId: string;
  readonly runId: string;
  readonly capabilityId: string;
  readonly capabilityVersion: string;
  readonly domain: AgentDomain;
  readonly kind: CapabilityKind;
  readonly exposure: CapabilityExposure;
  readonly riskLevel: RiskLevel;
  readonly approvalTier: ApprovalTier;
  readonly executionMode: ExecutionMode;
  readonly scopeLimit: ScopeLimit;
  readonly dataBoundary: DataBoundary;
  readonly providerBinding: ProviderBinding;
  readonly inputSummary: Readonly<Record<string, unknown>>;
  readonly outputSummary: Readonly<Record<string, unknown>> | null;
  readonly safetyGate: SafetyGateRecord;
  readonly status: CapabilityCallStatus;
  readonly startedAt: IsoDateTimeString;
  readonly endedAt: IsoDateTimeString | null;
  readonly durationMs: number | null;
  readonly cost: CapabilityCallCost | null;
  readonly actorType: 'user' | 'internal_agent' | 'external_agent' | 'background_task';
  readonly actorId: string;
  readonly objectsRead: readonly string[] | null;
  readonly objectsWritten: readonly string[] | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── ApprovalRequest ────────────────────────────────────────

export type ApprovalRequestStatus =
  | 'pending'
  | 'granted'
  | 'denied'
  | 'expired'
  | 'auto_approved'
  | 'cancelled';

export interface ApprovalImpactSummary {
  readonly affectedObjects: readonly string[];
  readonly involvesEgress: boolean;
  readonly egressTarget: string | null;
  readonly sideEffects: readonly string[];
  readonly reversible: boolean;
  readonly rollbackMethod: string | null;
}

export interface ApprovalResumePoint {
  readonly taskId: string;
  readonly capabilityCallId: string;
  readonly executionContext: Readonly<Record<string, unknown>> | null;
}

export interface ApprovalRequest {
  readonly objectType: 'approval_request';
  readonly id: string;
  readonly capabilityCallId: string;
  readonly runId: string;
  readonly taskId: string;
  readonly sessionId: string;
  readonly tier: ApprovalTier;
  readonly reason: string;
  readonly requestedAction: string;
  readonly impactSummary: ApprovalImpactSummary;
  readonly requesterType: 'internal_agent' | 'external_agent' | 'background_task';
  readonly requesterId: string;
  readonly requesterDomain: AgentDomain | null;
  readonly status: ApprovalRequestStatus;
  readonly expiresAt: IsoDateTimeString | null;
  readonly resolvedAt: IsoDateTimeString | null;
  readonly resolvedBy: string | null;
  readonly resolutionNote: string | null;
  readonly resumePoint: ApprovalResumePoint | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}
