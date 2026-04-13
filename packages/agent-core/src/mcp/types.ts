// ---------------------------------------------------------------------------
// @orbit/agent-core – MCP Management Types
// ---------------------------------------------------------------------------

/** MCP server connection status. */
export type McpServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/** MCP server statuses as a const tuple for runtime use. */
export const MCP_SERVER_STATUSES = [
  'connected',
  'disconnected',
  'connecting',
  'error',
] as const;

// ---- Transport configuration ----

/** Transport configuration for connecting to an MCP server. */
export type McpTransport =
  | {
      readonly type: 'stdio';
      readonly command: string;
      readonly args?: readonly string[];
      readonly env?: Readonly<Record<string, string>>;
    }
  | {
      readonly type: 'sse';
      readonly url: string;
      readonly headers?: Readonly<Record<string, string>>;
    }
  | {
      readonly type: 'streamable-http';
      readonly url: string;
      readonly headers?: Readonly<Record<string, string>>;
    };

// ---- Server capabilities ----

/** Capabilities advertised by an MCP server. */
export interface McpCapabilities {
  readonly tools: boolean;
  readonly resources: boolean;
  readonly prompts: boolean;
}

// ---- Tool & resource info ----

/** Descriptor for a tool provided by an MCP server. */
export interface McpToolInfo {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly serverId: string;
}

/** Descriptor for a resource provided by an MCP server. */
export interface McpResourceInfo {
  readonly uri: string;
  readonly name: string;
  readonly mimeType?: string;
  readonly description?: string;
  readonly serverId: string;
}

// ---- Server configuration ----

/** Full configuration and runtime state for a registered MCP server. */
export interface McpServerConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly transport: McpTransport;
  readonly status: McpServerStatus;
  readonly capabilities: McpCapabilities;
  readonly tools: readonly McpToolInfo[];
  readonly resources: readonly McpResourceInfo[];
  readonly installedAt: string;
  readonly lastConnectedAt?: string;
  readonly error?: string;
}

// ---- Install input ----

/** Input required to install a new MCP server. */
export interface McpInstallInput {
  readonly name: string;
  readonly description: string;
  readonly transport: McpTransport;
}

// ---- URL resolution result ----

/** Result of resolving an MCP server configuration from a URL. */
export interface McpResolveResult {
  readonly success: boolean;
  readonly config?: McpInstallInput;
  readonly error?: string;
  readonly sourceUrl: string;
}

// ---- Tool execution result ----

/** Result of executing a tool on an MCP server. */
export interface McpToolExecutionResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly durationMs: number;
  readonly serverId: string;
  readonly toolName: string;
}

// ---- Manager interface ----

/** Public interface for the MCP server manager. */
export interface McpManager {
  /** List all registered MCP servers. */
  listServers(): readonly McpServerConfig[];

  /** Get a specific server by ID. */
  getServer(id: string): McpServerConfig | undefined;

  /** Install an MCP server from an explicit configuration. */
  installFromConfig(input: McpInstallInput): McpServerConfig;

  /** Install an MCP server by resolving its config from a URL. */
  installFromUrl(url: string): Promise<McpServerConfig>;

  /** Uninstall a server (disconnects first if connected). */
  uninstall(id: string): boolean;

  /** Connect to a registered server. */
  connect(id: string): Promise<boolean>;

  /** Disconnect from a server. */
  disconnect(id: string): boolean;

  /** List tools exposed by a specific server. */
  listToolsFromServer(id: string): readonly McpToolInfo[];

  /** Execute a tool on a connected server. */
  executeToolOnServer(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolExecutionResult>;

  /** Return only servers whose status is 'connected'. */
  getConnectedServers(): readonly McpServerConfig[];
}
