export const AGENT_HANDOFF_VERSION = 1;
export const AGENT_ROLES = ['planner', 'researcher', 'executor', 'reviewer'] as const;
export const AGENT_CONTEXT_KINDS = ['note', 'object-ref', 'url', 'instruction'] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];
export type AgentContextKind = (typeof AGENT_CONTEXT_KINDS)[number];

export interface AgentContextEntry {
  readonly kind: AgentContextKind;
  readonly label: string;
  readonly value: string;
}

export interface AgentCapabilityRequirement {
  readonly capabilityId: string;
  readonly reason: string;
  readonly optional?: boolean;
}

export interface AgentHandoff {
  readonly version: number;
  readonly handoffId: string;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly role: AgentRole;
  readonly summary: string;
  readonly expectedOutput: string;
  readonly context: readonly AgentContextEntry[];
  readonly capabilityRequirements: readonly AgentCapabilityRequirement[];
}

export function isAgentRole(value: string): value is AgentRole {
  return AGENT_ROLES.includes(value as AgentRole);
}

export function createHandoffTitle(input: Pick<AgentHandoff, 'taskId' | 'role'>): string {
  return `[${input.role}] ${input.taskId}`;
}
