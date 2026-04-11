import type { MiddlewareHandler } from 'hono';

import type { TokenPort } from '@orbit/server-infra';

import { API_ERRORS, throwApiError } from './error-handler.js';

export interface AuthContext {
  accountId: string;
  deviceId: string;
}

export function createAuthMiddleware(tokenPort: TokenPort): MiddlewareHandler {
  return async (c, next) => {
    const authorization = c.req.header('Authorization');

    if (!authorization) {
      throwApiError(API_ERRORS.UNAUTHORIZED, 'Missing Authorization header');
    }

    const parts = authorization.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throwApiError(API_ERRORS.UNAUTHORIZED, 'Invalid Authorization header format');
    }

    const token = parts[1]!;

    try {
      const result = await tokenPort.verifyDeviceToken({ token });
      c.set('accountId', result.accountId);
      c.set('deviceId', result.deviceId);
    } catch {
      throwApiError(API_ERRORS.UNAUTHORIZED, 'Invalid or expired token');
    }

    await next();
  };
}
