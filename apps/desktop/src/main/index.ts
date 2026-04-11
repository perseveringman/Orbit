import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';

import { createDesktopShellDescriptor, type LLMProxyRequest } from '../shared/contracts';

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
  const devUrl =
    runtimeProcess.process?.env?.ORBIT_DESKTOP_RENDERER_URL ??
    runtimeProcess.process?.env?.ELECTRON_RENDERER_URL;

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

ipcMain.handle('llm:proxy', async (_event, request: LLMProxyRequest) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 60_000);

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });

    const body = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body,
    };
  } catch (error) {
    clearTimeout(timeout);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      statusText: msg.includes('abort') ? 'Request Timeout' : 'Network Error',
      headers: {},
      body: JSON.stringify({ error: msg }),
    };
  }
});

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
