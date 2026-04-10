import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createMobileFeatureModule, mountMobileFeature } from '../src/index.ts';

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

test('feature-mobile：组合 iOS 可挂载的 P0 工作循环摘要', () => {
  const module = createMobileFeatureModule({
    host: { kind: 'ios', navigationStyle: 'stack' },
    locale: 'zh-TW',
    activeSection: 'today',
    currentDate: '2026-02-10',
    userIntent: '完成桌面 P0',
    projects: [
      createProjectRecord({
        id: 'project-1',
        title: 'Orbit Desktop P0',
        lastReviewedAt: '2026-02-09T18:00:00.000Z'
      })
    ],
    tasks: [
      createTaskRecord({
        id: 'task-focus',
        projectId: 'project-1',
        title: '連接桌面工作台',
        status: 'doing',
        todayOn: '2026-02-10',
        focusRank: 1,
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      }),
      createTaskRecord({
        id: 'task-review',
        projectId: 'project-1',
        title: '整理回顧訊號',
        status: 'done',
        completedAt: '2026-02-10T10:15:00.000Z',
        lastReviewedAt: '2026-02-10T10:30:00.000Z'
      })
    ]
  });

  assert.equal(module.host.kind, 'ios');
  assert.equal(module.tabs[0]?.label, '首頁');
  assert.equal(module.screens.home.kind, 'native-screen');
  assert.equal(module.screens.home.projectCount, 1);
  assert.equal(module.screens.home.todayCount, 1);
  assert.equal(module.screens.focus.focusTaskId, 'task-focus');
  assert.equal(module.screens.focus.reviewSummary, '1 個今日完成 · 0 個需要延續 · 1 個待回顧訊號');
});

test('feature-mobile：提供 iOS 宿主可调用的挂载结果', () => {
  const mounted = mountMobileFeature({
    host: { kind: 'ios', navigationStyle: 'split' },
    locale: 'en-US',
    activeSection: 'review',
    currentDate: '2026-02-10',
    userIntent: 'Close the loop',
    projects: [],
    tasks: []
  });

  assert.equal(mounted.hostKind, 'ios');
  assert.equal(mounted.tabs[1]?.label, 'Library');
  assert.equal(mounted.screens.library.reviewCount, 0);
  assert.equal(mounted.screens.focus.navigationStyle, 'split');
});
