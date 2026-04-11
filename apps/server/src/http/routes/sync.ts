import { Hono } from 'hono';

import type { SyncCheckpointDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import type { AppEnv } from '../../shared/app-env.js';
import { API_ERRORS, throwApiError } from '../middleware/error-handler.js';
import type { OrbitNotificationHub } from '../../realtime/notification-hub.js';
import { createHostEnvelope, type ServerHostDescriptor } from '../../shared/host.js';

export interface SyncRouteDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
  notificationHub: OrbitNotificationHub;
}

export const createSyncRoutes = ({ host, core, infra, notificationHub }: SyncRouteDependencies) => {
  const sync = new Hono<AppEnv>();

  sync.get('/health', (c) =>
    c.json(
      createHostEnvelope(
        'sync',
        {
          service: host.name,
          realtime: host.realtime,
          zeroKnowledge: host.zeroKnowledge,
          capabilities: core.listCapabilities(),
        },
        'sync 边界只转运密文同步载荷，不做明文解读。',
      )
    )
  );

  // GET /cursor - Get current sync cursor
  sync.get('/cursor', (c) => {
    const accountId = c.get('accountId') as string | undefined ?? 'account-demo';
    const version = Number(c.req.query('version') ?? '1');

    const checkpoint: SyncCheckpointDto = {
      cursor: c.req.query('cursor') ?? infra.issueSyncCursor({ accountId, version }).cursor,
      serverTime: infra.clock.now().toISOString(),
    };

    return c.json(createHostEnvelope('sync', checkpoint, '游标查询完成。'));
  });

  // POST /commit - Push encrypted changes
  sync.post('/commit', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const accountId = c.get('accountId') as string | undefined
      ?? (typeof body.accountId === 'string' ? body.accountId : undefined);
    const deviceId = c.get('deviceId') as string | undefined
      ?? (typeof body.deviceId === 'string' ? body.deviceId : undefined);
    const mutationId = typeof body.mutationId === 'string' ? body.mutationId : undefined;
    const encryptedMutation = typeof body.encryptedMutation === 'string' ? body.encryptedMutation : undefined;

    if (!accountId || !deviceId || !mutationId || !encryptedMutation) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required fields: accountId, deviceId, mutationId, encryptedMutation');
    }

    const result = await core.sync.commitMutation({
      accountId,
      deviceId,
      mutationId,
      encryptedMutation,
      metadata: {},
    });

    notificationHub.publish('sync.delta.accepted', {
      deviceId,
      mutationId: result.mutationId,
      encrypted: true,
      receivedAt: result.acceptedAt.toISOString(),
    });

    return c.json(
      createHostEnvelope(
        'sync',
        {
          mutationId: result.mutationId,
          acceptedAt: result.acceptedAt.toISOString(),
          deviceId,
        },
        '密文变更已提交。',
      ),
      202,
    );
  });

  // GET /events - Pull changes since cursor
  sync.get('/events', async (c) => {
    const accountId = c.get('accountId') as string | undefined ?? 'account-demo';
    const deviceId = c.get('deviceId') as string | undefined ?? 'device-demo';
    const cursor = c.req.query('cursor') ?? undefined;
    const limit = Number(c.req.query('limit') ?? '50');

    const result = await core.sync.pullEvents({
      accountId,
      deviceId,
      cursor,
      limit,
    });

    return c.json(
      createHostEnvelope(
        'sync',
        {
          events: result.events,
          nextCursor: result.nextCursor ?? null,
          hasMore: result.nextCursor !== undefined,
        },
        '增量事件拉取完成。',
      ),
    );
  });

  // POST /resolve - Resolve conflict
  sync.post('/resolve', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const accountId = c.get('accountId') as string | undefined
      ?? (typeof body.accountId === 'string' ? body.accountId : undefined);
    const deviceId = c.get('deviceId') as string | undefined
      ?? (typeof body.deviceId === 'string' ? body.deviceId : undefined);
    const mutationId = typeof body.mutationId === 'string' ? body.mutationId : undefined;
    const encryptedResolution = typeof body.encryptedResolution === 'string' ? body.encryptedResolution : undefined;

    if (!accountId || !deviceId || !mutationId || !encryptedResolution) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required fields: accountId, deviceId, mutationId, encryptedResolution');
    }

    const result = await core.sync.commitMutation({
      accountId,
      deviceId,
      mutationId,
      encryptedMutation: encryptedResolution,
      metadata: { type: 'conflict-resolution' },
    });

    notificationHub.publish('sync.conflict.resolved', {
      deviceId,
      mutationId: result.mutationId,
      resolvedAt: result.acceptedAt.toISOString(),
    });

    return c.json(
      createHostEnvelope(
        'sync',
        {
          mutationId: result.mutationId,
          resolvedAt: result.acceptedAt.toISOString(),
        },
        '冲突已解决。',
      ),
    );
  });

  return sync;
};
