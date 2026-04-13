// ---------------------------------------------------------------------------
// @orbit/agent-core – Role Registry Implementation
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { SkillManager } from '../skills/types.js';
import type { McpManager } from '../mcp/types.js';
import type {
  AgentRoleDefinition,
  AgentToolConfig,
  CreateRoleInput,
  UpdateRoleInput,
  ResolvedAgentConfig,
  RoleRegistry,
} from './types.js';

// ---- Domain inference ----

/**
 * Infer an AgentDomain string from a role definition.
 * Falls back to 'planning' when no specialization matches.
 */
function inferDomain(role: AgentRoleDefinition): string {
  const domainKeywords: Record<string, string> = {
    plan: 'planning',
    organize: 'planning',
    task: 'planning',
    milestone: 'planning',
    project: 'planning',
    read: 'reading',
    summarize: 'reading',
    rss: 'reading',
    search: 'research',
    research: 'research',
    investigate: 'research',
    write: 'writing',
    draft: 'writing',
    edit: 'writing',
    review: 'review',
    audit: 'review',
    code: 'ops',
    debug: 'ops',
    build: 'ops',
  };

  for (const spec of role.specializations) {
    const domain = domainKeywords[spec];
    if (domain) return domain;
  }

  return 'planning';
}

// ---- Default values ----

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0.5;
const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_OUTPUT_FORMAT = 'text' as const;
const DEFAULT_ICON = '🔧';

// ---- Implementation ----

export class RoleRegistryImpl implements RoleRegistry {
  private readonly roles = new Map<string, AgentRoleDefinition>();

  /** Internal method used by loadBuiltinRoles to insert pre-built definitions. */
  _loadBuiltin(role: AgentRoleDefinition): void {
    this.roles.set(role.id, role);
  }

  // -- List --

  listRoles(): readonly AgentRoleDefinition[] {
    return [...this.roles.values()];
  }

  getRole(id: string): AgentRoleDefinition | undefined {
    return this.roles.get(id);
  }

  getRoleByName(name: string): AgentRoleDefinition | undefined {
    for (const role of this.roles.values()) {
      if (role.name === name) return role;
    }
    return undefined;
  }

  getBuiltinRoles(): readonly AgentRoleDefinition[] {
    return [...this.roles.values()].filter((r) => r.isBuiltin);
  }

  getCustomRoles(): readonly AgentRoleDefinition[] {
    return [...this.roles.values()].filter((r) => !r.isBuiltin);
  }

  // -- Create --

  createRole(input: CreateRoleInput): AgentRoleDefinition {
    const now = new Date().toISOString();
    const tools: AgentToolConfig = {
      allowed: input.tools?.allowed ?? [],
      blocked: input.tools?.blocked ?? [],
      ...(input.tools?.autoIncludeCategories
        ? { autoIncludeCategories: input.tools.autoIncludeCategories }
        : {}),
    };

    const role: AgentRoleDefinition = {
      id: generateId('role'),
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      icon: input.icon ?? DEFAULT_ICON,
      systemPrompt: input.systemPrompt,
      model: input.model ?? DEFAULT_MODEL,
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      maxIterations: input.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      tools,
      mcpServers: input.mcpServers ?? [],
      skills: input.skills ?? [],
      specializations: input.specializations ?? [],
      outputFormat: input.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    };

    this.roles.set(role.id, role);
    return role;
  }

  // -- Update --

