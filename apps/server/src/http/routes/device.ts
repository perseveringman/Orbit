import { Hono } from 'hono';

import type { DeviceRegistrationDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import type { AppEnv } from '../../shared/app-env.js';
import { API_ERRORS, throwApiError } from '../middleware/error-handler.js';
import { createHostEnvelope, type ServerHostDescriptor } from '../../shared/host.js';

export interface DeviceRouteDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
}

export const createDeviceRoutes = ({ host, core, infra }: DeviceRouteDependencies) => {
  const device = new Hono<AppEnv>();

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

  // POST / - Register device
  device.post('/', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const accountId = c.get('accountId') as string | undefined
      ?? (typeof body.accountId === 'string' ? body.accountId : undefined);
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : undefined;
    const encryptedDeviceEnvelope = typeof body.encryptedDeviceEnvelope === 'string' ? body.encryptedDeviceEnvelope : undefined;

    if (!accountId || !deviceId || !encryptedDeviceEnvelope) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required fields: accountId, deviceId, encryptedDeviceEnvelope');
    }

    const result = await core.devices.registerDevice({
      accountId,
      deviceId,
      encryptedDeviceEnvelope,
      metadata: {},
    });

    const payload: DeviceRegistrationDto = {
      deviceId: result.deviceId,
      workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId : 'default-workspace',
      name: typeof body.name === 'string' ? body.name : 'Orbit Device',
      platform: (typeof body.platform === 'string' ? body.platform : 'web') as DeviceRegistrationDto['platform'],
      appVersion: host.version,
      capabilityIds: host.boundaries,
    };

    return c.json(createHostEnvelope('device', payload, '设备注册完成。'), 201);
  });

  // GET / - List devices
  device.get('/', (c) => {
    const accountId = c.get('accountId') as string | undefined ?? 'account-demo';

    return c.json(
      createHostEnvelope(
        'device',
        {
          accountId,
          devices: [],
          note: '设备列表由数据库驱动，当前为占位实现。',
        },
        '设备列表已返回。',
      ),
    );
  });

  // POST /:deviceId/pair - Pair device
  device.post('/:deviceId/pair', async (c) => {
    const deviceId = c.req.param('deviceId');
    const accountId = c.get('accountId') as string | undefined ?? 'account-demo';

    const token = await infra.tokenService.mintDeviceToken({
      accountId,
      deviceId,
      scope: 'sync',
      ttlSeconds: 3600,
    });

    return c.json(
      createHostEnvelope(
        'device',
        {
          deviceId,
          accountId,
          paired: true,
          token: token.token,
          expiresAt: token.expiresAt.toISOString(),
        },
        '设备配对完成。',
      ),
    );
  });

  // DELETE /:deviceId - Revoke device
  device.delete('/:deviceId', async (c) => {
    const deviceId = c.req.param('deviceId');
    const accountId = c.get('accountId') as string | undefined ?? 'account-demo';

    const result = await core.devices.revokeDevice({
      accountId,
      deviceId,
      reason: 'user-request',
    });

    return c.json(
      createHostEnvelope(
        'device',
        {
          deviceId: result.deviceId,
          revokedAt: result.revokedAt.toISOString(),
        },
        '设备已撤销。',
      ),
    );
  });

  return device;
};
