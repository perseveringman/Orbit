import { Hono } from 'hono';

import type { AdminWorkspaceSummaryDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import type { OrbitGdprJobs } from '../../jobs/gdpr-jobs.js';
import type { OrbitNotificationHub } from '../../realtime/notification-hub.js';
import { createHostEnvelope, type ServerHostDescriptor } from '../../shared/host.js';

export interface AdminRouteDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
  notificationHub: OrbitNotificationHub;
  gdprJobs: OrbitGdprJobs;
}

export const createAdminRoutes = ({ host, core, notificationHub, gdprJobs }: AdminRouteDependencies) => {
  const admin = new Hono();

  admin.get('/health', (c) =>
    c.json(
      createHostEnvelope(
        'admin',
        {
          service: host.name,
          runtime: host.runtime,
          jobs: gdprJobs.supportedJobs,
        },
        'admin 边界仅用于宿主管理面与作业编排，不承载业务真相。',
      )
    )
  );

  admin.get('/boundaries', (c) =>
    c.json(
      createHostEnvelope(
        'admin',
        {
          boundaries: host.boundaries,
          forbiddenCapabilities: host.forbiddenCapabilities,
          realtime: notificationHub.describe(),
        },
        '当前宿主边界已就绪。',
      )
    )
  );

  admin.get('/summary', (c) => {
    const summary: AdminWorkspaceSummaryDto = {
      workspaceId: 'default-workspace',
      ownerUserId: 'pending-owner',
      memberCount: 1,
      deviceCount: 1,
      storageBytes: 0,
      lastSyncAt: null
    };

    return c.json(createHostEnvelope('admin', summary, '管理摘要为宿主占位数据。'));
  });

  admin.post('/jobs/gdpr-erasure', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);
    const accountId = typeof body.accountId === 'string' ? body.accountId : 'pending-account-id';
    const result = await gdprJobs.scheduleErasure(accountId);

    return c.json(
      createHostEnvelope('admin', result, 'GDPR 擦除作业已排队。'),
      202,
    );
  });

  return admin;
};
