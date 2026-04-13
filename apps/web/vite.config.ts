import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const rootTsconfig = resolve(__dirname, '../../tsconfig.base.json');

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths({ projects: [rootTsconfig] }),
    // CORS proxy plugin for resolver test page
    {
      name: 'cors-proxy',
      configureServer(server) {
        server.middlewares.use('/api/proxy', async (req, res) => {
          const parsedUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);
          const targetUrl = parsedUrl.searchParams.get('url');
          if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing ?url= parameter');
            return;
          }
          try {
            const response = await fetch(targetUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                Accept: req.headers.accept ?? 'text/html,application/xhtml+xml',
              },
              redirect: 'follow',
              signal: AbortSignal.timeout(20_000),
            });
            res.writeHead(response.status, {
              'Content-Type': response.headers.get('content-type') ?? 'text/plain',
              'Access-Control-Allow-Origin': '*',
            });
            const body = Buffer.from(await response.arrayBuffer());
            res.end(body);
          } catch (err) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(`Proxy error: ${err instanceof Error ? err.message : String(err)}`);
          }
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 4173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
