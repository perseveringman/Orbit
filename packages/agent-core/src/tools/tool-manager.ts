// ---------------------------------------------------------------------------
// @orbit/agent-core – Unified Tool Manager
// ---------------------------------------------------------------------------

import type { RiskLevel, ApprovalPolicy } from '../types.js';
import type { BuiltinTool, ToolCategory } from './types.js';
import type { ToolsetRegistry } from './toolset-registry.js';
import type { ToolRegistry } from '../tool-registry.js';

// ---- Types ----

/** Indicates the origin of a managed tool. */
export type ToolSource = 'builtin' | 'app' | 'mcp' | 'skill';

/** A tool as surfaced by the unified manager. */
export interface ManagedTool {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly source: ToolSource;
  readonly serverName?: string;
  readonly riskLevel: RiskLevel;
  readonly approvalPolicy: ApprovalPolicy;
  readonly available: boolean;
}

/** Configuration for which tool sources are enabled. */
export interface ToolManagerConfig {
  readonly enableBuiltinTools: boolean;
  readonly enableAppTools: boolean;
  readonly enableMcpTools: boolean;
}

/** Result of executing a tool through the manager. */
export interface ToolExecutionResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly durationMs: number;
  readonly source: ToolSource;
  readonly toolName: string;
}

/** Summary of registered tool counts. */
export interface ToolCountSummary {
  readonly total: number;
  readonly bySource: Record<ToolSource, number>;
  readonly byCategory: Record<string, number>;
}

/** Unified interface for managing tools from all sources. */
export interface ToolManager {
  listAllTools(): readonly ManagedTool[];
  listToolsBySource(source: ToolSource): readonly ManagedTool[];
  listToolsByCategory(category: string): readonly ManagedTool[];
  listToolsForAgent(allowedTools: readonly string[], blockedTools: readonly string[]): readonly ManagedTool[];
  getTool(name: string): ManagedTool | undefined;
  executeTool(name: string, args: Record<string, unknown>): Promise<ToolExecutionResult>;
  getToolCount(): ToolCountSummary;
}

// ---- Helpers ----

/** Categories that map to 'builtin' source; everything else from ToolsetRegistry is 'app'. */
const BUILTIN_CATEGORIES: ReadonlySet<string> = new Set<ToolCategory>([
  'terminal',
  'filesystem',
  'web',
  'interaction',
  'code',
  'utility',
]);

function sourceForCategory(category: string): ToolSource {
  return BUILTIN_CATEGORIES.has(category) ? 'builtin' : 'app';
}

function sourceForName(name: string): ToolSource {
  if (name.startsWith('mcp:')) return 'mcp';
  if (name.startsWith('skill:')) return 'skill';
  return 'builtin';
}

function builtinToManaged(tool: BuiltinTool): ManagedTool {
  return {
    name: tool.name,
    description: tool.description,
    category: tool.category,
    source: sourceForCategory(tool.category),
    riskLevel: 'R0-read',
    approvalPolicy: 'A0-auto',
    available: true,
  };
}

// ---- Implementation ----

class ToolManagerImpl implements ToolManager {
  private readonly toolsetRegistry: ToolsetRegistry;
  private readonly toolRegistry: ToolRegistry | undefined;

  constructor(toolsetRegistry: ToolsetRegistry, toolRegistry?: ToolRegistry) {
    this.toolsetRegistry = toolsetRegistry;
    this.toolRegistry = toolRegistry;
  }

  listAllTools(): readonly ManagedTool[] {
    const managed: ManagedTool[] = [];

    // Tools from toolset registry (builtin + app)
    for (const tool of this.toolsetRegistry.getAllTools()) {
      managed.push(builtinToManaged(tool));
    }

    // Tools from ToolRegistry (may include MCP-bridged tools)
    if (this.toolRegistry) {
      const toolsetNames = new Set(managed.map((m) => m.name));
      for (const name of this.toolRegistry.getAllNames()) {
        if (toolsetNames.has(name)) continue; // already included via toolset
        const entry = this.toolRegistry.get(name);
        if (!entry) continue;
        const source = sourceForName(name);
        managed.push({
          name,
          description: entry.definition.description,
          category: entry.definition.domain,
          source,
          serverName: source === 'mcp' ? name.split(':')[1] : undefined,
          riskLevel: entry.definition.riskLevel,
          approvalPolicy: entry.definition.approvalPolicy,
          available: !entry.checkFn || entry.checkFn(),
        });
      }
    }

    return managed;
  }

  listToolsBySource(source: ToolSource): readonly ManagedTool[] {
    return this.listAllTools().filter((t) => t.source === source);
  }

  listToolsByCategory(category: string): readonly ManagedTool[] {
    return this.listAllTools().filter((t) => t.category === category);
  }

  listToolsForAgent(
    allowedTools: readonly string[],
    blockedTools: readonly string[],
  ): readonly ManagedTool[] {
    const blockedSet = new Set(blockedTools);
    const all = this.listAllTools().filter((t) => !blockedSet.has(t.name));

    if (allowedTools.length === 0) return all;

    const allowedSet = new Set(allowedTools);
    return all.filter((t) => allowedSet.has(t.name));
  }

  getTool(name: string): ManagedTool | undefined {
    return this.listAllTools().find((t) => t.name === name);
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();

    // Try toolset registry first (builtin / app tools)
    const builtinTool = this.toolsetRegistry.getTool(name);
    if (builtinTool) {
      try {
        const result = await builtinTool.execute(args);
        return {
          success: result.success,
          output: result.output,
          error: result.success ? undefined : result.output,
          durationMs: Date.now() - start,
          source: sourceForCategory(builtinTool.category),
          toolName: name,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          output: '',
          error: message,
          durationMs: Date.now() - start,
          source: sourceForCategory(builtinTool.category),
          toolName: name,
        };
      }
    }

    // Fall back to ToolRegistry (MCP-bridged, skill, etc.)
    if (this.toolRegistry) {
      const result = await this.toolRegistry.dispatch(name, args);
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        durationMs: result.durationMs,
        source: sourceForName(name),
        toolName: name,
      };
    }

    return {
      success: false,
      output: '',
      error: `Tool "${name}" not found.`,
      durationMs: Date.now() - start,
      source: 'builtin',
      toolName: name,
    };
  }

  getToolCount(): ToolCountSummary {
    const all = this.listAllTools();
    const bySource: Record<ToolSource, number> = { builtin: 0, app: 0, mcp: 0, skill: 0 };
    const byCategory: Record<string, number> = {};

    for (const tool of all) {
      bySource[tool.source] = (bySource[tool.source] ?? 0) + 1;
      byCategory[tool.category] = (byCategory[tool.category] ?? 0) + 1;
    }

    return { total: all.length, bySource, byCategory };
  }
}

// ---- Factory ----

/** Create a unified ToolManager from a ToolsetRegistry and an optional ToolRegistry. */
export function createToolManager(
  toolsetRegistry: ToolsetRegistry,
  toolRegistry?: ToolRegistry,
): ToolManager {
  return new ToolManagerImpl(toolsetRegistry, toolRegistry);
}
