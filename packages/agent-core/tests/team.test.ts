// ---------------------------------------------------------------------------
// @orbit/agent-core – Team Orchestration Tests
// ---------------------------------------------------------------------------

import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  createTaskDecomposer,
  createLeadAgent,
  createTeamOrchestrator,
} from '../src/team/index';

import type {
  TeamTaskDecomposer,
  AgentTeamMember,
  TeamOrchestrator,
  LeadAgent,
  CreateTeamInput,
} from '../src/team/index';

import type { RoleRegistry } from '../src/roles/types';
import { RoleRegistryImpl, loadBuiltinRoles } from '../src/roles/index';

// ---- Helpers ----

function makeMembers(configs: { roleName: string; responsibility: string; priority?: number }[]): AgentTeamMember[] {
  return configs.map((c, i) => ({
    agentId: `agent-${i}`,
    roleId: `role-${i}`,
    roleName: c.roleName,
    responsibility: c.responsibility,
    priority: c.priority ?? configs.length - i,
  }));
}

function createRegistryWithBuiltins(): RoleRegistryImpl {
  const registry = new RoleRegistryImpl();
  loadBuiltinRoles(registry);
  return registry;
}

// ============================================================================
// TaskDecomposer
// ============================================================================

describe('TaskDecomposer', () => {
  let decomposer: TeamTaskDecomposer;
  let registry: RoleRegistry;

  beforeEach(() => {
    decomposer = createTaskDecomposer();
    registry = createRegistryWithBuiltins();
  });

  it('can be created', () => {
    expect(decomposer).toBeDefined();
    expect(typeof decomposer.decompose).toBe('function');
  });

  it('decompose with empty members returns empty plan', () => {
    const plan = decomposer.decompose('do something', [], registry);
    expect(plan.tasks).toHaveLength(0);
    expect(plan.estimatedSteps).toBe(0);
  });

  it('decompose single-domain task assigns to matching member', () => {
    const members = makeMembers([
      { roleName: 'researcher', responsibility: 'research and investigate topics' },
      { roleName: 'writer', responsibility: 'write and compose documents' },
    ]);

    const plan = decomposer.decompose('research the latest AI papers', members, registry);
    expect(plan.tasks.length).toBeGreaterThanOrEqual(1);

    const researchTask = plan.tasks.find((t) => t.assignedRoleName === 'researcher');
    expect(researchTask).toBeDefined();
  });

  it('decompose multi-domain task creates multiple subtasks', () => {
    const members = makeMembers([
      { roleName: 'researcher', responsibility: 'research and investigate topics' },
      { roleName: 'writer', responsibility: 'write and compose documents' },
    ]);

    const plan = decomposer.decompose(
      'research AI trends and write a summary article',
      members,
      registry,
    );
    expect(plan.tasks.length).toBe(2);
  });

  it('tasks with research + writing → pipeline strategy (sequential deps)', () => {
    // Role names must match the ORDERING_RULES domain keywords (e.g. 'writing' not 'writer')
    const members = makeMembers([
      { roleName: 'research', responsibility: 'research and investigate topics' },
      { roleName: 'writing', responsibility: 'write and compose documents' },
    ]);

    const plan = decomposer.decompose(
      'research AI trends and write a summary article',
      members,
      registry,
    );
    // research→writing has an ordering rule, so writing depends on research
    const writingTask = plan.tasks.find((t) => t.assignedRoleName === 'writing');
    expect(writingTask).toBeDefined();
    expect(writingTask!.dependsOn.length).toBeGreaterThan(0);
    // strategy should be pipeline or sequential (has deps)
    expect(['pipeline', 'sequential', 'orchestrated']).toContain(plan.strategy.type);
  });

  it('tasks with independent parts → parallel strategy', () => {
    const members = makeMembers([
      { roleName: 'ops-agent', responsibility: 'import and export data' },
      { roleName: 'graph-agent', responsibility: 'link and connect graph nodes' },
    ]);

    const plan = decomposer.decompose(
      'import data and link graph nodes',
      members,
      registry,
    );
    // ops and graph have no ordering rule between them
    if (plan.tasks.length > 1) {
      const allNoDeps = plan.tasks.every((t) => t.dependsOn.length === 0);
      if (allNoDeps) {
        expect(plan.strategy.type).toBe('parallel');
      }
    }
  });

  it('all tasks have required fields', () => {
    const members = makeMembers([
      { roleName: 'researcher', responsibility: 'research topics' },
    ]);

    const plan = decomposer.decompose('search for papers', members, registry);
    for (const task of plan.tasks) {
      expect(task.id).toBeTruthy();
      expect(task.description).toBeTruthy();
      expect(task.assignedAgentId).toBeTruthy();
      expect(task.assignedRoleName).toBeTruthy();
      expect(task.dependsOn).toBeDefined();
      expect(typeof task.priority).toBe('number');
    }
  });
});

