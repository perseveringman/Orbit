import type { MiddlewareHandler } from 'hono';

import { API_ERRORS, throwApiError } from './error-handler.js';

export interface RateLimitConfig {
  readonly endpoint: string;
  readonly maxRequests: number;
  readonly windowSeconds: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export const DEFAULT_RATE_LIMITS: readonly RateLimitConfig[] = [
  { endpoint: '/api/auth/register', maxRequests: 5, windowSeconds: 3600 },
  { endpoint: '/api/auth/session', maxRequests: 10, windowSeconds: 60 },
  { endpoint: '/api/sync/commit', maxRequests: 100, windowSeconds: 60 },
  { endpoint: '/api/sync/events', maxRequests: 200, windowSeconds: 60 },
  { endpoint: '/api/sync/cursor', maxRequests: 200, windowSeconds: 60 },
  { endpoint: '/api/blob', maxRequests: 50, windowSeconds: 60 },
] as const;

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    ?? c.req.header('x-real-ip')
    ?? '127.0.0.1';
}

export function createRateLimiter(configs: readonly RateLimitConfig[]): MiddlewareHandler {
  const buckets = new Map<string, TokenBucket>();
  const configMap = new Map<string, RateLimitConfig>();

  for (const config of configs) {
    configMap.set(config.endpoint, config);
  }

  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    const ip = getClientIp(c);

    let matchedConfig: RateLimitConfig | undefined;
    for (const config of configs) {
      if (path.startsWith(config.endpoint)) {
        matchedConfig = config;
        break;
      }
    }

    if (!matchedConfig) {
      await next();
      return;
    }

    const bucketKey = `${ip}:${matchedConfig.endpoint}`;
    const now = Date.now();
    let bucket = buckets.get(bucketKey);

    if (!bucket) {
      bucket = { tokens: matchedConfig.maxRequests, lastRefill: now };
      buckets.set(bucketKey, bucket);
    }

    const elapsed = (now - bucket.lastRefill) / 1000;
    const refillRate = matchedConfig.maxRequests / matchedConfig.windowSeconds;
    bucket.tokens = Math.min(matchedConfig.maxRequests, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      const retryAfter = Math.ceil((1 - bucket.tokens) / refillRate);
      c.header('Retry-After', String(retryAfter));
      throwApiError(API_ERRORS.RATE_LIMITED, { retryAfterSeconds: retryAfter });
    }

    bucket.tokens -= 1;

    c.header('X-RateLimit-Limit', String(matchedConfig.maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.floor(bucket.tokens)));

    await next();
  };
}
