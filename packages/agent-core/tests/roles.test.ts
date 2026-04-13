// ---------------------------------------------------------------------------
// @orbit/agent-core – Roles System Tests
// ---------------------------------------------------------------------------

import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  RoleRegistryImpl,
  BUILTIN_ROLES,
  loadBuiltinRoles,
} from '../src/roles/index';

import type {
  AgentRoleDefinition,
  CreateRoleInput,
  RoleRegistry,
  ResolvedAgentConfig,
} from '../src/roles/index';

import type { SkillManager } from '../src/skills/types';
import type { McpManager } from '../src/mcp/types';

// ---- Helpers ----

function makeCreateRoleInput(overrides: Partial<CreateRoleInput> = {}): CreateRoleInput {
  return {
    name: overrides.name ?? 'custom-role',
    displayName: overrides.displayName ?? 'Custom Role',
    description: overrides.description ?? 'A custom test role',
    systemPrompt: overrides.systemPrompt ?? 'You are a custom agent.',
    icon: overrides.icon,
    model: overrides.model,
    temperature: overrides.temperature,
    maxIterations: overrides.maxIterations,
    tools: overrides.tools,
    mcpServers: overrides.mcpServers,
    skills: overrides.skills,
    specializations: overrides.specializations,
    outputFormat: overrides.outputFormat,
  };
}

function createRegistryWithBuiltins(): RoleRegistryImpl {
  const registry = new RoleRegistryImpl();
  loadBuiltinRoles(registry);
  return registry;
}

// ============================================================================
// Builtin Roles
// ============================================================================

describe('BUILTIN_ROLES', () => {
  it('has exactly 8 built-in roles', () => {
    expect(BUILTIN_ROLES).toHaveLength(8);
  });

  it('each role has required fields', () => {
    for (const role of BUILTIN_ROLES) {
      expect(role.id).toBeTruthy();
      expect(role.name).toBeTruthy();
      expect(role.displayName).toBeTruthy();
      expect(role.description).toBeTruthy();
      expect(role.systemPrompt).toBeTruthy();
      expect(role.tools).toBeDefined();
      expect(role.tools.allowed).toBeDefined();
      expect(role.tools.blocked).toBeDefined();
      expect(role.isBuiltin).toBe(true);
    }
  });

  it('contains all expected role names', () => {
    const names = BUILTIN_ROLES.map((r) => r.name);
    expect(names).toContain('planner');
    expect(names).toContain('researcher');
    expect(names).toContain('reader');
    expect(names).toContain('writer');
    expect(names).toContain('coder');
    expect(names).toContain('reviewer');
    expect(names).toContain('task-manager');
    expect(names).toContain('assistant');
  });

  it('loadBuiltinRoles loads all 8 into a registry', () => {
    const registry = createRegistryWithBuiltins();
    expect(registry.listRoles()).toHaveLength(8);
  });
});

// ============================================================================
// RoleRegistry CRUD
// ============================================================================