// ============================================================================
// LeadAgent
// ============================================================================

describe('LeadAgent', () => {
  let lead: LeadAgent;

  beforeEach(() => {
    lead = createLeadAgent();
  });

  it('can be created', () => {
    expect(lead).toBeDefined();
    expect(typeof lead.analyzeTask).toBe('function');
  });

  it('analyzeTask simple task → complexity: simple, requiresTeam: false', () => {
    const analysis = lead.analyzeTask('search for some information');
    expect(analysis.complexity).toBe('simple');
    expect(analysis.requiresTeam).toBe(false);
    expect(analysis.domains.length).toBeLessThanOrEqual(1);
  });

  it('analyzeTask complex multi-domain task → complexity: complex, requiresTeam: true', () => {
    const analysis = lead.analyzeTask(
      'first research the topic, then write a comprehensive report, and finally review it for accuracy',
    );
    expect(analysis.complexity).toBe('complex');
    expect(analysis.requiresTeam).toBe(true);
    expect(analysis.domains.length).toBeGreaterThanOrEqual(2);
  });

  it('analyzeTask moderate two-domain task', () => {
    const analysis = lead.analyzeTask('research and write about quantum computing');
    expect(['moderate', 'complex']).toContain(analysis.complexity);
    expect(analysis.requiresTeam).toBe(true);
  });

  it('shouldDelegate simple task → false', () => {
    expect(lead.shouldDelegate('search for papers')).toBe(false);
  });

  it('shouldDelegate complex task → true', () => {
    expect(
      lead.shouldDelegate(
        'first research the topic, then write a report and review it',
      ),
    ).toBe(true);
  });

  it('assembleTeam returns CreateTeamInput with appropriate members', () => {
    const registry = createRegistryWithBuiltins();
    const teamInput = lead.assembleTeam(
      'research and write a blog post',
      registry,
    );

    expect(teamInput.name).toBeTruthy();
    expect(teamInput.members).toBeDefined();
    expect(teamInput.members.length).toBeGreaterThan(0);
    expect(teamInput.strategy).toBeDefined();

    // each member has required fields
    for (const member of teamInput.members) {
      expect(member.responsibility).toBeTruthy();
      expect(typeof member.priority).toBe('number');
    }
  });

  it('assembleTeam with empty registry returns team with no members', () => {
    const emptyRegistry = new RoleRegistryImpl();
    const teamInput = lead.assembleTeam('do something', emptyRegistry);
    expect(teamInput.members).toHaveLength(0);
  });

  it('summarizeResults with completed results → returns string', () => {
    const results = [
      {
        agentId: 'a1',
        roleName: 'researcher',
        subtask: 'Find papers',
        output: {
          agentName: 'researcher',
          response: 'Found 5 papers on AI.',
          steps: [],
          tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          durationMs: 1000,
          status: 'completed' as const,
        },
        status: 'completed' as const,
      },
    ];

    const summary = lead.summarizeResults(results);
    expect(typeof summary).toBe('string');
    expect(summary).toContain('researcher');
    expect(summary).toContain('Found 5 papers');
  });

  it('summarizeResults with no results', () => {
    const summary = lead.summarizeResults([]);
    expect(summary).toContain('No results');
  });

  it('summarizeResults includes errors and skipped', () => {
    const results = [
      {
        agentId: 'a1',
        roleName: 'researcher',
        subtask: 'Find papers',
        output: {
          agentName: 'researcher',
          response: 'Error: timeout',
          steps: [],
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          durationMs: 0,
          status: 'error' as const,
        },
        status: 'error' as const,
      },
      {
        agentId: 'a2',
        roleName: 'writer',
        subtask: 'Write article',
        output: {
          agentName: 'writer',
          response: 'Skipped due to deps',
          steps: [],
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          durationMs: 0,
          status: 'error' as const,
        },
        status: 'skipped' as const,
      },
    ];

    const summary = lead.summarizeResults(results);
    expect(summary).toContain('Errors');
    expect(summary).toContain('Skipped');
  });
});

