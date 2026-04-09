import { Hono } from 'hono';

import type { DeviceRegistrationDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import { createHostEnvelope, type ServerHostDescriptor } from '../../shared/host.js';

export interface DeviceRouteDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
}

export const createDeviceRoutes = ({ host }: DeviceRouteDependencies) => {
  const device = new Hono();

  device.get('/health', (c) =>
    c.json(
      createHostEnvelope(
        'device',
        {
          boundary: 'device',
          runtime: host.runtime,
          service: host.name,
        },
        'device 边界负责设备注册与心跳入口，具体规则应下沉到共享服务包。',
      )
    )
  );

  device.post('/register', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : 'pending-device-id';
    const payload: DeviceRegistrationDto = {
      deviceId,
      workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId : 'default-workspace',
      name: typeof body.name === 'string' ? body.name : 'Orbit Scaffold Device',
      platform: 'web',
      appVersion: host.version,
      capabilityIds: host.boundaries
    };

    return c.json(
      createHostEnvelope(
        'device',
        payload,
        '设备注册请求已进入宿主，后续应接入设备表、签名校验与配额策略。',
      ),
      202,
    );
  });

  device.post('/heartbeat', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    return c.json(
      createHostEnvelope(
        'device',
        {
          deviceId: typeof body.deviceId === 'string' ? body.deviceId : 'unknown-device',
          seenAt: new Date().toISOString(),
          transport: host.http,
        },
        '设备心跳已记录为宿主占位实现。',
      )
    );
  });

  return device;
};
