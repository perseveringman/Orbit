import { serve } from '@hono/node-server';

import { createApp } from './bootstrap/create-app.js';

const DEFAULT_PORT = 8787;
const rawPort = process.env.PORT ?? `${DEFAULT_PORT}`;
const port = Number.parseInt(rawPort, 10);

if (Number.isNaN(port)) {
  throw new Error(`无效的 PORT 配置：${rawPort}`);
}

const app = createApp();

serve(
  {
    fetch: app.fetch,
    port,
  },
  () => {
    console.log(
      `[orbit/server] Hono host 已启动：http://127.0.0.1:${port}（仅负责路由、realtime、jobs 与 bootstrap 装配）`,
    );
  },
);
