declare global {
  interface Window {
    orbitDesktop?: import('./contracts').DesktopBridge;
  }
}

export {};
