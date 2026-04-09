import { Hono } from 'hono';

import type { AuthSessionDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import { createHostEnvelope, type ServerHostDescriptor } from '../../shared/host.js';

export interface AuthRouteDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
}

export const createAuthRoutes = ({ host }: AuthRouteDependencies) => {
  const auth = new Hono();

  auth.get('/health', (c) =>
    c.json(
      createHostEnvelope(
        'auth',
        {
          service: host.name,
          runtime: host.runtime,
          zeroKnowledge: host.zeroKnowledge,
        },
        'auth 边界仅负责账号与会话宿主接线，实际认证规则应沉淀到 @orbit/server-core。',
      )
    )
  );

  auth.post('/session', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const session: AuthSessionDto = {
      userId: typeof body.accountHint === 'string' ? body.accountHint : 'pending-user',
      workspaceId: 'default-workspace',
      accessToken: 'pending-access-token',
      refreshToken: 'pending-refresh-token',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };

    return c.json(createHostEnvelope('auth', session, '宿主已接受会话创建请求，但不会处理明文内容或 Agent 推理。'), 202);
  });

  auth.delete('/session', (c) =>
    c.json(
      createHostEnvelope(
        'auth',
        {
          stage: 'revocation-queued',
          handledBy: '@orbit/server-infra',
        },
        '宿主已接收会话撤销请求。',
      ),
      202
    )
  );

  return auth;
};
