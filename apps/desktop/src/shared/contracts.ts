export type DesktopHostLayerId = 'main' | 'preload' | 'renderer-entry';

export interface DesktopHostLayer {
  id: DesktopHostLayerId;
  responsibility: string;
}

export interface DesktopShellDescriptor {
  packageName: '@orbit/desktop';
  rendererMountId: string;
  layers: DesktopHostLayer[];
}

export interface LLMProxyRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface LLMProxyResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

export interface DesktopBridge {
  host: {
    appVersion: string;
    electronVersion: string;
    platform: string;
  };
  ping(): Promise<'pong'>;
  describeShell(): DesktopShellDescriptor;
  llmProxy(request: LLMProxyRequest): Promise<LLMProxyResponse>;
  /** Start an SSE streaming fetch — returns immediately, chunks arrive via onStreamChunk. */
  startStream(streamId: string, request: LLMProxyRequest): void;
  /** Cancel an in-flight stream. */
  cancelStream(streamId: string): void;
  /** Subscribe to streaming chunks from main process. Returns unsubscribe function. */
  onStreamChunk(callback: (streamId: string, chunk: string, done: boolean) => void): () => void;

  // ---- Tool execution (main process) ----
  /** Execute a tool in the main process (has Node.js access). */
  toolExecute(request: ToolExecuteRequest): Promise<ToolExecuteResponse>;
  /** List all available tools. */
  toolList(): Promise<ToolListItem[]>;

  // ---- MCP server management ----
  mcpListServers(): Promise<McpServerInfo[]>;
  mcpInstall(request: McpInstallRequest): Promise<McpServerInfo>;
  mcpUninstall(serverId: string): Promise<boolean>;
  mcpConnect(serverId: string): Promise<boolean>;
  mcpDisconnect(serverId: string): Promise<boolean>;
  mcpExecuteTool(request: McpToolExecRequest): Promise<McpToolExecResponse>;
}

export const HOST_LAYERS: DesktopHostLayer[] = [
  {
    id: 'main',
    responsibility: '负责 Electron 生命周期、窗口创建与安全默认值装配。'
  },
  {
    id: 'preload',
    responsibility: '负责最小白名单桥接，把宿主能力安全暴露给渲染层。'
  },
  {
    id: 'renderer-entry',
    responsibility: '负责 React 挂载，并把 feature-workbench 与 platform-electron 装配到界面。'
  }
];

export function createDesktopShellDescriptor(): DesktopShellDescriptor {
  return {
    packageName: '@orbit/desktop',
    rendererMountId: 'root',
    layers: HOST_LAYERS.map((layer) => ({ ...layer }))
  };
}

// ---- Tool execution IPC ----

export interface ToolExecuteRequest {
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolExecuteResponse {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export interface ToolListItem {
  name: string;
  description: string;
  category: string;
}

// ---- MCP IPC ----

export interface McpInstallRequest {
  name: string;
  description: string;
  transport: {
    type: 'stdio' | 'sse' | 'streamable-http';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
  };
}

export interface McpServerInfo {
  id: string;
  name: string;
  description: string;
  transportType: 'stdio' | 'sse' | 'streamable-http';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  installedAt: string;
  lastConnectedAt?: string;
  error?: string;
}

export interface McpToolExecRequest {
  serverId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface McpToolExecResponse {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export function createFallbackDesktopBridge(): DesktopBridge {
  const notAvailable = (name: string) => {
    console.warn(`[FallbackBridge] ${name} called — bridge is unavailable`);
  };

  return {
    host: {
      appVersion: '0.1.0-scaffold',
      electronVersion: 'host-managed',
      platform: 'unknown'
    },
    ping: async () => 'pong',
    describeShell: () => createDesktopShellDescriptor(),
    llmProxy: async () => ({
      ok: false,
      status: 0,
      statusText: 'Fallback bridge – no IPC available',
      headers: {},
      body: JSON.stringify({ error: 'llmProxy unavailable in fallback bridge' })
    }),
    startStream: (_streamId: string, _request: LLMProxyRequest) => {
      notAvailable('startStream');
    },
    cancelStream: () => {},
    onStreamChunk: (callback: (streamId: string, chunk: string, done: boolean) => void) => {
      queueMicrotask(() => {
        callback('', JSON.stringify({ error: true, message: 'Desktop bridge 不可用' }), true);
      });
      return () => {};
    },
    // Tool execution
    toolExecute: async () => {
      notAvailable('toolExecute');
      return { success: false, output: '', error: 'Bridge not available', durationMs: 0 };
    },
    toolList: async () => {
      notAvailable('toolList');
      return [];
    },
    // MCP
    mcpListServers: async () => { notAvailable('mcpListServers'); return []; },
    mcpInstall: async () => { throw new Error('Bridge not available'); },
    mcpUninstall: async () => { notAvailable('mcpUninstall'); return false; },
    mcpConnect: async () => { notAvailable('mcpConnect'); return false; },
    mcpDisconnect: async () => { notAvailable('mcpDisconnect'); return false; },
    mcpExecuteTool: async () => ({
      success: false, output: '', error: 'Bridge not available', durationMs: 0
    }),
  };
}
