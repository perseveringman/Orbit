// ---------------------------------------------------------------------------
// @orbit/agent-core – Lead Agent
// ---------------------------------------------------------------------------

import type { RoleRegistry, AgentRoleDefinition } from '../roles/types.js';
import type {
  CreateTeamInput,
  TeamMemberResult,
  TeamStrategy,
} from './types.js';

// ---- Public types ----

export interface TaskAnalysis {
  readonly complexity: 'simple' | 'moderate' | 'complex';
  readonly domains: readonly string[];
  readonly requiresTeam: boolean;
  readonly suggestedStrategy: TeamStrategy;
  readonly reasoning: string;
}

export interface LeadAgent {
  analyzeTask(task: string): TaskAnalysis;
  assembleTeam(task: string, roleRegistry: RoleRegistry): CreateTeamInput;
  summarizeResults(results: readonly TeamMemberResult[]): string;
  shouldDelegate(task: string): boolean;
}

// ---- Keyword → domain mapping ----

const DOMAIN_SIGNALS: ReadonlyMap<string, readonly string[]> = new Map([
  ['planning', ['plan', 'break down', 'organize', 'schedule', 'prioritize', 'roadmap']],
  ['reading', ['read', 'find', 'look up', 'extract', 'show me', 'retrieve', 'parse']],
  ['research', ['research', 'search', 'investigate', 'compare', 'analyze', 'explore', 'study']],
  ['writing', ['write', 'draft', 'compose', 'edit', 'rewrite', 'author', 'document']],
  ['review', ['review', 'check', 'critique', 'feedback', 'evaluate', 'assess', 'audit']],
  ['graph', ['link', 'connect', 'graph', 'relate', 'map', 'traverse', 'network']],
  ['ops', ['import', 'export', 'sync', 'backup', 'clean', 'migrate', 'deploy', 'configure']],
]);

// Multi-step indicators
const MULTI_STEP_SIGNALS = [
  'then',
  'and then',
  'after that',
  'finally',
  'first',
  'next',
  'step',
  'followed by',
];

// ---- Implementation ----

class LeadAgentImpl implements LeadAgent {
  analyzeTask(task: string): TaskAnalysis {
    const lower = task.toLowerCase();
    const domains = this.detectDomains(lower);
    const isMultiStep = this.hasMultiStepSignals(lower);

    let complexity: 'simple' | 'moderate' | 'complex';
    let requiresTeam: boolean;
    let reasoning: string;

    if (domains.length >= 3 || (domains.length >= 2 && isMultiStep)) {
      complexity = 'complex';
      requiresTeam = true;
      reasoning = `Task spans ${domains.length} domains (${domains.join(', ')})${isMultiStep ? ' with multi-step indicators' : ''}. Full team recommended.`;
    } else if (domains.length === 2) {
      complexity = 'moderate';
      requiresTeam = true;
      reasoning = `Task involves ${domains.join(' and ')}. Small team recommended.`;
    } else {
      complexity = 'simple';
      requiresTeam = false;
      reasoning = domains.length === 1
        ? `Single-domain task (${domains[0]}). Direct execution sufficient.`
        : 'Task is straightforward. Direct execution sufficient.';
    }

    const suggestedStrategy = this.suggestStrategy(domains, isMultiStep);

    return { complexity, domains, requiresTeam, suggestedStrategy, reasoning };
  }

  assembleTeam(task: string, roleRegistry: RoleRegistry): CreateTeamInput {
    const analysis = this.analyzeTask(task);
    const roles = roleRegistry.listRoles();

    if (roles.length === 0) {
      return {
        name: 'default-team',
        description: `Team for: ${task}`,
        members: [],
        strategy: analysis.suggestedStrategy,
      };
    }

    const selectedRoles = this.selectRolesForDomains(analysis.domains, roles);

    // If no roles matched the detected domains, pick the best general match
    if (selectedRoles.length === 0 && roles.length > 0) {
      const fallback = this.bestFallbackRole(task, roles);
      if (fallback) {
        selectedRoles.push(fallback);
      }
    }

    const members = selectedRoles.map((role, index) => ({
      roleId: role.id,
      roleName: role.name,
      responsibility: this.assignResponsibility(task, role, analysis.domains),
      priority: selectedRoles.length - index,
    }));

    return {
      name: this.generateTeamName(analysis.domains),
      description: `Team assembled for: ${task}`,
      members,
      strategy: analysis.suggestedStrategy,
    };
  }

