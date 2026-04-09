import { describe, expect, it } from 'vitest';

import { createWorkspaceSelection, makeWorkspaceCacheKey } from '../src/index';

describe('workspace-core', () => {
  it('创建工作区选择状态与缓存键', () => {
    expect(createWorkspaceSelection('article', 'art_1')).toEqual({ kind: 'article', id: 'art_1' });
    expect(makeWorkspaceCacheKey('ws_1', 'inbox')).toBe('workspace:ws_1:view:inbox');
  });
});
