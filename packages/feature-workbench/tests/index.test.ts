import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createWorkbenchDomModule, mountWorkbench } from '../src/index.ts';

function createProjectRecord(overrides: Partial<ProjectRecord> & Pick<ProjectRecord, 'id' | 'title'>): ProjectRecord {
  return {
    kind: 'project',
    id: overrides.id,
    workspaceId: 'workspace-1',
    title: overrides.title,
    status: overrides.status ?? 'active',
    createdAt: overrides.createdAt ?? '2026-02-01T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-02-01T09:00:00.000Z',
    deletedAt: overrides.deletedAt,
    lastReviewedAt: overrides.lastReviewedAt ?? null
  };
}

function createTaskRecord(overrides: Partial<TaskRecord> & Pick<TaskRecord, 'id' | 'title'>): TaskRecord {
  return {
    kind: 'task',
    id: overrides.id,
    workspaceId: 'workspace-1',
    projectId: overrides.projectId ?? null,
    title: overrides.title,
    status: overrides.status ?? 'todo',
    createdAt: overrides.createdAt ?? '2026-02-01T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-02-01T09:00:00.000Z',
    deletedAt: overrides.deletedAt,
    todayOn: overrides.todayOn ?? null,
    focusRank: overrides.focusRank ?? null,
    completedAt: overrides.completedAt ?? null,
    lastReviewedAt: overrides.lastReviewedAt ?? null
  };
}

test('feature-workbench：组合 P0 planner/workspace/review 槽位给桌面宿主', () => {
  const module = createWorkbenchDomModule({
    host: { kind: 'desktop', containerId: 'orbit-root' },
    locale: 'en-US',
    activeSection: 'today',
    currentDate: '2026-02-10',
    userIntent: 'Ship the desktop loop',
    draft: '# Focus brief\nLock project, task, today, focus, and review into one screen.',
    projects: [
      createProjectRecord({
        id: 'project-orbit',
        title: 'Orbit Desktop P0',
        lastReviewedAt: '2026-02-09T18:00:00.000Z'
      }),
      createProjectRecord({
        id: 'project-reader',
        title: 'Reader shell cleanup',
        status: 'done',
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      })
    ],
    tasks: [
      createTaskRecord({
        id: 'task-focus',
        projectId: 'project-orbit',
        title: 'Wire desktop workbench',
        status: 'doing',
        todayOn: '2026-02-10',
        focusRank: 1,
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      }),
      createTaskRecord({
        id: 'task-today',
        projectId: 'project-orbit',
        title: 'Polish review card',
        status: 'todo',
        todayOn: '2026-02-10',
        focusRank: 2,
        lastReviewedAt: '2026-02-10T08:30:00.000Z'
      }),
      createTaskRecord({
        id: 'task-carry',
        projectId: 'project-orbit',
        title: 'Rewire compatibility hosts',
        status: 'todo',
        todayOn: '2026-02-09',
        focusRank: 3,
        lastReviewedAt: null
      }),
      createTaskRecord({
        id: 'task-done',
        projectId: 'project-orbit',
        title: 'Retire reader demo',
        status: 'done',
        completedAt: '2026-02-10T10:15:00.000Z',
        lastReviewedAt: '2026-02-10T10:30:00.000Z'
      })
    ]
  });

  assert.equal(module.host.kind, 'desktop');
  assert.equal(module.shell.focus?.id, 'task-focus');
  assert.equal(module.editor.kind, 'dom-editor');
});

test('feature-workbench：提供宿主可调用的 P0 挂载结果', () => {
  const mounted = mountWorkbench({
    host: { kind: 'web', containerId: 'app-root' },
    locale: 'en-US',
    activeSection: 'projects',
    currentDate: '2026-02-10',
    userIntent: 'Review the loop',
    draft: '# Notes\nCheck review coverage.',
    projects: [createProjectRecord({ id: 'project-1', title: 'Orbit web shell' })],
    tasks: [createTaskRecord({ id: 'task-1', projectId: 'project-1', title: 'Adapt shell', status: 'todo' })]
  });
  const rerendered = mounted.rerender({
    activeSection: 'review'
  });

  assert.equal(mounted.mountTarget, 'app-root');
  assert.equal(mounted.hostKind, 'web');
  assert.equal(mounted.shell.title, 'Orbit Workbench');
  assert.equal(rerendered.shell.activeSection, 'review');
});