describe('RoleRegistry CRUD', () => {
  let registry: RoleRegistryImpl;

  beforeEach(() => {
    registry = createRegistryWithBuiltins();
  });

  it('listRoles returns all roles (8 builtins)', () => {
    expect(registry.listRoles()).toHaveLength(8);
  });

  it('getRole retrieves a role by ID', () => {
    const planner = registry.getRole('builtin:planner');
    expect(planner).toBeDefined();
    expect(planner!.name).toBe('planner');
  });

  it('getRoleByName retrieves a role by name', () => {
    const researcher = registry.getRoleByName('researcher');
    expect(researcher).toBeDefined();
    expect(researcher!.id).toBe('builtin:researcher');
  });

  it('getRole returns undefined for unknown ID', () => {
    expect(registry.getRole('nonexistent')).toBeUndefined();
  });

  it('getRoleByName returns undefined for unknown name', () => {
    expect(registry.getRoleByName('nonexistent')).toBeUndefined();
  });

  it('createRole with minimal input fills defaults', () => {
    const created = registry.createRole(makeCreateRoleInput());
    expect(created.id).toBeTruthy();
    expect(created.isBuiltin).toBe(false);
    expect(created.model).toBe('gpt-4o');
    expect(created.temperature).toBe(0.5);
    expect(created.maxIterations).toBe(10);
    expect(created.outputFormat).toBe('text');
    expect(created.icon).toBe('🔧');
    expect(created.tools.allowed).toEqual([]);
    expect(created.tools.blocked).toEqual([]);
    expect(created.skills).toEqual([]);
    expect(created.mcpServers).toEqual([]);
    expect(created.specializations).toEqual([]);
  });

  it('createRole → getRole returns the created role', () => {
    const created = registry.createRole(makeCreateRoleInput({ name: 'my-role' }));
    const fetched = registry.getRole(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe('my-role');
  });

  it('createRole adds to listRoles count', () => {
    registry.createRole(makeCreateRoleInput());
    expect(registry.listRoles()).toHaveLength(9);
  });

  it('updateRole on custom role applies changes', () => {
    const created = registry.createRole(makeCreateRoleInput());
    const updated = registry.updateRole(created.id, {
      displayName: 'Updated Name',
      temperature: 0.9,
    });
    expect(updated).toBeDefined();
    expect(updated!.displayName).toBe('Updated Name');
    expect(updated!.temperature).toBe(0.9);
    // unchanged fields remain
    expect(updated!.name).toBe('custom-role');
  });

  it('updateRole on builtin role returns undefined', () => {
    const result = registry.updateRole('builtin:planner', { displayName: 'Hacked' });
    expect(result).toBeUndefined();
    // original unchanged
    expect(registry.getRole('builtin:planner')!.displayName).toBe('规划助手');
  });

  it('deleteRole on custom role succeeds', () => {
    const created = registry.createRole(makeCreateRoleInput());
    const deleted = registry.deleteRole(created.id);
    expect(deleted).toBe(true);
    expect(registry.getRole(created.id)).toBeUndefined();
  });

  it('deleteRole on builtin role returns false', () => {
    const deleted = registry.deleteRole('builtin:planner');
    expect(deleted).toBe(false);
    expect(registry.getRole('builtin:planner')).toBeDefined();
  });

  it('deleteRole on unknown ID returns false', () => {
    expect(registry.deleteRole('nonexistent')).toBe(false);
  });

  it('cloneRole creates a non-builtin copy with new name', () => {
    const cloned = registry.cloneRole('builtin:planner', 'my-planner');
    expect(cloned).toBeDefined();
    expect(cloned!.name).toBe('my-planner');
    expect(cloned!.isBuiltin).toBe(false);
    expect(cloned!.id).not.toBe('builtin:planner');
    expect(cloned!.displayName).toContain('(copy)');
    // system prompt should be inherited
    expect(cloned!.systemPrompt).toBe(registry.getRole('builtin:planner')!.systemPrompt);
  });

  it('cloneRole of unknown ID returns undefined', () => {
    expect(registry.cloneRole('nonexistent', 'copy')).toBeUndefined();
  });

  it('getBuiltinRoles returns only builtins', () => {
    registry.createRole(makeCreateRoleInput());
    const builtins = registry.getBuiltinRoles();
    expect(builtins).toHaveLength(8);
    expect(builtins.every((r) => r.isBuiltin)).toBe(true);
  });

  it('getCustomRoles returns only customs', () => {
    registry.createRole(makeCreateRoleInput({ name: 'c1' }));
    registry.createRole(makeCreateRoleInput({ name: 'c2' }));
    const customs = registry.getCustomRoles();
    expect(customs).toHaveLength(2);
    expect(customs.every((r) => !r.isBuiltin)).toBe(true);
  });
});

// ============================================================================
// matchRole
// ============================================================================

describe('matchRole', () => {
  let registry: RoleRegistryImpl;

  beforeEach(() => {
    registry = createRegistryWithBuiltins();
  });

  it('"plan" → matches planner', () => {
    const match = registry.matchRole('plan my project');
    expect(match.name).toBe('planner');
  });

  it('"research" → matches researcher', () => {
    const match = registry.matchRole('research this topic');
    expect(match.name).toBe('researcher');
  });

  it('"code" → matches coder', () => {
    const match = registry.matchRole('code a function');
    expect(match.name).toBe('coder');
  });

  it('"review" → matches reviewer', () => {
    const match = registry.matchRole('review the document');
    expect(match.name).toBe('reviewer');
  });

  it('"write" → matches writer', () => {
    const match = registry.matchRole('write an article');
    expect(match.name).toBe('writer');
  });

  it('"read" → matches reader', () => {
    const match = registry.matchRole('read this document');
    expect(match.name).toBe('reader');
  });

  it('"gibberish" → falls back to assistant', () => {
    const match = registry.matchRole('xyzzy foobar baz');
    expect(match.name).toBe('assistant');
  });
});

// ============================================================================
// resolveAgentConfig
// ============================================================================

describe('resolveAgentConfig', () => {
  let registry: RoleRegistryImpl;

  beforeEach(() => {
    registry = createRegistryWithBuiltins();
  });

  it('without skill/mcp managers → basic config from role', () => {
    const config = registry.resolveAgentConfig('builtin:planner');
    expect(config).toBeDefined();
    expect(config!.roleId).toBe('builtin:planner');
    expect(config!.name).toBe('planner');
    expect(config!.systemPrompt).toContain('planning agent');
    expect(config!.model).toBe('gpt-4o');
    expect(config!.skillInstructions).toEqual([]);
    expect(config!.mcpToolNames).toEqual([]);
  });

  it('with mock SkillManager → skill instructions appended to system prompt', () => {
    // Create a role with skill references
    const role = registry.createRole(
      makeCreateRoleInput({
        name: 'skilled-role',
        skills: ['skill1'],
        systemPrompt: 'Base prompt.',
      }),
    );

    const mockSkillManager: SkillManager = {
      listSkills: vi.fn().mockReturnValue([]),
      getSkill: vi.fn(),
      installFromDefinition: vi.fn() as any,
      installFromUrl: vi.fn() as any,
      uninstall: vi.fn().mockReturnValue(true),
      enableSkill: vi.fn().mockReturnValue(true),
      disableSkill: vi.fn().mockReturnValue(true),
      getSkillsByTag: vi.fn().mockReturnValue([]),
      getActiveSkills: vi.fn().mockReturnValue([]),
      resolveSkillsForAgent: vi.fn().mockReturnValue([
        {
          id: 'skill1',
          name: 'Test Skill',
          description: 'test',
          version: '1.0.0',
          source: { type: 'builtin' as const },
          instructions: 'Do testing stuff',
          tools: ['test_tool'],
          tags: [],
          installedAt: new Date().toISOString(),
          status: 'active' as const,
        },
      ]),
    };

    const config = registry.resolveAgentConfig(role.id, mockSkillManager);
    expect(config).toBeDefined();
    expect(config!.systemPrompt).toContain('Base prompt.');
    expect(config!.systemPrompt).toContain('Do testing stuff');
    expect(config!.skillInstructions).toContain('Do testing stuff');
    expect(config!.allowedTools).toContain('test_tool');
  });

  it('with mock McpManager → MCP tool names included', () => {
    const role = registry.createRole(
      makeCreateRoleInput({
        name: 'mcp-role',
        mcpServers: ['server1'],
        systemPrompt: 'MCP prompt.',
      }),
    );

    const mockMcpManager: McpManager = {
      listServers: vi.fn().mockReturnValue([]),
      getServer: vi.fn(),
      installFromConfig: vi.fn() as any,
      installFromUrl: vi.fn() as any,
      uninstall: vi.fn().mockReturnValue(true),
      connect: vi.fn() as any,
      disconnect: vi.fn().mockReturnValue(true),
      listToolsFromServer: vi.fn().mockReturnValue([
        { name: 'mcp_tool', description: 'MCP test tool', inputSchema: {}, serverId: 'server1' },
      ]),
      executeToolOnServer: vi.fn() as any,
      getConnectedServers: vi.fn().mockReturnValue([]),
    };

    const config = registry.resolveAgentConfig(role.id, undefined, mockMcpManager);
    expect(config).toBeDefined();
    expect(config!.mcpToolNames).toContain('mcp_tool');
    expect(config!.allowedTools).toContain('mcp_tool');
  });

  it('for non-existent role → returns undefined', () => {
    const config = registry.resolveAgentConfig('nonexistent');
    expect(config).toBeUndefined();
  });

  it('resolves domain from role specializations', () => {
    const config = registry.resolveAgentConfig('builtin:researcher');
    expect(config).toBeDefined();
    expect(config!.domain).toBe('research');
  });
});
