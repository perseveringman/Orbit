// ---------------------------------------------------------------------------
// @orbit/agent-core – Team Task Decomposer
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { LLMAdapter } from '../llm-adapter.js';
import type { RoleRegistry } from '../roles/types.js';
import type {
  AgentTeamMember,
  TeamDecomposedTask,
  TeamExecutionPlan,
  TeamStrategy,
} from './types.js';

// ---- Keyword buckets for heuristic decomposition ----

const DOMAIN_KEYWORDS: ReadonlyMap<string, readonly string[]> = new Map([
  ['research', ['research', 'investigate', 'search', 'find', 'look up', 'explore', 'analyze']],
  ['writing', ['write', 'draft', 'compose', 'author', 'create', 'rewrite', 'edit']],
  ['planning', ['plan', 'break down', 'organise', 'organize', 'schedule', 'prioritize']],
  ['review', ['review', 'check', 'critique', 'evaluate', 'assess', 'feedback']],
  ['reading', ['read', 'extract', 'summarize', 'retrieve', 'parse']],
  ['ops', ['import', 'export', 'sync', 'deploy', 'migrate', 'backup', 'clean']],
  ['graph', ['link', 'connect', 'graph', 'relate', 'map', 'traverse']],
]);

// Ordering rules: domain A should run before domain B
const ORDERING_RULES: readonly [string, string][] = [
  ['research', 'writing'],
  ['research', 'review'],
  ['planning', 'writing'],
  ['planning', 'ops'],
  ['reading', 'writing'],
  ['reading', 'review'],
  ['writing', 'review'],
];

// ---- Public interface ----

export interface TeamTaskDecomposer {
  decompose(
    task: string,
    members: readonly AgentTeamMember[],
    roleRegistry: RoleRegistry,
  ): TeamExecutionPlan;

  decomposeWithLLM(
    task: string,
    members: readonly AgentTeamMember[],
    llm: LLMAdapter,
  ): Promise<TeamExecutionPlan>;
}

// ---- Implementation ----

class TeamTaskDecomposerImpl implements TeamTaskDecomposer {
  decompose(
    task: string,
    members: readonly AgentTeamMember[],
    _roleRegistry: RoleRegistry,
  ): TeamExecutionPlan {
    if (members.length === 0) {
      return this.emptyPlan(task);
    }

    const lower = task.toLowerCase();
    const relevantMembers = this.findRelevantMembers(lower, members);

    // If no members matched, assign to highest-priority member
    if (relevantMembers.length === 0) {
      const sorted = [...members].sort((a, b) => b.priority - a.priority);
      const member = sorted[0];
      const taskId = generateId('ttask');
      return {
        teamId: '',
        goal: task,
        tasks: [
          {
            id: taskId,
            description: task,
            assignedAgentId: member.agentId,
            assignedRoleName: member.roleName,
            dependsOn: [],
            priority: member.priority,
          },
        ],
        strategy: { type: 'sequential' },
        estimatedSteps: 1,
      };
    }

    // Single relevant member → direct assignment
    if (relevantMembers.length === 1) {
      const member = relevantMembers[0];
      const taskId = generateId('ttask');
      return {
        teamId: '',
        goal: task,
        tasks: [
          {
            id: taskId,
            description: task,
            assignedAgentId: member.agentId,
            assignedRoleName: member.roleName,
            dependsOn: [],
            priority: member.priority,
          },
        ],
        strategy: { type: 'sequential' },
        estimatedSteps: 1,
      };
    }

    // Multiple members – create subtask per member with dependency ordering
    const subtasks = this.buildOrderedSubtasks(task, relevantMembers);
    const strategy = this.inferStrategy(subtasks, relevantMembers);

    return {
      teamId: '',
      goal: task,
      tasks: subtasks,
      strategy,
      estimatedSteps: subtasks.length,
    };
  }

