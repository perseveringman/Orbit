import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
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
      lib: { entry: resolve(__dirname, 'src/preload/index.ts'), formats: ['cjs'] },
      rollupOptions: {
        output: {
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer-entry'),
    base: './',
    plugins: [react(), tailwindcss(), tsconfigPaths({ projects: [rootTsconfig] })],
    resolve: {
      alias: [
        { find: /^@orbit\/ui-dom$/, replacement: resolve(__dirname, '../../packages/ui-dom/src/index.ts') },
        { find: /^@orbit\/ui-dom\/(.*)$/, replacement: resolve(__dirname, '../../packages/ui-dom/$1') },
        { find: 'node:child_process', replacement: resolve(__dirname, 'src/renderer-entry/node-stubs.ts') },
        { find: 'node:fs/promises', replacement: resolve(__dirname, 'src/renderer-entry/node-stubs.ts') },
        { find: 'node:fs', replacement: resolve(__dirname, 'src/renderer-entry/node-stubs.ts') },
        { find: 'node:path', replacement: resolve(__dirname, 'src/renderer-entry/node-stubs.ts') },
      ]
    },
    optimizeDeps: {
      exclude: ['@orbit/ui-dom', '@orbit/ui-tokens']
    },
    build: {
      outDir: resolve(__dirname, 'dist/renderer-entry'),
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer-entry/index.html')
      }
    }
  }
});
