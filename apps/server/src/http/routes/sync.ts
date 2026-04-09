import { Hono } from 'hono';

import type { SyncCheckpointDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import type { OrbitNotificationHub } from '../../realtime/notification-hub.js';
import { createHostEnvelope, type ServerHostDescriptor } from '../../shared/host.js';

export interface SyncRouteDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
  notificationHub: OrbitNotificationHub;
}

export const createSyncRoutes = ({ host, core, infra, notificationHub }: SyncRouteDependencies) => {
  const sync = new Hono();

  sync.get('/health', (c) =>
    c.json(
      createHostEnvelope(
        'sync',
        {
          service: host.name,
          realtime: host.realtime,
          zeroKnowledge: host.zeroKnowledge,
          capabilities: core.listCapabilities()
        },
        'sync 边界只转运密文同步载荷，不做明文解读。',
      )
    )
  );

  sync.get('/cursor', (c) => {
    const checkpoint: SyncCheckpointDto = {
      cursor: c.req.query('cursor') ?? infra.issueSyncCursor({ accountId: 'account-demo', version: 1 }).cursor,
      serverTime: infra.clock.now().toISOString()
    };

    return c.json(createHostEnvelope('sync', checkpoint, '游标查询已接入宿主占位路由。'));
  });

  sync.post('/commit', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : 'unknown-device';

    notificationHub.publish('sync.delta.accepted', {
      deviceId,
      encrypted: true,
      receivedAt: new Date().toISOString(),
    });

    return c.json(
      createHostEnvelope(
        'sync',
        {
          deviceId,
          batchAccepted: true,
          handledBy: '@orbit/server-core',
          realtime: host.realtime
        },
        '同步批次已进入宿主队列；仅接受密文批次，不解析正文。',
      ),
      202,
    );
  });

  sync.get('/events', (c) =>
    c.json(
      createHostEnvelope(
        'sync',
        {
          transport: host.realtime,
          recentEvents: notificationHub.snapshot(),
        },
        'realtime 事件集线器当前为进程内占位实现。',
      )
    )
  );

  return sync;
};