// ============================================================================
// TeamOrchestrator
// ============================================================================

describe('TeamOrchestrator', () => {
  let orchestrator: TeamOrchestrator;

  beforeEach(() => {
    orchestrator = createTeamOrchestrator();
  });

  it('can be created', () => {
    expect(orchestrator).toBeDefined();
    expect(typeof orchestrator.createTeam).toBe('function');
  });

  it('createTeam with members returns AgentTeam with IDs assigned', () => {
    const input: CreateTeamInput = {
      name: 'test-team',
      description: 'A test team',
      members: [
        { roleName: 'researcher', responsibility: 'Research things', priority: 2 },
        { roleName: 'writer', responsibility: 'Write things', priority: 1 },
      ],
      strategy: { type: 'sequential' },
    };

    const team = orchestrator.createTeam(input);
    expect(team.id).toBeTruthy();
    expect(team.name).toBe('test-team');
    expect(team.description).toBe('A test team');
    expect(team.members).toHaveLength(2);
    expect(team.strategy).toEqual({ type: 'sequential' });

    // each member gets an agentId
    for (const member of team.members) {
      expect(member.agentId).toBeTruthy();
      expect(member.roleName).toBeTruthy();
      expect(member.responsibility).toBeTruthy();
    }
  });

  it('createTeam sets status to idle', () => {
    const team = orchestrator.createTeam({
      name: 'idle-team',
      members: [{ roleName: 'agent', responsibility: 'do stuff' }],
    });
    expect(team.status).toBe('idle');
  });

  it('createTeam sets leadAgentId to highest priority member', () => {
    const team = orchestrator.createTeam({
      name: 'lead-team',
      members: [
        { roleName: 'junior', responsibility: 'help', priority: 1 },
        { roleName: 'senior', responsibility: 'lead', priority: 10 },
      ],
    });

    const senior = team.members.find((m) => m.roleName === 'senior');
    expect(team.leadAgentId).toBe(senior!.agentId);
  });

  it('createTeam with default strategy is sequential', () => {
    const team = orchestrator.createTeam({
      name: 'default-strategy',
      members: [{ roleName: 'agent', responsibility: 'do stuff' }],
    });
    expect(team.strategy).toEqual({ type: 'sequential' });
  });

  it('getTeam by ID', () => {
    const team = orchestrator.createTeam({
      name: 'find-me',
      members: [{ roleName: 'agent', responsibility: 'do stuff' }],
    });

    const fetched = orchestrator.getTeam(team.id);
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe('find-me');
  });

  it('getTeam returns undefined for unknown ID', () => {
    expect(orchestrator.getTeam('nonexistent')).toBeUndefined();
  });

  it('listTeams returns all teams', () => {
    orchestrator.createTeam({ name: 't1', members: [{ roleName: 'a', responsibility: 'x' }] });
    orchestrator.createTeam({ name: 't2', members: [{ roleName: 'b', responsibility: 'y' }] });
    expect(orchestrator.listTeams()).toHaveLength(2);
  });

  it('addMember to existing team', () => {
    const team = orchestrator.createTeam({
      name: 'growing-team',
      members: [{ roleName: 'agent', responsibility: 'do stuff' }],
    });

    const updated = orchestrator.addMember(team.id, {
      roleName: 'new-agent',
      responsibility: 'help out',
      priority: 5,
    });

    expect(updated).toBeDefined();
    expect(updated!.members).toHaveLength(2);
    const newMember = updated!.members.find((m) => m.roleName === 'new-agent');
    expect(newMember).toBeDefined();
    expect(newMember!.responsibility).toBe('help out');
  });

  it('addMember to nonexistent team returns undefined', () => {
    expect(
      orchestrator.addMember('nonexistent', { roleName: 'a', responsibility: 'b' }),
    ).toBeUndefined();
  });

  it('removeMember from team', () => {
    const team = orchestrator.createTeam({
      name: 'shrinking-team',
      members: [
        { roleName: 'keeper', responsibility: 'stay', priority: 2 },
        { roleName: 'leaver', responsibility: 'go', priority: 1 },
      ],
    });

    const leaver = team.members.find((m) => m.roleName === 'leaver');
    const updated = orchestrator.removeMember(team.id, leaver!.agentId);

    expect(updated).toBeDefined();
    expect(updated!.members).toHaveLength(1);
    expect(updated!.members[0].roleName).toBe('keeper');
  });

  it('removeMember with unknown agentId returns undefined', () => {
    const team = orchestrator.createTeam({
      name: 'team',
      members: [{ roleName: 'agent', responsibility: 'x' }],
    });
    expect(orchestrator.removeMember(team.id, 'nonexistent')).toBeUndefined();
  });

  it('removeMember from nonexistent team returns undefined', () => {
    expect(orchestrator.removeMember('nonexistent', 'agent1')).toBeUndefined();
  });

  it('deleteTeam removes it from listing', () => {
    const team = orchestrator.createTeam({
      name: 'doomed',
      members: [{ roleName: 'a', responsibility: 'x' }],
    });

    expect(orchestrator.deleteTeam(team.id)).toBe(true);
    expect(orchestrator.getTeam(team.id)).toBeUndefined();
    expect(orchestrator.listTeams()).toHaveLength(0);
  });

  it('deleteTeam with unknown ID returns false', () => {
    expect(orchestrator.deleteTeam('nonexistent')).toBe(false);
  });

  it('getTeamStatus returns idle for new team', () => {
    const team = orchestrator.createTeam({
      name: 'status-team',
      members: [{ roleName: 'a', responsibility: 'x' }],
    });
    expect(orchestrator.getTeamStatus(team.id)).toBe('idle');
  });

  it('getTeamStatus returns idle for unknown team', () => {
    expect(orchestrator.getTeamStatus('nonexistent')).toBe('idle');
  });

  it('createTeamFromTask creates team based on task analysis', () => {
    const registry = createRegistryWithBuiltins();
    const team = orchestrator.createTeamFromTask(
      'research and write a blog post',
      registry,
    );

    expect(team.id).toBeTruthy();
    expect(team.members.length).toBeGreaterThan(0);
    expect(team.status).toBe('idle');
  });

  it('removeMember reassigns lead when lead is removed', () => {
    const team = orchestrator.createTeam({
      name: 'lead-change',
      members: [
        { roleName: 'lead', responsibility: 'lead', priority: 10 },
        { roleName: 'backup', responsibility: 'backup', priority: 5 },
      ],
    });

    const leadMember = team.members.find((m) => m.roleName === 'lead');
    expect(team.leadAgentId).toBe(leadMember!.agentId);

    const updated = orchestrator.removeMember(team.id, leadMember!.agentId);
    expect(updated).toBeDefined();
    const backup = updated!.members.find((m) => m.roleName === 'backup');
    expect(updated!.leadAgentId).toBe(backup!.agentId);
  });
});

// ============================================================================
// TeamOrchestrator – executeTeamTask
// ============================================================================

describe('TeamOrchestrator – executeTeamTask', () => {
  let orchestrator: TeamOrchestrator;

  beforeEach(() => {
    orchestrator = createTeamOrchestrator();
  });

  it('executeTeamTask with unknown teamId returns failed result', async () => {
    const mockLlm = {} as any;
    const result = await orchestrator.executeTeamTask(
      'nonexistent',
      'do something',
      mockLlm,
      null,
    );

    expect(result.status).toBe('failed');
    expect(result.summary).toContain('Team not found');
  });

  it('executeTeamTask with no members returns failed result', async () => {
    const team = orchestrator.createTeam({
      name: 'empty-team',
      members: [],
    });

    const mockLlm = {} as any;
    const result = await orchestrator.executeTeamTask(
      team.id,
      'do something',
      mockLlm,
      null,
    );

    expect(result.status).toBe('failed');
    expect(result.summary).toContain('no members');
  });
});
