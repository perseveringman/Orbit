import { Hono } from 'hono';

import { createAuthMiddleware } from '../http/middleware/auth.js';
import { createErrorHandler } from '../http/middleware/error-handler.js';
import { createRateLimiter, DEFAULT_RATE_LIMITS } from '../http/middleware/rate-limiter.js';
import { createAuthRoutes } from '../http/routes/auth.js';
import { createAdminRoutes } from '../http/routes/admin.js';
import { createBlobRoutes } from '../http/routes/blob.js';
import { createDeviceRoutes } from '../http/routes/device.js';
import { createSyncRoutes } from '../http/routes/sync.js';
import { createGdprJobs } from '../jobs/gdpr-jobs.js';
import { createNotificationHub } from '../realtime/notification-hub.js';
import {
  createHostCore,
  createHostEnvelope,
  createHostInfra,
  createServerHostDescriptor
} from '../shared/host.js';

export const createApp = () => {
  const host = createServerHostDescriptor();
  const infra = createHostInfra();
  const core = createHostCore(infra);

  const notificationHub = createNotificationHub({ host, core, infra });
  const gdprJobs = createGdprJobs({ host, core, infra, notificationHub });

  const app = new Hono();
  const api = new Hono();

  // Global error handler
  app.use('*', createErrorHandler());

  // Rate limiting
  app.use('*', createRateLimiter(DEFAULT_RATE_LIMITS));

  // Auth middleware for protected routes
  const authMiddleware = createAuthMiddleware(infra.tokenService);
  api.use('/device/*', authMiddleware);
  api.use('/sync/*', authMiddleware);
  api.use('/blob/*', authMiddleware);
  api.use('/admin/*', authMiddleware);

  app.get('/', (c) =>
    c.json(
      createHostEnvelope('host', host, 'Orbit server host 仅做 HTTP/realtime/jobs 装配，不承载 Agent 推理与明文处理。')
    )
  );

  app.get('/healthz', (c) =>
    c.json(
      createHostEnvelope(
        'host',
        {
          status: 'ok',
          host,
          note: '该宿主只负责账号、设备、同步、对象存储与管理边界的接线。',
        },
        '健康检查通过。',
      )
    )
  );

  api.route('/auth', createAuthRoutes({ host, core, infra }));
  api.route('/device', createDeviceRoutes({ host, core, infra }));
  api.route('/sync', createSyncRoutes({ host, core, infra, notificationHub }));
  api.route('/blob', createBlobRoutes({ host, core, infra }));
  api.route('/admin', createAdminRoutes({ host, core, infra, notificationHub, gdprJobs }));

  app.route('/api', api);

  app.notFound((c) =>
    c.json(
      {
        ok: false,
        version: host.version,
        boundary: 'host',
        data: {
          path: 'not-found',
        },
        message: '未找到对应的 Orbit server host 路由。',
      },
      404,
    )
  );

  app.onError((error, c) =>
    c.json(
      {
        ok: false,
        version: host.version,
        boundary: 'host',
        data: {
          name: error.name,
        },
        message: `服务端宿主异常：${error.message}`,
      },
      500,
    )
  );

  return app;
};
