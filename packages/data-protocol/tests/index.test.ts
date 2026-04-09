import { describe, expect, it } from 'vitest';

import { createMutationEnvelope, createRepositoryCursor, isDeletionMutation } from '../src/index';

describe('data-protocol', () => {
  it('创建 mutation 信封与游标', () => {
    const mutation = createMutationEnvelope({
      mutationId: 'mut_1',
      actorId: 'user_1',
      deviceId: 'dev_1',
      type: 'article.deleted',
      occurredAt: '2026-01-01T00:00:00.000Z',
      payload: { articleId: 'art_1' },
    });

    expect(isDeletionMutation(mutation)).toBe(true);
    expect(createRepositoryCursor('2026-01-02T00:00:00.000Z', 'art_1')).toBe('2026-01-02T00:00:00.000Z::art_1');
  });
});
