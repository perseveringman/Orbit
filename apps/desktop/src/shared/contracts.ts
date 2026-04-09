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

export interface DesktopBridge {
  host: {
    appVersion: string;
    electronVersion: string;
    platform: string;
  };
  ping(): Promise<'pong'>;
  describeShell(): DesktopShellDescriptor;
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

export function createFallbackDesktopBridge(): DesktopBridge {
  return {
    host: {
      appVersion: '0.1.0-scaffold',
      electronVersion: 'host-managed',
      platform: 'unknown'
    },
    ping: async () => 'pong',
    describeShell: () => createDesktopShellDescriptor()
  };
}
