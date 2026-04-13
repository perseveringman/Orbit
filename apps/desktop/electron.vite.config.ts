import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import type { Plugin } from 'vite';

const rootTsconfig = resolve(__dirname, '../../tsconfig.base.json');

/**
 * CORS proxy plugin – forwards /api/proxy?url=<encoded> requests server-side
 * so the renderer can fetch arbitrary URLs without CORS issues during dev.
 */
function corsProxyPlugin(): Plugin {
  return {
    name: 'orbit-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        const parsed = new URL(req.url ?? '', 'http://localhost');
        const target = parsed.searchParams.get('url');
        if (!target) {
          res.statusCode = 400;
          res.end('Missing ?url= parameter');
          return;
        }
        try {
          const upstream = await fetch(target, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });
          res.statusCode = upstream.status;
          upstream.headers.forEach((v, k) => {
            if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k.toLowerCase())) {
              res.setHeader(k, v);
            }
          });
          res.setHeader('Access-Control-Allow-Origin', '*');
          const body = await upstream.arrayBuffer();
          res.end(Buffer.from(body));
        } catch (err: unknown) {
          res.statusCode = 502;
          res.end(String(err));
        }
      });
    },
  };
}

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
    plugins: [react(), tailwindcss(), tsconfigPaths({ projects: [rootTsconfig] }), corsProxyPlugin()],
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
      exclude: ['@orbit/ui-dom']
    },
    build: {
      outDir: resolve(__dirname, 'dist/renderer-entry'),
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer-entry/index.html')
      }
    }
  }
});
