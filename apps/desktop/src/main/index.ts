import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';

import { createDesktopShellDescriptor } from '../shared/contracts';

const shellDescriptor = createDesktopShellDescriptor();
const runtimeProcess = globalThis as {
  process?: {
    env?: Record<string, string | undefined>;
    platform?: string;
  };
};

function getPreloadEntry(): string {
  return fileURLToPath(new URL('../preload/index.js', import.meta.url));
}

function getRendererHtml(): string {
  return fileURLToPath(new URL('../renderer-entry/index.html', import.meta.url));
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
  const devUrl = runtimeProcess.process?.env?.ORBIT_DESKTOP_RENDERER_URL;

  if (devUrl) {
    await window.loadURL(devUrl);
    return;
  }

  await window.loadFile(getRendererHtml());
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#0b1020',
    title: `${shellDescriptor.packageName} host`,
    webPreferences: {
      preload: getPreloadEntry(),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  void loadRenderer(window);
  return window;
}

void app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (runtimeProcess.process?.platform !== 'darwin') {
    app.quit();
  }
});
