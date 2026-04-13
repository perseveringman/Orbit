// ---------------------------------------------------------------------------
// Main process — MCP server management bridge
//
// Manages MCP server lifecycle (install, connect, disconnect, tool execution)
// and exposes it via IPC to the renderer process.
// ---------------------------------------------------------------------------

import { ipcMain } from 'electron';
import { createMcpManager } from '@orbit/agent-core';
import type { McpManager, McpTransport } from '@orbit/agent-core';
import type {
  McpInstallRequest,
  McpServerInfo,
  McpToolExecRequest,
  McpToolExecResponse,
} from '../shared/contracts';

let manager: McpManager | null = null;

function getManager(): McpManager {
  if (!manager) {
    manager = createMcpManager();
    console.log('[McpBridge] McpManager initialized');
  }
  return manager;
}

function toServerInfo(server: {
  id: string;
  name: string;
  description: string;
  transport: McpTransport;
  status: string;
  tools: readonly { name: string; description: string; inputSchema: Readonly<Record<string, unknown>> }[];
  installedAt: string;
  lastConnectedAt?: string;
  error?: string;
}): McpServerInfo {
  return {
    id: server.id,
    name: server.name,
    description: server.description,
    transportType: server.transport.type,
    status: server.status as McpServerInfo['status'],
    tools: server.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    })),
    installedAt: server.installedAt,
    lastConnectedAt: server.lastConnectedAt,
    error: server.error,
  };
}

export function registerMcpBridgeHandlers(): void {
  // List servers
  ipcMain.handle('mcp:list-servers', async (): Promise<McpServerInfo[]> => {
    const mgr = getManager();
    return mgr.listServers().map(toServerInfo);
  });

  // Install server
  ipcMain.handle('mcp:install', async (_event, request: McpInstallRequest): Promise<McpServerInfo> => {
    const mgr = getManager();
    const transport: McpTransport = request.transport.type === 'stdio'
      ? { type: 'stdio', command: request.transport.command ?? '', args: request.transport.args }
      : request.transport.type === 'sse'
        ? { type: 'sse', url: request.transport.url ?? '', headers: request.transport.headers }
        : { type: 'streamable-http', url: request.transport.url ?? '', headers: request.transport.headers };

    const config = mgr.installFromConfig({
      name: request.name,
      description: request.description,
      transport,
    });
    return toServerInfo(config);
  });

  // Uninstall server
  ipcMain.handle('mcp:uninstall', async (_event, serverId: string): Promise<boolean> => {
    return getManager().uninstall(serverId);
  });

  // Connect
  ipcMain.handle('mcp:connect', async (_event, serverId: string): Promise<boolean> => {
    return getManager().connect(serverId);
  });

  // Disconnect
  ipcMain.handle('mcp:disconnect', async (_event, serverId: string): Promise<boolean> => {
    return getManager().disconnect(serverId);
  });

  // Execute tool
  ipcMain.handle('mcp:execute-tool', async (_event, request: McpToolExecRequest): Promise<McpToolExecResponse> => {
    const mgr = getManager();
    const result = await mgr.executeToolOnServer(request.serverId, request.toolName, request.args);
    return {
      success: result.success,
      output: result.output,
      error: result.error,
      durationMs: result.durationMs,
    };
  });

  console.log('[McpBridge] IPC handlers registered');
}
