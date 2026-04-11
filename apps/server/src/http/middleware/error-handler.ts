import type { MiddlewareHandler } from 'hono';

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly status: number;
  readonly details?: unknown;
}

export const API_ERRORS = {
  UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', message: 'Insufficient permissions', status: 403 },
  NOT_FOUND: { code: 'NOT_FOUND', message: 'Resource not found', status: 404 },
  CONFLICT: { code: 'CONFLICT', message: 'Resource conflict', status: 409 },
  RATE_LIMITED: { code: 'RATE_LIMITED', message: 'Too many requests', status: 429 },
  VALIDATION: { code: 'VALIDATION_ERROR', message: 'Invalid input', status: 400 },
  INTERNAL: { code: 'INTERNAL_ERROR', message: 'Internal server error', status: 500 },
} as const;

export class ApiErrorResponse extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(error: ApiError, details?: unknown) {
    super(error.message);
    this.code = error.code;
    this.status = error.status;
    this.details = details;
  }
}

export function throwApiError(error: ApiError, details?: unknown): never {
  throw new ApiErrorResponse(error, details);
}

export function createErrorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof ApiErrorResponse) {
        return c.json(
          {
            ok: false,
            code: err.code,
            message: err.message,
            details: err.details ?? null,
          },
          err.status as 400,
        );
      }

      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[orbit/server] Unhandled error:', message);

      return c.json(
        {
          ok: false,
          code: API_ERRORS.INTERNAL.code,
          message: API_ERRORS.INTERNAL.message,
          details: null,
        },
        500,
      );
    }
  };
}
