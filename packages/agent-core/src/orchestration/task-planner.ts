// ---------------------------------------------------------------------------
// @orbit/agent-core – Task Planner (M6)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { AgentConfig, AgentOutput } from './agent-executor.js';

// ---- Public types ----

export type ExecutionStrategy = 'sequential' | 'parallel' | 'pipeline';

export interface Subtask {
  readonly id: string;
  readonly description: string;
  readonly targetAgent: string;
  readonly dependsOn: readonly string[];
  readonly priority: number;
}

export interface TaskPlan {
  readonly id: string;
  readonly originalTask: string;
  readonly subtasks: readonly Subtask[];
  readonly strategy: ExecutionStrategy;
}

export interface SubtaskResult {
  readonly subtaskId: string;
  readonly output: AgentOutput;
  readonly status: 'completed' | 'error' | 'skipped';
}

// ---- Keyword → domain mapping for heuristic matching ----

const DOMAIN_KEYWORDS: readonly { readonly domain: string; readonly keywords: readonly string[] }[] = [
  { domain: 'planning', keywords: ['plan', 'break down', 'task', 'schedule', 'prioritize', 'organize'] },
  { domain: 'reading', keywords: ['read', 'find', 'look up', 'extract', 'show me', 'retrieve'] },
  { domain: 'research', keywords: ['research', 'search', 'investigate', 'compare', 'analyze', 'explore'] },
  { domain: 'writing', keywords: ['write', 'draft', 'compose', 'edit', 'rewrite', 'author'] },
  { domain: 'review', keywords: ['review', 'check', 'critique', 'feedback', 'evaluate', 'assess'] },
  { domain: 'graph', keywords: ['link', 'connect', 'graph', 'relate', 'map', 'traverse'] },
  { domain: 'ops', keywords: ['import', 'export', 'sync', 'backup', 'clean', 'migrate', 'deploy'] },
];

// Splitting delimiters to detect multi-step tasks
const STEP_DELIMITERS = /(?:^|\n)\s*(?:\d+[.)]\s|[-•]\s|then\s|and then\s|after that\s|finally\s|next\s)/i;

// ---- Task Planner ----

export class TaskPlanner {
  private readonly agents: Map<string, AgentConfig>;

  constructor(agents: readonly AgentConfig[]) {
    this.agents = new Map(agents.map((a) => [a.name, a]));
  }

  /**
   * Create a plan based on task description and available agents.
   * Uses keyword heuristics to decompose and assign subtasks.
   */
  plan(task: string, availableAgents: readonly string[]): TaskPlan {
    const filteredAgents = [...this.agents.values()].filter((a) =>
      availableAgents.includes(a.name),
    );

    const subtaskDescriptions = this.splitIntoSubtasks(task);
    const subtasks: Subtask[] = [];

    for (let i = 0; i < subtaskDescriptions.length; i++) {
      const desc = subtaskDescriptions[i];
      const targetAgent = this.matchAgent(desc, filteredAgents);

      subtasks.push({
        id: generateId('subtask'),
        description: desc,
        targetAgent,
        dependsOn: i > 0 ? [subtasks[i - 1].id] : [],
        priority: subtaskDescriptions.length - i,
      });
    }

    const strategy = this.determineStrategy(subtasks);

    return {
      id: generateId('plan'),
      originalTask: task,
      subtasks,
      strategy,
    };
  }

  /**
   * Split a task description into subtasks using simple heuristics.
   */
  private splitIntoSubtasks(task: string): string[] {
    // Try splitting by numbered steps or bullet points
    const parts = task.split(STEP_DELIMITERS).filter((s) => s.trim().length > 0);

    if (parts.length > 1) {
      return parts.map((p) => p.trim());
    }

    // Try splitting by sentence delimiters that indicate sequence
    const sentenceSplits = task
      .split(/[.;]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentenceSplits.length > 1) {
      return sentenceSplits;
    }

    // Single task
    return [task.trim()];
  }

  /**
   * Match a subtask description to the best available agent using keyword heuristics.
   */
  private matchAgent(subtaskDesc: string, agents: readonly AgentConfig[]): string {
    const lower = subtaskDesc.toLowerCase();
    let bestAgent = agents[0]?.name ?? 'unknown';
    let bestScore = 0;

    for (const agent of agents) {
      let score = 0;

      // Check domain keywords
      const domainEntry = DOMAIN_KEYWORDS.find((dk) => dk.domain === agent.domain);
      if (domainEntry) {
        for (const kw of domainEntry.keywords) {
          if (lower.includes(kw)) {
            score += kw.split(' ').length; // multi-word keywords score higher
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent.name;
      }
    }

    return bestAgent;
  }

  /**
   * Determine if subtasks can run in parallel based on dependency structure.
   */
  private determineStrategy(subtasks: readonly Subtask[]): ExecutionStrategy {
    if (subtasks.length <= 1) {
      return 'sequential';
    }

    // If all subtasks depend on the previous one in order, it's a pipeline
    const allChained = subtasks.every(
      (st, i) =>
        i === 0
          ? st.dependsOn.length === 0
          : st.dependsOn.length === 1 && st.dependsOn[0] === subtasks[i - 1].id,
    );

    if (allChained) {
      return 'pipeline';
    }

    // If no subtask has dependencies, it's parallel
    const noDeps = subtasks.every((st) => st.dependsOn.length === 0);
    if (noDeps) {
      return 'parallel';
    }

    return 'sequential';
  }
}
