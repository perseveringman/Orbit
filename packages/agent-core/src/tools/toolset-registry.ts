// ---------------------------------------------------------------------------
// @orbit/agent-core – Toolset Registry (M8)
// ---------------------------------------------------------------------------

import type { ToolDefinition } from '../types.js';
import type { BuiltinTool, ToolCategory, ToolOutput } from './types.js';
import { shellExecTool } from './terminal-tools.js';
import { fileReadTool, fileWriteTool, fileListTool, fileSearchTool, grepTool } from './filesystem-tools.js';
import { webFetchTool, webSearchTool } from './web-tools.js';
import { askUserTool } from './interaction-tools.js';
import { datetimeTool, jsonParseTool, textTransformTool, calculateTool } from './utility-tools.js';

// ---- Toolset ----

export interface Toolset {
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly tools: readonly BuiltinTool[];
}

// ---- Pre-built toolsets ----

export const CORE_TOOLSETS: readonly Toolset[] = [
  {
    name: 'terminal',
    description: 'Shell command execution',
    category: 'terminal',
    tools: [shellExecTool],
  },
  {
    name: 'filesystem',
    description: 'File system operations',
    category: 'filesystem',
    tools: [fileReadTool, fileWriteTool, fileListTool, fileSearchTool, grepTool],
  },
  {
    name: 'web',
    description: 'Web fetching and search',
    category: 'web',
    tools: [webFetchTool, webSearchTool],
  },
  {
    name: 'interaction',
    description: 'User interaction',
    category: 'interaction',
    tools: [askUserTool],
  },
  {
    name: 'utility',
    description: 'General utilities',
    category: 'utility',
    tools: [datetimeTool, jsonParseTool, textTransformTool, calculateTool],
  },
];

// ---- ToolsetRegistry ----

export class ToolsetRegistry {
  private readonly toolsets = new Map<string, Toolset>();
  private readonly allTools = new Map<string, BuiltinTool>();

  /** Register a toolset. All contained tools are indexed by name. */
  register(toolset: Toolset): void {
    if (this.toolsets.has(toolset.name)) {
      throw new Error(`Toolset "${toolset.name}" is already registered.`);
    }

    for (const tool of toolset.tools) {
      if (this.allTools.has(tool.name)) {
        throw new Error(`Tool "${tool.name}" is already registered (from another toolset).`);
      }
    }

    this.toolsets.set(toolset.name, toolset);
    for (const tool of toolset.tools) {
      this.allTools.set(tool.name, tool);
    }
  }

  /** Get a single tool by name. */
  getTool(name: string): BuiltinTool | undefined {
    return this.allTools.get(name);
  }

  /** Get all tools that belong to a given category. */
  getByCategory(category: ToolCategory): readonly BuiltinTool[] {
    return [...this.allTools.values()].filter((t) => t.category === category);
  }

  /** Get every registered tool. */
  getAllTools(): readonly BuiltinTool[] {
    return [...this.allTools.values()];
  }

  /** List all registered toolsets. */
  listToolsets(): readonly Toolset[] {
    return [...this.toolsets.values()];
  }

  /**
   * Convert all registered tools into ToolDefinition[] suitable for
   * passing to an LLM chat-completion call.
   */
  toToolDefinitions(): readonly ToolDefinition[] {
    return [...this.allTools.values()].map((tool): ToolDefinition => ({
      name: tool.name,
      domain: 'ops',
      description: tool.description,
      inputSchema: tool.parameters as Readonly<Record<string, unknown>>,
      riskLevel: 'R0-read',
      approvalPolicy: 'A0-auto',
      executionMode: 'sync',
      scopeLimit: 'workspace',
      dataBoundary: 'local-only',
    }));
  }

  /** Total number of individual tools registered. */
  get size(): number {
    return this.allTools.size;
  }
}

// ---- Factory ----

/** Create a ToolsetRegistry pre-loaded with all core toolsets. */
export function createDefaultToolsetRegistry(): ToolsetRegistry {
  const registry = new ToolsetRegistry();
  for (const toolset of CORE_TOOLSETS) {
    registry.register(toolset);
  }
  return registry;
}
