import { describe, expect, it } from 'vitest';

import { WORKSPACE_VIEW_IDS, createWorkspaceSelection, makeWorkspaceCacheKey } from '../src/index';

describe('workspace-core', () => {
  it('暴露 P0 计划循环视图与选择状态', () => {
    expect(WORKSPACE_VIEW_IDS).toEqual(['projects', 'tasks', 'today', 'focus', 'review']);
    expect(createWorkspaceSelection('project', 'proj_1')).toEqual({ kind: 'project', id: 'proj_1' });
    expect(createWorkspaceSelection('task', 'task_1')).toEqual({ kind: 'task', id: 'task_1' });
    expect(makeWorkspaceCacheKey('ws_1', 'focus')).toBe('workspace:ws_1:view:focus');
  });
});
