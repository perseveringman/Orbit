// ---------------------------------------------------------------------------
// @orbit/agent-core – Tool Registry
// ---------------------------------------------------------------------------

import type {
  AgentDomain,
  AgentSurface,
  RiskLevel,
  ScopeLimit,
  ToolDefinition,
  ToolHandler,
} from './types.js';
import { RISK_LEVELS, SCOPE_LIMITS } from './types.js';

// ---- Public types ----

export interface ToolEntry {
  readonly definition: ToolDefinition;
  readonly handler: ToolHandler;
  readonly checkFn?: () => boolean;
}

export interface ToolFilters {
  readonly domain?: AgentDomain;
  readonly maxRiskLevel?: RiskLevel;
  readonly scopeLimit?: ScopeLimit;
  readonly surface?: AgentSurface;
}

export interface ToolResult {
  readonly toolName: string;
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly durationMs: number;
}

// ---- Helpers ----

export function createToolResult(toolName: string, output: string): ToolResult {
  return { toolName, success: true, output, durationMs: 0 };
}

export function createToolError(toolName: string, error: string): ToolResult {
  return { toolName, success: false, output: '', error, durationMs: 0 };
}

function riskOrdinal(level: RiskLevel): number {
  return RISK_LEVELS.indexOf(level);
}

function scopeOrdinal(scope: ScopeLimit): number {
  return SCOPE_LIMITS.indexOf(scope);
}

// Surface → domain affinity map for filtering tools by surface
const SURFACE_DOMAIN_AFFINITY: Record<AgentSurface, readonly AgentDomain[]> = {
  project: ['planning', 'reading', 'writing', 'review', 'graph', 'ops'],
  reader: ['reading', 'research'],
  research: ['research', 'reading', 'graph'],
  writing: ['writing', 'review'],
  journal: ['writing', 'reading'],
  'task-center': ['planning', 'ops'],
  'global-chat': ['planning', 'reading', 'research', 'writing', 'review', 'graph', 'ops'],
};

// ---- ToolRegistry ----

export class ToolRegistry {
  private readonly tools = new Map<string, ToolEntry>();

  register(
    definition: ToolDefinition,
    handler: ToolHandler,
    checkFn?: () => boolean,
  ): void {
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool "${definition.name}" is already registered`);
    }
    this.tools.set(definition.name, { definition, handler, checkFn });
  }

  deregister(name: string): void {
    if (!this.tools.has(name)) {
      throw new Error(`Tool "${name}" is not registered`);
    }
    this.tools.delete(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  getAllNames(): readonly string[] {
    return [...this.tools.keys()];
  }

  getByDomain(domain: AgentDomain): readonly ToolEntry[] {
    return [...this.tools.values()].filter((e) => e.definition.domain === domain);
  }

  getDefinitions(filters?: ToolFilters): readonly ToolDefinition[] {
    let entries = [...this.tools.values()];

    // Exclude tools whose check function returns false
    entries = entries.filter((e) => !e.checkFn || e.checkFn());

    if (filters?.domain) {
      const d = filters.domain;
      entries = entries.filter((e) => e.definition.domain === d);
    }

    if (filters?.maxRiskLevel) {
      const max = riskOrdinal(filters.maxRiskLevel);
      entries = entries.filter((e) => riskOrdinal(e.definition.riskLevel) <= max);
    }

    if (filters?.scopeLimit) {
      const max = scopeOrdinal(filters.scopeLimit);
      entries = entries.filter((e) => scopeOrdinal(e.definition.scopeLimit) <= max);
    }

    if (filters?.surface) {
      const allowed = SURFACE_DOMAIN_AFFINITY[filters.surface];
      entries = entries.filter((e) => allowed.includes(e.definition.domain));
    }

    return entries.map((e) => e.definition);
  }

  async dispatch(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const entry = this.tools.get(name);
    if (!entry) {
      return createToolError(name, `Tool "${name}" not found`);
    }

    if (entry.checkFn && !entry.checkFn()) {
      return createToolError(name, `Tool "${name}" is currently unavailable`);
    }

    const start = Date.now();
    try {
      const output = await entry.handler(args);
      return {
        toolName: name,
        success: true,
        output,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        toolName: name,
        success: false,
        output: '',
        error: message,
        durationMs: Date.now() - start,
      };
    }
  }
}
