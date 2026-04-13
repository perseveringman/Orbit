// ---------------------------------------------------------------------------
// @orbit/agent-core – Agent Role Types
// ---------------------------------------------------------------------------

import type { ToolCategory } from '../tools/types.js';
import type { SkillManager } from '../skills/types.js';
import type { McpManager } from '../mcp/types.js';

// ---- Tool configuration ----

/** How tools are configured for a role. */
export interface AgentToolConfig {
  readonly allowed: readonly string[];
  readonly blocked: readonly string[];
  readonly autoIncludeCategories?: readonly ToolCategory[];
}

// ---- Role definition ----

/** Full role definition — built-in or custom. */
export interface AgentRoleDefinition {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly icon: string;
  readonly systemPrompt: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxIterations: number;
  readonly tools: AgentToolConfig;
  readonly mcpServers: readonly string[];
  readonly skills: readonly string[];
  readonly specializations: readonly string[];
  readonly outputFormat: 'text' | 'markdown' | 'json' | 'code';
  readonly isBuiltin: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---- Create / Update inputs ----

/** Input for creating a custom role. */
export interface CreateRoleInput {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly icon?: string;
  readonly systemPrompt: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxIterations?: number;
  readonly tools?: Partial<AgentToolConfig>;
  readonly mcpServers?: readonly string[];
  readonly skills?: readonly string[];
  readonly specializations?: readonly string[];
  readonly outputFormat?: 'text' | 'markdown' | 'json' | 'code';
}

/** Patch for updating an existing role. */
export type UpdateRoleInput = Partial<CreateRoleInput>;

// ---- Resolved config ----

/** Resolved agent config — ready to hand to an executor. */
export interface ResolvedAgentConfig {
  readonly roleId: string;
  readonly name: string;
  readonly domain: string;
  readonly systemPrompt: string;
  readonly model: string;
  readonly maxIterations: number;
  readonly temperature: number;
  readonly allowedTools: readonly string[];
  readonly blockedTools: readonly string[];
  readonly skillInstructions: readonly string[];
  readonly mcpToolNames: readonly string[];
}

// ---- Registry interface ----

/** Manages built-in and custom agent roles. */
export interface RoleRegistry {
  listRoles(): readonly AgentRoleDefinition[];
  getRole(id: string): AgentRoleDefinition | undefined;
  getRoleByName(name: string): AgentRoleDefinition | undefined;
  createRole(input: CreateRoleInput): AgentRoleDefinition;
  updateRole(id: string, patch: UpdateRoleInput): AgentRoleDefinition | undefined;
  deleteRole(id: string): boolean;
  cloneRole(id: string, newName: string): AgentRoleDefinition | undefined;
  getBuiltinRoles(): readonly AgentRoleDefinition[];
  getCustomRoles(): readonly AgentRoleDefinition[];
  matchRole(query: string): AgentRoleDefinition;
  resolveAgentConfig(
    roleId: string,
    skillManager?: SkillManager,
    mcpManager?: McpManager,
  ): ResolvedAgentConfig | undefined;
}
