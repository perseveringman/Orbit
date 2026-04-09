import { describe, expect, it } from 'vitest';

import { buildSyncPlan, getNextCheckpoint, shouldRequestAnotherPage } from '../src/index';

describe('sync-core', () => {
  it('基于本地 mutation 与远端响应计算同步计划', () => {
    const plan = buildSyncPlan({
      workspaceId: 'ws_1',
      deviceId: 'dev_1',
      checkpoint: { cursor: null, serverTime: '2026-01-01T00:00:00.000Z' },
      pendingMutations: [
        {
          mutationId: 'mut_1',
          actorId: 'user_1',
          deviceId: 'dev_1',
          type: 'article.updated',
          occurredAt: '2026-01-01T00:10:00.000Z',
          payload: { articleId: 'art_1' },
        },
      ],
      pullLimit: 50,
    });

    expect(plan.pushRequest.mutations).toHaveLength(1);
    expect(plan.pullRequest.limit).toBe(50);
    expect(shouldRequestAnotherPage({ applied: [], checkpoint: { cursor: 'cp_2', serverTime: '2026-01-01T00:20:00.000Z' }, hasMore: true })).toBe(true);
    expect(getNextCheckpoint({ applied: [], checkpoint: { cursor: 'cp_2', serverTime: '2026-01-01T00:20:00.000Z' }, hasMore: false })).toEqual({ cursor: 'cp_2', serverTime: '2026-01-01T00:20:00.000Z' });
  });
});
