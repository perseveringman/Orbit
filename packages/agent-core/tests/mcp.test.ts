// ---------------------------------------------------------------------------
// @orbit/agent-core – MCP System Tests
// ---------------------------------------------------------------------------

import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  McpManagerImpl,
  createMcpManager,
  McpInstaller,
  createMcpInstaller,
  McpToolBridge,
  createMcpToolBridge,
} from '../src/mcp/index';

import type {
  McpInstallInput,
  McpManager,
  McpServerConfig,
  McpToolInfo,
} from '../src/mcp/index';

import { ToolRegistry } from '../src/tool-registry';
import type { LLMAdapter } from '../src/llm-adapter';

// ---- Helpers ----

function makeStdioInput(name = 'test-server'): McpInstallInput {
  return {
    name,
    description: `MCP server: ${name}`,
    transport: { type: 'stdio', command: 'npx', args: ['@test/mcp'] },
  };
}

function makeSseInput(name = 'sse-server'): McpInstallInput {
  return {
    name,
    description: `SSE MCP server: ${name}`,
    transport: { type: 'sse', url: 'https://example.com/sse' },
  };
}

// ==========================================================================
// McpManager
// ==========================================================================

describe('McpManager', () => {
  let manager: McpManager;

  beforeEach(() => {
    manager = createMcpManager();
  });

  it('creates a manager with the factory function', () => {
    expect(manager).toBeDefined();
    expect(typeof manager.listServers).toBe('function');
  });

  it('installs a server from config', () => {
    const server = manager.installFromConfig(makeStdioInput());
    expect(server.id).toMatch(/^mcp_/);
    expect(server.name).toBe('test-server');
    expect(server.status).toBe('disconnected');
    expect(server.transport.type).toBe('stdio');
  });

  it('lists servers (includes installed)', () => {
    manager.installFromConfig(makeStdioInput('srv-1'));
    manager.installFromConfig(makeSseInput('srv-2'));
    const servers = manager.listServers();
    expect(servers).toHaveLength(2);
    expect(servers.map((s) => s.name)).toContain('srv-1');
    expect(servers.map((s) => s.name)).toContain('srv-2');
  });

  it('gets a server by ID', () => {
    const installed = manager.installFromConfig(makeStdioInput('findme'));
    const found = manager.getServer(installed.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('findme');
  });

  it('returns undefined for unknown server ID', () => {
    expect(manager.getServer('nonexistent')).toBeUndefined();
  });

  it('connects to a server (status changes to connected)', async () => {
    const server = manager.installFromConfig(makeStdioInput());
    const connected = await manager.connect(server.id);
    expect(connected).toBe(true);

    const updated = manager.getServer(server.id);
    expect(updated!.status).toBe('connected');
    expect(updated!.lastConnectedAt).toBeTruthy();
  });

  it('connect returns false for nonexistent server', async () => {
    const result = await manager.connect('nonexistent');
    expect(result).toBe(false);
  });

  it('disconnects from a server', async () => {
    const server = manager.installFromConfig(makeStdioInput());
    await manager.connect(server.id);
    expect(manager.getServer(server.id)!.status).toBe('connected');

    const result = manager.disconnect(server.id);
    expect(result).toBe(true);
    expect(manager.getServer(server.id)!.status).toBe('disconnected');
  });

  it('disconnect returns false for nonexistent server', () => {
    expect(manager.disconnect('nonexistent')).toBe(false);
  });

  it('lists tools from server (empty for simulated connection)', async () => {
    const server = manager.installFromConfig(makeStdioInput());
    await manager.connect(server.id);

    const tools = manager.listToolsFromServer(server.id);
    // The simulated connection returns empty tools
    expect(Array.isArray(tools)).toBe(true);
  });

  it('returns empty array for tools from unknown server', () => {
    expect(manager.listToolsFromServer('nonexistent')).toEqual([]);
  });

  it('executes tool on connected server', async () => {
    const server = manager.installFromConfig(makeStdioInput());
    await manager.connect(server.id);

    // The simulated connection has no tools — inject one for test
    // We need to use the internal API to set up a tool on the server
    const mgr = manager as McpManagerImpl;
    const currentServer = mgr.getServer(server.id)!;
    const toolInfo: McpToolInfo = {
      name: 'do-thing',
      description: 'Does a thing',
      inputSchema: { type: 'object' },
      serverId: server.id,
    };
    // Directly modify the map via connect simulation — use a workaround:
    // Re-set the server with tools injected
    (mgr as any)['servers'].set(server.id, {
      ...currentServer,
      tools: [toolInfo],
      capabilities: { tools: true, resources: false, prompts: false },
    });

    const result = await manager.executeToolOnServer(server.id, 'do-thing', { input: 'test' });
    expect(result.success).toBe(true);
    expect(result.serverId).toBe(server.id);
    expect(result.toolName).toBe('do-thing');
    expect(result.output).toContain('executed');
  });

  it('execute tool fails on disconnected server', async () => {
    const server = manager.installFromConfig(makeStdioInput());
    // Don't connect

    const result = await manager.executeToolOnServer(server.id, 'do-thing', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not connected');
  });

  it('execute tool fails for nonexistent server', async () => {
    const result = await manager.executeToolOnServer('nonexistent', 'tool', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('uninstalls a server (disconnects first)', async () => {
    const server = manager.installFromConfig(makeStdioInput());
    await manager.connect(server.id);

    const result = manager.uninstall(server.id);
    expect(result).toBe(true);
    expect(manager.getServer(server.id)).toBeUndefined();
  });

  it('uninstall returns false for nonexistent server', () => {
    expect(manager.uninstall('nonexistent')).toBe(false);
  });

  it('gets connected servers only', async () => {
    const s1 = manager.installFromConfig(makeStdioInput('srv-1'));
    const s2 = manager.installFromConfig(makeStdioInput('srv-2'));
    manager.installFromConfig(makeStdioInput('srv-3'));

    await manager.connect(s1.id);
    await manager.connect(s2.id);

    const connected = manager.getConnectedServers();
    expect(connected).toHaveLength(2);
    const names = connected.map((s) => s.name);
    expect(names).toContain('srv-1');
    expect(names).toContain('srv-2');
    expect(names).not.toContain('srv-3');
  });
});

// ==========================================================================
// McpInstaller
// ==========================================================================

describe('McpInstaller', () => {
  let installer: McpInstaller;

  beforeEach(() => {
    installer = createMcpInstaller(); // no LLM → heuristic mode
  });

  it('creates an installer without LLM', () => {
    expect(installer).toBeInstanceOf(McpInstaller);
  });

  it('returns error for fetch failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'));

    const result = await installer.resolve('https://invalid.example/broken');
    expect(result.success).toBe(false);
    expect(result.error).toContain('network error');
    expect(result.sourceUrl).toBe('https://invalid.example/broken');

    fetchSpy.mockRestore();
  });

  it('detects stdio transport from npx command in page content', async () => {
    const mockPage = `
      <h1>My MCP Server</h1>
      <p>Install with: npx @some/mcp-server --port 3000</p>
    `;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockPage, { status: 200 }),
    );

    const result = await installer.resolve('https://example.com/mcp');
    expect(result.success).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.config!.transport.type).toBe('stdio');
    if (result.config!.transport.type === 'stdio') {
      expect(result.config!.transport.command).toBe('npx');
    }

    fetchSpy.mockRestore();
  });

  it('detects SSE transport from /sse endpoint URL in page', async () => {
    const mockPage = `
      Connect to: https://api.example.com/sse endpoint for real-time data.
    `;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockPage, { status: 200 }),
    );

    const result = await installer.resolve('https://example.com/mcp-sse');
    expect(result.success).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.config!.transport.type).toBe('sse');

    fetchSpy.mockRestore();
  });

  it('returns failure when page has no recognizable MCP patterns', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Just some random text with no MCP patterns.', { status: 200 }),
    );

    const result = await installer.resolve('https://example.com/nothing');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    fetchSpy.mockRestore();
  });
});

