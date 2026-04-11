import { Hono } from 'hono';

import type { AuthSessionDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import { API_ERRORS, throwApiError } from '../middleware/error-handler.js';
import { createHostEnvelope, type ServerHostDescriptor } from '../../shared/host.js';

export interface AuthRouteDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
}

export const createAuthRoutes = ({ host, core, infra }: AuthRouteDependencies) => {
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

  // POST /register - Register new account
  auth.post('/register', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const externalAccountId = typeof body.externalAccountId === 'string' ? body.externalAccountId : undefined;
    const initialDeviceId = typeof body.initialDeviceId === 'string' ? body.initialDeviceId : undefined;
    const encryptedAccountEnvelope = typeof body.encryptedAccountEnvelope === 'string' ? body.encryptedAccountEnvelope : undefined;

    if (!externalAccountId || !initialDeviceId || !encryptedAccountEnvelope) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required fields: externalAccountId, initialDeviceId, encryptedAccountEnvelope');
    }

    const result = await core.accounts.provisionAccount({
      externalAccountId,
      initialDeviceId,
      encryptedAccountEnvelope,
      metadata: {},
    });

    const token = await infra.tokenService.mintDeviceToken({
      accountId: result.accountId,
      deviceId: initialDeviceId,
      scope: 'sync',
      ttlSeconds: 900,
    });

    const session: AuthSessionDto = {
      userId: result.accountId,
      workspaceId: 'default-workspace',
      accessToken: token.token,
      refreshToken: `refresh-${infra.idGenerator.nextId('token')}`,
      expiresAt: token.expiresAt.toISOString(),
    };

    return c.json(createHostEnvelope('auth', session, '账号注册完成。'), 201);
  });

  // POST /session - Login (create session)
  auth.post('/session', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const accountId = typeof body.accountId === 'string' ? body.accountId : undefined;
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : undefined;

    if (!accountId || !deviceId) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required fields: accountId, deviceId');
    }

    const token = await infra.tokenService.mintDeviceToken({
      accountId,
      deviceId,
      scope: 'sync',
      ttlSeconds: 900,
    });

    const session: AuthSessionDto = {
      userId: accountId,
      workspaceId: 'default-workspace',
      accessToken: token.token,
      refreshToken: `refresh-${infra.idGenerator.nextId('token')}`,
      expiresAt: token.expiresAt.toISOString(),
    };

    return c.json(createHostEnvelope('auth', session, '会话创建完成。'));
  });

  // DELETE /session - Logout
  auth.delete('/session', (c) => {
    return c.json(
      createHostEnvelope(
        'auth',
        {
          stage: 'revoked',
          revokedAt: infra.clock.now().toISOString(),
        },
        '会话已撤销。',
      ),
    );
  });

  // POST /refresh - Refresh JWT token
  auth.post('/refresh', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : undefined;

    if (!refreshToken) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required field: refreshToken');
    }

    // Verify the current token to extract account/device identity
    const identity = await infra.tokenService.verifyDeviceToken({ token: refreshToken }).catch(() => null);

    if (!identity) {
      throwApiError(API_ERRORS.UNAUTHORIZED, 'Invalid refresh token');
    }

    const token = await infra.tokenService.mintDeviceToken({
      accountId: identity.accountId,
      deviceId: identity.deviceId,
      scope: 'sync',
      ttlSeconds: 900,
    });

    const session: AuthSessionDto = {
      userId: identity.accountId,
      workspaceId: 'default-workspace',
      accessToken: token.token,
      refreshToken: `refresh-${infra.idGenerator.nextId('token')}`,
      expiresAt: token.expiresAt.toISOString(),
    };

    return c.json(createHostEnvelope('auth', session, '令牌已刷新。'));
  });

  // POST /password-reset - Request password reset
  auth.post('/password-reset', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const accountId = typeof body.accountId === 'string' ? body.accountId : undefined;

    if (!accountId) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required field: accountId');
    }

    return c.json(
      createHostEnvelope(
        'auth',
        {
          accountId,
          status: 'reset-requested',
          requestedAt: infra.clock.now().toISOString(),
        },
        '密码重置请求已接受。',
      ),
      202,
    );
  });

  // DELETE /account - Delete account (with confirmation)
  auth.delete('/account', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);

    const accountId = typeof body.accountId === 'string' ? body.accountId : undefined;
    const confirmation = typeof body.confirmation === 'string' ? body.confirmation : undefined;

    if (!accountId) {
      throwApiError(API_ERRORS.VALIDATION, 'Missing required field: accountId');
    }

    if (confirmation !== 'DELETE') {
      throwApiError(API_ERRORS.VALIDATION, 'Missing or invalid confirmation. Must be "DELETE".');
    }

    const result = await core.accounts.revokeAccount({
      accountId,
      reason: 'user-request',
    });

    return c.json(
      createHostEnvelope(
        'auth',
        {
          accountId: result.accountId,
          revokedAt: result.revokedAt.toISOString(),
        },
        '账号已删除。',
      ),
    );
  });

  return auth;
};
