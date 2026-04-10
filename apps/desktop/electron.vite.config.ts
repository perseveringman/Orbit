import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const rootTsconfig = resolve(__dirname, '../../tsconfig.base.json');

export default defineConfig({
  main: {
    plugins: [tsconfigPaths({ projects: [rootTsconfig] }), externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [tsconfigPaths({ projects: [rootTsconfig] }), externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer-entry'),
    base: './',
    plugins: [react(), tsconfigPaths({ projects: [rootTsconfig] })],
    build: {
      outDir: resolve(__dirname, 'dist/renderer-entry'),
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer-entry/index.html')
      }
    }
  }
});