// ==========================================================================
// McpToolBridge
// ==========================================================================

describe('McpToolBridge', () => {
  let mcpManager: McpManager;
  let bridge: McpToolBridge;
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    mcpManager = createMcpManager();
    bridge = createMcpToolBridge(mcpManager);
    toolRegistry = new ToolRegistry();
  });

  function createServerWithTools(
    name: string,
    tools: McpToolInfo[],
  ): McpServerConfig {
    const server = mcpManager.installFromConfig(makeStdioInput(name));
    // Inject tools onto the server for testing
    const mgr = mcpManager as McpManagerImpl;
    (mgr as any)['servers'].set(server.id, {
      ...server,
      status: 'connected',
      tools,
      capabilities: { tools: true, resources: false, prompts: false },
    });
    return (mgr as any)['servers'].get(server.id) as McpServerConfig;
  }

  it('bridges tools from a server into ToolRegistry', () => {
    const tools: McpToolInfo[] = [
      { name: 'search', description: 'Search stuff', inputSchema: { type: 'object' }, serverId: 'test' },
      { name: 'fetch', description: 'Fetch stuff', inputSchema: { type: 'object' }, serverId: 'test' },
    ];
    const server = createServerWithTools('my-mcp', tools);

    const registered = bridge.bridgeTools(server, toolRegistry);
    expect(registered).toHaveLength(2);
    expect(registered).toContain('mcp:my-mcp:search');
    expect(registered).toContain('mcp:my-mcp:fetch');
  });

  it('tool names are namespaced with mcp:serverName:toolName', () => {
    const tools: McpToolInfo[] = [
      { name: 'query', description: 'Query data', inputSchema: { type: 'object' }, serverId: 'test' },
    ];
    const server = createServerWithTools('data-server', tools);

    bridge.bridgeTools(server, toolRegistry);
    expect(toolRegistry.has('mcp:data-server:query')).toBe(true);
  });

  it('unbridgeTools removes tools from registry', () => {
    const tools: McpToolInfo[] = [
      { name: 'tool-a', description: 'A', inputSchema: { type: 'object' }, serverId: 'test' },
      { name: 'tool-b', description: 'B', inputSchema: { type: 'object' }, serverId: 'test' },
    ];
    const server = createServerWithTools('srv', tools);
    bridge.bridgeTools(server, toolRegistry);

    expect(toolRegistry.has('mcp:srv:tool-a')).toBe(true);
    expect(toolRegistry.has('mcp:srv:tool-b')).toBe(true);

    const removed = bridge.unbridgeTools('srv', toolRegistry);
    expect(removed).toHaveLength(2);
    expect(toolRegistry.has('mcp:srv:tool-a')).toBe(false);
    expect(toolRegistry.has('mcp:srv:tool-b')).toBe(false);
  });

  it('bridged tools can be dispatched through ToolRegistry', async () => {
    const tools: McpToolInfo[] = [
      { name: 'ping', description: 'Ping test', inputSchema: { type: 'object' }, serverId: '' },
    ];
    const server = createServerWithTools('bridge-test', tools);
    // Fix serverId in tool info to match
    const fixedServer: McpServerConfig = {
      ...server,
      tools: tools.map((t) => ({ ...t, serverId: server.id })),
    };
    // Re-set with correct serverId
    (mcpManager as any)['servers'].set(server.id, fixedServer);

    bridge.bridgeTools(fixedServer, toolRegistry);

    const result = await toolRegistry.dispatch('mcp:bridge-test:ping', { data: 'hello' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('executed');
  });

  it('bridgeTools is idempotent (skip already registered)', () => {
    const tools: McpToolInfo[] = [
      { name: 'once', description: 'Once only', inputSchema: { type: 'object' }, serverId: 'test' },
    ];
    const server = createServerWithTools('idempotent-srv', tools);

    const first = bridge.bridgeTools(server, toolRegistry);
    expect(first).toHaveLength(1);

    const second = bridge.bridgeTools(server, toolRegistry);
    expect(second).toHaveLength(0); // already registered
  });
});