  summarizeResults(results: readonly TeamMemberResult[]): string {
    if (results.length === 0) {
      return 'No results were produced.';
    }

    const sections: string[] = [];

    const completed = results.filter((r) => r.status === 'completed');
    const errors = results.filter((r) => r.status === 'error');
    const skipped = results.filter((r) => r.status === 'skipped');

    if (completed.length > 0) {
      sections.push('## Results\n');
      for (const r of completed) {
        sections.push(`**${r.roleName}** (${r.subtask}):`);
        sections.push(r.output.response);
        sections.push('');
      }
    }

    if (errors.length > 0) {
      sections.push('## Errors\n');
      for (const r of errors) {
        sections.push(`**${r.roleName}**: ${r.output.response}`);
      }
      sections.push('');
    }

    if (skipped.length > 0) {
      sections.push(`## Skipped\n`);
      for (const r of skipped) {
        sections.push(`- ${r.roleName}: ${r.subtask}`);
      }
      sections.push('');
    }

    const totalTokens = results.reduce(
      (sum, r) => sum + r.output.tokenUsage.totalTokens,
      0,
    );
    sections.push(
      `---\n*${completed.length} completed, ${errors.length} errors, ${skipped.length} skipped. Total tokens: ${totalTokens}*`,
    );

    return sections.join('\n');
  }

  shouldDelegate(task: string): boolean {
    const analysis = this.analyzeTask(task);
    return analysis.requiresTeam;
  }

  // ---- Private helpers ----

  private detectDomains(lower: string): string[] {
    const detected: string[] = [];

    for (const [domain, keywords] of DOMAIN_SIGNALS) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          detected.push(domain);
          break;
        }
      }
    }

    return detected;
  }

  private hasMultiStepSignals(lower: string): boolean {
    return MULTI_STEP_SIGNALS.some((signal) => lower.includes(signal));
  }

  private suggestStrategy(
    domains: readonly string[],
    isMultiStep: boolean,
  ): TeamStrategy {
    if (domains.length <= 1) {
      return { type: 'sequential' };
    }

    // If multi-step signals detected, prefer sequential/pipeline
    if (isMultiStep) {
      return { type: 'pipeline', order: [...domains] };
    }

    // Check if domains have natural ordering (research→writing, etc.)
    const hasOrdering = this.domainsHaveNaturalOrder(domains);
    if (hasOrdering) {
      return { type: 'pipeline', order: [...domains] };
    }

    // Independent domains → parallel
    return { type: 'parallel' };
  }

  private domainsHaveNaturalOrder(domains: readonly string[]): boolean {
    const orderedPairs: readonly [string, string][] = [
      ['research', 'writing'],
      ['research', 'review'],
      ['planning', 'writing'],
      ['planning', 'ops'],
      ['reading', 'writing'],
      ['writing', 'review'],
    ];

    for (const [before, after] of orderedPairs) {
      if (domains.includes(before) && domains.includes(after)) {
        return true;
      }
    }

    return false;
  }

  private selectRolesForDomains(
    domains: readonly string[],
    roles: readonly AgentRoleDefinition[],
  ): AgentRoleDefinition[] {
    const selected: AgentRoleDefinition[] = [];
    const usedIds = new Set<string>();

    for (const domain of domains) {
      // Find a role whose specializations or name match the domain
      const match = roles.find(
        (r) =>
          !usedIds.has(r.id) &&
          (r.specializations.some((s) => s.toLowerCase().includes(domain)) ||
            r.name.toLowerCase().includes(domain) ||
            r.description.toLowerCase().includes(domain)),
      );

      if (match) {
        selected.push(match);
        usedIds.add(match.id);
      }
    }

    return selected;
  }

  private bestFallbackRole(
    task: string,
    roles: readonly AgentRoleDefinition[],
  ): AgentRoleDefinition | undefined {
    const lower = task.toLowerCase();
    let best: AgentRoleDefinition | undefined;
    let bestScore = 0;

    for (const role of roles) {
      let score = 0;
      const nameLower = role.name.toLowerCase();
      const descLower = role.description.toLowerCase();

      if (lower.includes(nameLower)) score += 3;

      const descWords = descLower.split(/\s+/);
      for (const w of descWords) {
        if (w.length > 3 && lower.includes(w)) score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        best = role;
      }
    }

    return best ?? roles[0];
  }

  private assignResponsibility(
    task: string,
    role: AgentRoleDefinition,
    domains: readonly string[],
  ): string {
    // Build a concise responsibility from the role's specializations and the task context
    const matchedDomains = domains.filter(
      (d) =>
        role.specializations.some((s) => s.toLowerCase().includes(d)) ||
        role.name.toLowerCase().includes(d),
    );

    if (matchedDomains.length > 0) {
      return `Handle ${matchedDomains.join(' and ')} aspects of the task`;
    }

    return `Contribute ${role.name} expertise to the task`;
  }

  private generateTeamName(domains: readonly string[]): string {
    if (domains.length === 0) return 'general-team';
    if (domains.length === 1) return `${domains[0]}-team`;
    return `${domains.slice(0, 3).join('-')}-team`;
  }
}

// ---- Factory ----

export function createLeadAgent(): LeadAgent {
  return new LeadAgentImpl();
}
