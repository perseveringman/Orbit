import { Hono } from 'hono';

import type { AdminWorkspaceSummaryDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import type { AppEnv } from '../../shared/app-env.js';
import { API_ERRORS, throwApiError } from '../middleware/error-handler.js';
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

export const createAdminRoutes = ({ host, core, infra, notificationHub, gdprJobs }: AdminRouteDependencies) => {
  const admin = new Hono<AppEnv>();

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
      lastSyncAt: null,
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

  // --- GDPR API ---

  // POST /gdpr/export - Request data export
  admin.post('/gdpr/export', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const accountId = c.get('accountId') as string | undefined
      ?? (typeof body.accountId === 'string' ? body.accountId : undefined);
    const deviceId = c.get('deviceId') as string | undefined
      ?? (typeof body.deviceId === 'string' ? body.deviceId : undefined);

    if (!accountId) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required field: accountId');
    }

    const result = await core.gdpr.requestExport({
      accountId,
      requestedByDeviceId: deviceId ?? 'unknown-device',
      metadata: {},
    });

    const exportJob = await gdprJobs.scheduleExport(accountId);

    return c.json(
      createHostEnvelope(
        'admin',
        {
          requestId: result.requestId,
          jobId: exportJob.jobId,
          accountId,
          status: 'accepted',
          acceptedAt: result.acceptedAt.toISOString(),
        },
        'GDPR 数据导出请求已接受。',
      ),
      202,
    );
  });

  // POST /gdpr/delete - Request account deletion (7-day cooling period)
  admin.post('/gdpr/delete', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const accountId = c.get('accountId') as string | undefined
      ?? (typeof body.accountId === 'string' ? body.accountId : undefined);
    const deviceId = c.get('deviceId') as string | undefined
      ?? (typeof body.deviceId === 'string' ? body.deviceId : undefined);

    if (!accountId) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required field: accountId');
    }

    const result = await core.gdpr.requestDeletion({
      accountId,
      requestedByDeviceId: deviceId ?? 'unknown-device',
      metadata: {},
    });

    const erasureJob = await gdprJobs.scheduleErasure(accountId);

    const coolingPeriodEndsAt = new Date(result.acceptedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    return c.json(
      createHostEnvelope(
        'admin',
        {
          requestId: result.requestId,
          jobId: erasureJob.jobId,
          accountId,
          status: 'accepted',
          coolingPeriodDays: 7,
          coolingPeriodEndsAt: coolingPeriodEndsAt.toISOString(),
          acceptedAt: result.acceptedAt.toISOString(),
        },
        'GDPR 删除请求已接受，7 天冷却期后执行。',
      ),
      202,
    );
  });

  // GET /gdpr/status/:requestId - Check request status
  admin.get('/gdpr/status/:requestId', (c) => {
    const requestId = c.req.param('requestId');

    return c.json(
      createHostEnvelope(
        'admin',
        {
          requestId,
          status: 'processing',
          checkedAt: infra.clock.now().toISOString(),
          note: 'GDPR 请求状态由作业系统驱动，当前为占位实现。',
        },
        'GDPR 请求状态已查询。',
      ),
    );
  });

  return admin;
};
