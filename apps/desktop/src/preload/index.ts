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
  llmProxy: (request: LLMProxyRequest) => ipcRenderer.invoke('llm:proxy', request)
};

contextBridge.exposeInMainWorld('orbitDesktop', desktopBridge);
