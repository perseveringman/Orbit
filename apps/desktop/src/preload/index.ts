import { contextBridge, ipcRenderer } from 'electron';

import {
  createDesktopShellDescriptor,
  type DesktopBridge,
  type LLMProxyRequest
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
};

contextBridge.exposeInMainWorld('orbitDesktop', desktopBridge);
