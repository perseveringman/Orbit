import { describe, expect, it } from 'vitest';

import { API_VERSION, createBearerAuthHeader, isServerCheckpoint } from '../src/index';

describe('api-types', () => {
  it('暴露 API 版本与鉴权辅助', () => {
    expect(API_VERSION).toBe('2026-01-01');
    expect(createBearerAuthHeader('token_1')).toEqual({ Authorization: 'Bearer token_1' });
    expect(isServerCheckpoint({ cursor: 'cp_1', serverTime: '2026-01-01T00:00:00.000Z' })).toBe(true);
  });
});