  async decomposeWithLLM(
    task: string,
    members: readonly AgentTeamMember[],
    llm: LLMAdapter,
  ): Promise<TeamExecutionPlan> {
    if (members.length === 0) {
      return this.emptyPlan(task);
    }

    const memberDescriptions = members
      .map(
        (m) =>
          `- ${m.roleName} (id: ${m.agentId}): ${m.responsibility} [priority: ${m.priority}]`,
      )
      .join('\n');

    const prompt = [
      'You are a task decomposition assistant. Given a high-level task and a set of team members, decompose the task into subtasks.',
      '',
      'Team members:',
      memberDescriptions,
      '',
      `Task: ${task}`,
      '',
      'Respond with a JSON object (no markdown fences) matching this schema:',
      '{',
      '  "subtasks": [',
      '    {',
      '      "description": "subtask description",',
      '      "assignedAgentId": "agent id from list above",',
      '      "assignedRoleName": "role name from list above",',
      '      "dependsOn": ["ids of subtasks this depends on (use array indices as temp ids: t0, t1, ...)"],',
      '      "priority": 1',
      '    }',
      '  ],',
      '  "strategy": "sequential" | "parallel" | "pipeline" | "orchestrated"',
      '}',
    ].join('\n');

    try {
      const response = await llm.chatCompletion({
        model: 'default',
        messages: [
          {
            id: generateId('msg'),
            role: 'system',
            content: 'You decompose tasks into structured subtask plans. Always respond with valid JSON only.',
            timestamp: new Date().toISOString(),
          },
          {
            id: generateId('msg'),
            role: 'user',
            content: prompt,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const content = response.choices[0]?.message.content ?? '';
      const parsed = JSON.parse(content) as {
        subtasks: {
          description: string;
          assignedAgentId: string;
          assignedRoleName: string;
          dependsOn?: string[];
          priority?: number;
        }[];
        strategy?: string;
      };

      // Map temp IDs (t0, t1, …) to real IDs
      const idMap = new Map<string, string>();
      const tasks: TeamDecomposedTask[] = parsed.subtasks.map((st, i) => {
        const realId = generateId('ttask');
        idMap.set(`t${i}`, realId);
        return {
          id: realId,
          description: st.description,
          assignedAgentId: st.assignedAgentId,
          assignedRoleName: st.assignedRoleName,
          dependsOn: (st.dependsOn ?? [])
            .map((dep) => idMap.get(dep))
            .filter((d): d is string => d !== undefined),
          priority: st.priority ?? parsed.subtasks.length - i,
        };
      });

      const strategyType = parsed.strategy ?? 'sequential';
      const strategy = this.parseStrategy(strategyType, tasks);

      return {
        teamId: '',
        goal: task,
        tasks,
        strategy,
        estimatedSteps: tasks.length,
      };
    } catch {
      // Fallback to heuristic decomposition with a no-op registry stub
      const stub: RoleRegistry = {
        listRoles: () => [],
        getRole: () => undefined,
        getRoleByName: () => undefined,
        createRole() { throw new Error('Fallback registry'); },
        updateRole: () => undefined,
        deleteRole: () => false,
        cloneRole: () => undefined,
        getBuiltinRoles: () => [],
        getCustomRoles: () => [],
        matchRole() { throw new Error('Fallback registry'); },
        resolveAgentConfig: () => undefined,
      };
      return this.decompose(task, members, stub);
    }
  }

  // ---- Private helpers ----

  private emptyPlan(task: string): TeamExecutionPlan {
    return {
      teamId: '',
      goal: task,
      tasks: [],
      strategy: { type: 'sequential' },
      estimatedSteps: 0,
    };
  }

  private findRelevantMembers(
    lowerTask: string,
    members: readonly AgentTeamMember[],
  ): AgentTeamMember[] {
    const scored: { member: AgentTeamMember; score: number }[] = [];

    for (const member of members) {
      let score = 0;
      const roleLower = member.roleName.toLowerCase();
      const respLower = member.responsibility.toLowerCase();

      // Check if member's role name appears in task
      if (lowerTask.includes(roleLower)) {
        score += 3;
      }

      // Check domain keyword matches
      for (const [domain, keywords] of DOMAIN_KEYWORDS) {
        const domainRelevant =
          roleLower.includes(domain) || respLower.includes(domain);
        if (!domainRelevant) continue;

        for (const kw of keywords) {
          if (lowerTask.includes(kw)) {
            score += kw.split(' ').length;
          }
        }
      }

      // Check if responsibility keywords appear in task
      const respWords = respLower.split(/\s+/);
      for (const word of respWords) {
        if (word.length > 3 && lowerTask.includes(word)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({ member, score });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .map((s) => s.member);
  }

  private buildOrderedSubtasks(
    task: string,
    members: readonly AgentTeamMember[],
  ): TeamDecomposedTask[] {
    const tasks: TeamDecomposedTask[] = [];
    const idByRole = new Map<string, string>();

    // Create a subtask per member
    for (const member of members) {
      const id = generateId('ttask');
      idByRole.set(member.roleName.toLowerCase(), id);

      tasks.push({
        id,
        description: `${member.responsibility}: ${task}`,
        assignedAgentId: member.agentId,
        assignedRoleName: member.roleName,
        dependsOn: [],
        priority: member.priority,
      });
    }

    // Apply ordering rules to set dependencies
    const roleNames = new Set(members.map((m) => m.roleName.toLowerCase()));
    const updatedTasks: TeamDecomposedTask[] = [];

    for (const t of tasks) {
      const tRole = t.assignedRoleName.toLowerCase();
      const deps: string[] = [];

      for (const [before, after] of ORDERING_RULES) {
        if (tRole.includes(after) && roleNames.has(before)) {
          // This task's role is an "after" domain and the "before" domain exists
          for (const [role, id] of idByRole) {
            if (role.includes(before)) {
              deps.push(id);
            }
          }
        }
      }

      updatedTasks.push({
        ...t,
        dependsOn: deps.length > 0 ? deps : t.dependsOn,
      });
    }

    return updatedTasks;
  }

  private inferStrategy(
    tasks: readonly TeamDecomposedTask[],
    _members: readonly AgentTeamMember[],
  ): TeamStrategy {
    if (tasks.length <= 1) {
      return { type: 'sequential' };
    }

    const hasDeps = tasks.some((t) => t.dependsOn.length > 0);
    if (!hasDeps) {
      return { type: 'parallel' };
    }

    // Check for a linear chain (pipeline)
    const isLinearChain = this.isLinearChain(tasks);
    if (isLinearChain) {
      return {
        type: 'pipeline',
        order: this.topologicalOrder(tasks),
      };
    }

    return { type: 'orchestrated' };
  }

  private isLinearChain(tasks: readonly TeamDecomposedTask[]): boolean {
    // Each task depends on at most one other, forming a single chain
    const roots = tasks.filter((t) => t.dependsOn.length === 0);
    if (roots.length !== 1) return false;

    const idSet = new Set(tasks.map((t) => t.id));
    let current = roots[0].id;
    const visited = new Set<string>();

    for (let i = 0; i < tasks.length; i++) {
      if (visited.has(current)) return false;
      visited.add(current);

      const next = tasks.find(
        (t) => t.dependsOn.length === 1 && t.dependsOn[0] === current,
      );
      if (!next && i < tasks.length - 1) return false;
      if (next) current = next.id;
    }

    return visited.size === idSet.size;
  }

  private topologicalOrder(tasks: readonly TeamDecomposedTask[]): string[] {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const t of tasks) {
      inDegree.set(t.id, t.dependsOn.length);
      if (!adj.has(t.id)) adj.set(t.id, []);
      for (const dep of t.dependsOn) {
        if (!adj.has(dep)) adj.set(dep, []);
        adj.get(dep)!.push(t.id);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      for (const neighbor of adj.get(current) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    return order;
  }

  private parseStrategy(
    type: string,
    tasks: readonly TeamDecomposedTask[],
  ): TeamStrategy {
    switch (type) {
      case 'parallel':
        return { type: 'parallel' };
      case 'pipeline':
        return { type: 'pipeline', order: this.topologicalOrder(tasks) };
      case 'orchestrated':
        return { type: 'orchestrated' };
      default:
        return { type: 'sequential' };
    }
  }
}

// ---- Factory ----

export function createTaskDecomposer(): TeamTaskDecomposer {
  return new TeamTaskDecomposerImpl();
}
