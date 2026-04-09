import { contextBridge } from 'electron';

import {
  createDesktopShellDescriptor,
  type DesktopBridge
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
  describeShell: () => createDesktopShellDescriptor()
};

contextBridge.exposeInMainWorld('orbitDesktop', desktopBridge);
