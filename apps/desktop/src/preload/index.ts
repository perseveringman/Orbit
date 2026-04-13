import { contextBridge, ipcRenderer } from 'electron';

import {
  createDesktopShellDescriptor,
  type DesktopBridge,
  type LLMProxyRequest,
  type ToolExecuteRequest,
  type McpInstallRequest,
  type McpToolExecRequest,
} from '../shared/contracts';

const runtimeProcess = globalThis as {
  process?: {
    platform?: string;
    versions?: Record<string, string | undefined>;
  };
};

const desktopBridge: DesktopBridge = {
  host: {
    appVersion: '0.1.0',
    electronVersion: runtimeProcess.process?.versions?.electron ?? 'unknown',
    platform: runtimeProcess.process?.platform ?? 'unknown'
  },
  ping: async () => 'pong',
  describeShell: () => createDesktopShellDescriptor(),
  llmProxy: (request: LLMProxyRequest) => ipcRenderer.invoke('llm:proxy', request),
  startStream: (streamId: string, request: LLMProxyRequest) => {
    ipcRenderer.send('llm:stream-start', streamId, request);
  },
  cancelStream: (streamId: string) => {
    ipcRenderer.send('llm:stream-cancel', streamId);
  },
  onStreamChunk: (callback: (streamId: string, chunk: string, done: boolean) => void) => {
    const handler = (_event: unknown, streamId: string, chunk: string, done: boolean) => {
      callback(streamId, chunk, done);
    };
    ipcRenderer.on('llm:stream-chunk', handler);
    return () => {
      ipcRenderer.removeListener('llm:stream-chunk', handler);
    };
  },

  // ---- Tool execution ----
  toolExecute: (request: ToolExecuteRequest) => ipcRenderer.invoke('tool:execute', request),
  toolList: () => ipcRenderer.invoke('tool:list'),

  // ---- MCP management ----
  mcpListServers: () => ipcRenderer.invoke('mcp:list-servers'),
  mcpInstall: (request: McpInstallRequest) => ipcRenderer.invoke('mcp:install', request),
  mcpUninstall: (serverId: string) => ipcRenderer.invoke('mcp:uninstall', serverId),
  mcpConnect: (serverId: string) => ipcRenderer.invoke('mcp:connect', serverId),
  mcpDisconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),
  mcpExecuteTool: (request: McpToolExecRequest) => ipcRenderer.invoke('mcp:execute-tool', request),
};

contextBridge.exposeInMainWorld('orbitDesktop', desktopBridge);
