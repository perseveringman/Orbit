// ---------------------------------------------------------------------------
// @orbit/agent-core – MCP Manager Implementation
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type {
  McpInstallInput,
  McpManager,
  McpServerConfig,
  McpToolExecutionResult,
  McpToolInfo,
} from './types.js';
import type { McpInstaller } from './mcp-installer.js';

// ---- McpManagerImpl ----

/**
 * In-memory implementation of {@link McpManager}.
 *
 * Manages the lifecycle of MCP servers: install, connect, disconnect,
 * tool discovery, tool execution, and uninstall.
 */
export class McpManagerImpl implements McpManager {
  private readonly servers = new Map<string, McpServerConfig>();

  constructor(private readonly installer?: McpInstaller) {}

  // -- Queries --

  listServers(): readonly McpServerConfig[] {
    return [...this.servers.values()];
  }

  getServer(id: string): McpServerConfig | undefined {
    return this.servers.get(id);
  }

  getConnectedServers(): readonly McpServerConfig[] {
    return [...this.servers.values()].filter((s) => s.status === 'connected');
  }

  listToolsFromServer(id: string): readonly McpToolInfo[] {
    const server = this.servers.get(id);
    if (!server) {
      return [];
    }
    return server.tools;
  }

  // -- Install / uninstall --

  installFromConfig(input: McpInstallInput): McpServerConfig {
    const id = generateId('mcp');
    const config: McpServerConfig = {
      id,
      name: input.name,
      description: input.description,
      transport: input.transport,
      status: 'disconnected',
      capabilities: { tools: false, resources: false, prompts: false },
      tools: [],
      resources: [],
      installedAt: new Date().toISOString(),
    };
    this.servers.set(id, config);
    return config;
  }

  async installFromUrl(url: string): Promise<McpServerConfig> {
    if (!this.installer) {
      throw new Error('McpInstaller is not configured — cannot install from URL');
    }

    const result = await this.installer.resolve(url);
    if (!result.success || !result.config) {
      throw new Error(result.error ?? `Failed to resolve MCP config from ${url}`);
    }

    return this.installFromConfig(result.config);
  }

  uninstall(id: string): boolean {
    const server = this.servers.get(id);
    if (!server) {
      return false;
    }

    // Disconnect first if still connected
    if (server.status === 'connected' || server.status === 'connecting') {
      this.disconnect(id);
    }

    return this.servers.delete(id);
  }

  // -- Connect / disconnect --

  async connect(id: string): Promise<boolean> {
    const server = this.servers.get(id);
    if (!server) {
      return false;
    }

    // Transition to connecting
    this.servers.set(id, { ...server, status: 'connecting' });

    try {
      // Simulate transport-specific connection and tool discovery.
      // A real implementation would spawn a stdio process, open an SSE
      // stream, or establish an HTTP session here.
      const discoveredTools = await this.discoverTools(id, server);

      this.servers.set(id, {
        ...server,
        status: 'connected',
        capabilities: { tools: discoveredTools.length > 0, resources: false, prompts: false },
        tools: discoveredTools,
        lastConnectedAt: new Date().toISOString(),
        error: undefined,
      });

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.servers.set(id, {
        ...server,
        status: 'error',
        error: message,
      });
      return false;
    }
  }

  disconnect(id: string): boolean {
    const server = this.servers.get(id);
    if (!server) {
      return false;
    }

    this.servers.set(id, {
      ...server,
      status: 'disconnected',
      error: undefined,
    });

    return true;
  }

  // -- Tool execution --

  async executeToolOnServer(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolExecutionResult> {
    const server = this.servers.get(serverId);
    if (!server) {
      return {
        success: false,
        output: '',
        error: `Server "${serverId}" not found`,
        durationMs: 0,
        serverId,
        toolName,
      };
    }

    if (server.status !== 'connected') {
      return {
        success: false,
        output: '',
        error: `Server "${serverId}" is not connected (status: ${server.status})`,
        durationMs: 0,
        serverId,
        toolName,
      };
    }

    const tool = server.tools.find((t) => t.name === toolName);
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool "${toolName}" not found on server "${serverId}"`,
        durationMs: 0,
        serverId,
        toolName,
      };
    }

    const start = Date.now();
    try {
      // In a production implementation this would send a tools/call
      // JSON-RPC request over the server's transport. For now we return
      // a structured placeholder indicating the call was dispatched.
      const output = JSON.stringify({
        status: 'executed',
        tool: toolName,
        server: serverId,
        args,
      });

      return {
        success: true,
        output,
        durationMs: Date.now() - start,
        serverId,
        toolName,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: '',
        error: message,
        durationMs: Date.now() - start,
        serverId,
        toolName,
      };
    }
  }

  // -- Private helpers --

  /**
   * Simulate MCP tool discovery.
   *
   * A real implementation would issue a `tools/list` JSON-RPC call over
   * the transport. Here we return an empty array — actual tools will be
   * populated once the MCP protocol client is wired up.
   */
  private async discoverTools(
    _id: string,
    _server: McpServerConfig,
  ): Promise<readonly McpToolInfo[]> {
    // Placeholder — the real MCP protocol handshake would go here.
    return [];
  }
}

// ---- Factory ----

/** Create a new {@link McpManager} instance. */
export function createMcpManager(installer?: McpInstaller): McpManager {
  return new McpManagerImpl(installer);
}
