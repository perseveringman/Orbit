// ---------------------------------------------------------------------------
// @orbit/capability-core – External MCP Client (Wave 2-C)
// ---------------------------------------------------------------------------

import type { McpResource, McpResourceContent, McpTool, McpToolResult } from './mcp-server.js';

export interface McpClientConfig {
  readonly serverUrl: string;
  readonly name: string;
  readonly version: string;
  readonly timeout?: number;
}

export interface McpClient {
  readonly config: McpClientConfig;
  connect(): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  listResources(): Promise<readonly McpResource[]>;
  readResource(uri: string): Promise<McpResourceContent | null>;
  listTools(): Promise<readonly McpTool[]>;
  executeTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  listPrompts(): Promise<readonly { name: string; description: string }[]>;
  getPrompt(name: string, args: Record<string, string>): Promise<string | null>;
}

export interface CandidateCapability {
  readonly source: 'external';
  readonly serverName: string;
  readonly tool: McpTool;
  readonly discoveredAt: string;
}

export function createMcpClient(config: McpClientConfig): McpClient {
  let connected = false;

  // In-memory stub storage for simulated external server state
  const remoteResources: McpResource[] = [];
  const remoteTools: McpTool[] = [];
  const remotePrompts: { name: string; description: string }[] = [];

  return {
    config,

    async connect(): Promise<boolean> {
      // Stub: simulate a connection attempt
      connected = true;
      return true;
    },

    disconnect(): void {
      connected = false;
    },

    isConnected(): boolean {
      return connected;
    },

    async listResources(): Promise<readonly McpResource[]> {
      if (!connected) throw new Error('Not connected');
      return remoteResources;
    },

    async readResource(_uri: string): Promise<McpResourceContent | null> {
      if (!connected) throw new Error('Not connected');
      return null;
    },

    async listTools(): Promise<readonly McpTool[]> {
      if (!connected) throw new Error('Not connected');
      return remoteTools;
    },

    async executeTool(name: string, _args: Record<string, unknown>): Promise<McpToolResult> {
      if (!connected) throw new Error('Not connected');
      return { success: false, content: `Remote tool "${name}" not implemented`, isError: true };
    },

    async listPrompts(): Promise<readonly { name: string; description: string }[]> {
      if (!connected) throw new Error('Not connected');
      return remotePrompts;
    },

    async getPrompt(_name: string, _args: Record<string, string>): Promise<string | null> {
      if (!connected) throw new Error('Not connected');
      return null;
    },
  };
}
