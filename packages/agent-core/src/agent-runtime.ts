// ---------------------------------------------------------------------------
// @orbit/agent-core – Agent Runtime Facade
//
// Unified entry point that wires Skills, MCP, Tools, Roles, and Teams.
// ---------------------------------------------------------------------------

import { generateId } from './types.js';
import type { LLMAdapter } from './llm-adapter.js';
import type { SkillManager } from './skills/types.js';
import type { McpManager } from './mcp/types.js';
import type { ToolManager } from './tools/tool-manager.js';
import type { RoleRegistry } from './roles/types.js';
import type { TeamOrchestrator } from './team/team-orchestrator.js';

import { createSkillManager } from './skills/skill-manager.js';
import { createSkillResolver } from './skills/skill-resolver.js';
import { createMcpManager } from './mcp/mcp-manager.js';
import { createMcpInstaller } from './mcp/mcp-installer.js';
import { createMcpToolBridge } from './mcp/mcp-tool-bridge.js';
import { createToolManager } from './tools/tool-manager.js';
import { RoleRegistryImpl } from './roles/role-registry.js';
import { createTeamOrchestrator } from './team/team-orchestrator.js';
import { ToolRegistry } from './tool-registry.js';
import { ToolsetRegistry, CORE_TOOLSETS } from './tools/toolset-registry.js';
import { APP_TOOLSETS } from './tools/app-tools.js';
import { loadBuiltinRoles } from './roles/builtin-roles.js';

// ---- Configuration ----

export interface AgentRuntimeConfig {
  readonly llm?: LLMAdapter;
  readonly loadBuiltins?: boolean; // default: true
}

// ---- Runtime status ----

export interface RuntimeStatus {
  readonly activeSkills: number;
  readonly connectedMcpServers: number;
  readonly totalTools: number;
  readonly registeredRoles: number;
  readonly activeTeams: number;
}

// ---- Public interface ----

export interface AgentRuntime {
  readonly id: string;
  readonly skills: SkillManager;
  readonly mcp: McpManager;
  readonly tools: ToolManager;
  readonly roles: RoleRegistry;
  readonly teams: TeamOrchestrator;

  installSkillFromUrl(url: string): Promise<{ success: boolean; skillId?: string; error?: string }>;
  installMcpFromUrl(url: string): Promise<{ success: boolean; serverId?: string; error?: string }>;
  getSystemStatus(): RuntimeStatus;
}

// ---- Factory ----

export function createAgentRuntime(config?: AgentRuntimeConfig): AgentRuntime {
  const llm = config?.llm;
  const loadBuiltins = config?.loadBuiltins ?? true;

  // 1. Create ToolRegistry (for MCP bridge)
  const toolRegistry = new ToolRegistry();

  // 2. Create ToolsetRegistry with CORE_TOOLSETS + APP_TOOLSETS
  const toolsetRegistry = new ToolsetRegistry();
  for (const toolset of CORE_TOOLSETS) {
    toolsetRegistry.register(toolset);
  }
  for (const toolset of APP_TOOLSETS) {
    toolsetRegistry.register(toolset);
  }

  // 3. Create SkillResolver with optional LLM
  const skillResolver = createSkillResolver(llm);

  // 4. Create SkillManager (builtins are loaded inside createSkillManager)
  const skills = createSkillManager(skillResolver);

  // 5. Create McpInstaller with optional LLM
  const mcpInstaller = createMcpInstaller(llm);

  // 6. Create McpManager
  const mcp = createMcpManager(mcpInstaller);

  // 7. Create McpToolBridge with ToolRegistry
  const mcpToolBridge = createMcpToolBridge(mcp);

  // 8. Create ToolManager with ToolsetRegistry + ToolRegistry
  const tools = createToolManager(toolsetRegistry, toolRegistry);

  // 9. Create RoleRegistry (optionally load builtins)
  const roles = new RoleRegistryImpl();
  if (loadBuiltins) {
    loadBuiltinRoles(roles);
  }

  // 10. Create TeamOrchestrator
  const teams = createTeamOrchestrator();

  // 11. Build the runtime object
  const runtimeId = generateId('runtime');

  const runtime: AgentRuntime = {
    id: runtimeId,
    skills,
    mcp,
    tools,
    roles,
    teams,

    async installSkillFromUrl(url: string) {
      try {
        const resolved = await skillResolver.resolve(url);
        if (!resolved.success || !resolved.skill) {
          return { success: false, error: resolved.error ?? 'Failed to resolve skill.' };
        }
        const installed = skills.installFromDefinition(resolved.skill, {
          type: 'url',
          url,
          fetchedAt: new Date().toISOString(),
        });
        return { success: true, skillId: installed.id };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },

    async installMcpFromUrl(url: string) {
      try {
        const resolved = await mcpInstaller.resolve(url);
        if (!resolved.success || !resolved.config) {
          return { success: false, error: resolved.error ?? 'Failed to resolve MCP config.' };
        }
        const installed = mcp.installFromConfig(resolved.config);
        return { success: true, serverId: installed.id };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },

    getSystemStatus(): RuntimeStatus {
      return {
        activeSkills: skills.getActiveSkills().length,
        connectedMcpServers: mcp.getConnectedServers().length,
        totalTools: tools.getToolCount().total,
        registeredRoles: roles.listRoles().length,
        activeTeams: teams.listTeams().length,
      };
    },
  };

  // Keep reference to mcpToolBridge for future use (e.g., auto-bridging on connect)
  void mcpToolBridge;

  return runtime;
}
