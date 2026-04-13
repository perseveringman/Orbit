// ---------------------------------------------------------------------------
// @orbit/agent-core – MCP Tool Bridge
//
// Bridges tools exposed by MCP servers into the local ToolRegistry so they
// can be dispatched like any other Orbit tool.
// ---------------------------------------------------------------------------

import type { ToolDefinition, ToolHandler } from '../types.js';
import type { ToolRegistry } from '../tool-registry.js';
import type { McpManager, McpServerConfig, McpToolInfo } from './types.js';

// ---- Namespace helpers ----

/** Build a namespaced tool name: `mcp:<serverName>:<toolName>`. */
function namespacedToolName(serverName: string, toolName: string): string {
  return `mcp:${serverName}:${toolName}`;
}

// ---- McpToolBridge ----

/**
 * Registers MCP server tools into a {@link ToolRegistry}, creating a handler
 * for each that delegates execution back to the {@link McpManager}.
 */
export class McpToolBridge {
  constructor(private readonly mcpManager: McpManager) {}

  /**
   * Register all tools from a connected MCP server into the ToolRegistry.
   *
   * @returns The list of namespaced tool names that were registered.
   */
  bridgeTools(server: McpServerConfig, toolRegistry: ToolRegistry): readonly string[] {
    const registered: string[] = [];

    for (const tool of server.tools) {
      const fullName = namespacedToolName(server.name, tool.name);

      // Skip if already registered (idempotent)
      if (toolRegistry.has(fullName)) {
        continue;
      }

      const definition = this.buildDefinition(fullName, tool, server);
      const handler = this.buildHandler(server.id, tool.name);

      toolRegistry.register(definition, handler);
      registered.push(fullName);
    }

    return registered;
  }

  /**
   * Remove all bridged tools for a server from the ToolRegistry.
   *
   * @returns The list of namespaced tool names that were deregistered.
   */
  unbridgeTools(serverName: string, toolRegistry: ToolRegistry): readonly string[] {
    const prefix = `mcp:${serverName}:`;
    const removed: string[] = [];

    for (const name of toolRegistry.getAllNames()) {
      if (name.startsWith(prefix)) {
        toolRegistry.deregister(name);
        removed.push(name);
      }
    }

    return removed;
  }

  // -- Private helpers --

  /** Map an MCP tool descriptor to an Orbit ToolDefinition. */
  private buildDefinition(
    fullName: string,
    tool: McpToolInfo,
    server: McpServerConfig,
  ): ToolDefinition {
    return {
      name: fullName,
      domain: 'ops',
      description: `[MCP:${server.name}] ${tool.description}`,
      inputSchema: tool.inputSchema,
      riskLevel: 'R2-external-read',
      approvalPolicy: 'A2-confirm',
      executionMode: 'sync',
      scopeLimit: 'workspace',
      dataBoundary: 'can-egress',
    };
  }

  /** Create a handler that delegates execution to the MCP manager. */
  private buildHandler(serverId: string, toolName: string): ToolHandler {
    const manager = this.mcpManager;

    return async (args: Record<string, unknown>): Promise<string> => {
      const result = await manager.executeToolOnServer(serverId, toolName, args);

      if (!result.success) {
        throw new Error(result.error ?? `MCP tool "${toolName}" execution failed`);
      }

      return result.output;
    };
  }
}

// ---- Factory ----

/** Create a new {@link McpToolBridge} instance. */
export function createMcpToolBridge(mcpManager: McpManager): McpToolBridge {
  return new McpToolBridge(mcpManager);
}