  updateRole(id: string, patch: UpdateRoleInput): AgentRoleDefinition | undefined {
    const existing = this.roles.get(id);
    if (!existing || existing.isBuiltin) return undefined;

    const mergedTools: AgentToolConfig = patch.tools
      ? {
          allowed: patch.tools.allowed ?? existing.tools.allowed,
          blocked: patch.tools.blocked ?? existing.tools.blocked,
          ...(patch.tools.autoIncludeCategories !== undefined
            ? { autoIncludeCategories: patch.tools.autoIncludeCategories }
            : existing.tools.autoIncludeCategories
              ? { autoIncludeCategories: existing.tools.autoIncludeCategories }
              : {}),
        }
      : existing.tools;

    const updated: AgentRoleDefinition = {
      ...existing,
      name: patch.name ?? existing.name,
      displayName: patch.displayName ?? existing.displayName,
      description: patch.description ?? existing.description,
      icon: patch.icon ?? existing.icon,
      systemPrompt: patch.systemPrompt ?? existing.systemPrompt,
      model: patch.model ?? existing.model,
      temperature: patch.temperature ?? existing.temperature,
      maxIterations: patch.maxIterations ?? existing.maxIterations,
      tools: mergedTools,
      mcpServers: patch.mcpServers ?? existing.mcpServers,
      skills: patch.skills ?? existing.skills,
      specializations: patch.specializations ?? existing.specializations,
      outputFormat: patch.outputFormat ?? existing.outputFormat,
      updatedAt: new Date().toISOString(),
    };

    this.roles.set(id, updated);
    return updated;
  }

  // -- Delete --

  deleteRole(id: string): boolean {
    const existing = this.roles.get(id);
    if (!existing || existing.isBuiltin) return false;
    return this.roles.delete(id);
  }

  // -- Clone --

  cloneRole(id: string, newName: string): AgentRoleDefinition | undefined {
    const source = this.roles.get(id);
    if (!source) return undefined;

    const now = new Date().toISOString();
    const cloned: AgentRoleDefinition = {
      ...source,
      id: generateId('role'),
      name: newName,
      displayName: `${source.displayName} (copy)`,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    };

    this.roles.set(cloned.id, cloned);
    return cloned;
  }

  // -- Match --

  matchRole(query: string): AgentRoleDefinition {
    const lower = query.toLowerCase();

    let bestRole: AgentRoleDefinition | undefined;
    let bestScore = 0;

    for (const role of this.roles.values()) {
      let score = 0;
      for (const keyword of role.specializations) {
        if (lower.includes(keyword)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestRole = role;
      }
    }

    if (bestRole && bestScore > 0) return bestRole;

    // Fallback to 'assistant'
    return this.getRoleByName('assistant') ?? [...this.roles.values()][0]!;
  }

  // -- Resolve --

  resolveAgentConfig(
    roleId: string,
    skillManager?: SkillManager,
    mcpManager?: McpManager,
  ): ResolvedAgentConfig | undefined {
    const role = this.roles.get(roleId);
    if (!role) return undefined;

    // 1. Start with the role's explicitly allowed / blocked tools
    const allowedTools = new Set<string>(role.tools.allowed);
    const blockedTools = new Set<string>(role.tools.blocked);

    // 2. Resolve skills → instructions + tool names
    const skillInstructions: string[] = [];
    if (skillManager && role.skills.length > 0) {
      const resolved = skillManager.resolveSkillsForAgent(role.skills);
      for (const skill of resolved) {
        if (skill.instructions) {
          skillInstructions.push(skill.instructions);
        }
        if (skill.tools) {
          for (const t of skill.tools) {
            allowedTools.add(t);
          }
        }
      }
    }

    // 3. Resolve MCP servers → tool names
    const mcpToolNames: string[] = [];
    if (mcpManager && role.mcpServers.length > 0) {
      for (const serverId of role.mcpServers) {
        const tools = mcpManager.listToolsFromServer(serverId);
        for (const t of tools) {
          mcpToolNames.push(t.name);
          allowedTools.add(t.name);
        }
      }
    }

    // 4. Build combined system prompt
    const promptParts = [role.systemPrompt];
    if (skillInstructions.length > 0) {
      promptParts.push('\n--- Skill Instructions ---');
      promptParts.push(...skillInstructions);
    }
    const combinedPrompt = promptParts.join('\n');

    // 5. Derive domain
    const domain = inferDomain(role);

    return {
      roleId: role.id,
      name: role.name,
      domain,
      systemPrompt: combinedPrompt,
      model: role.model,
      maxIterations: role.maxIterations,
      temperature: role.temperature,
      allowedTools: [...allowedTools],
      blockedTools: [...blockedTools],
      skillInstructions,
      mcpToolNames,
    };
  }
}
