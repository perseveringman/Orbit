import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import {
  createWorkbenchShellViewModel,
  type WorkbenchMetricId,
  type WorkbenchSectionId,
  type WorkbenchShellInput,
  type WorkbenchShellViewModel
} from '../src/index.ts';

function readPackageSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

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

function createTaskRecordWithProjectIdCounter(
  overrides: Partial<TaskRecord> & Pick<TaskRecord, 'id' | 'title'>,
  accessCounter: { count: number }
): TaskRecord {
  const record = createTaskRecord(overrides);
  let projectId = record.projectId;

  Object.defineProperty(record, 'projectId', {
    get() {
      accessCounter.count += 1;
      return projectId;
    },
    set(value: TaskRecord['projectId']) {
      projectId = value;
    },
    enumerable: true,
    configurable: true
  });

  return record;
}

function getReviewCount(viewModel: WorkbenchShellViewModel): number {
  return (
    viewModel.review.completedToday.length +
    viewModel.review.carryForward.length +
    viewModel.review.projectsNeedingReview.length +
    viewModel.review.tasksNeedingReview.length
  );
}

function getSectionCount(viewModel: WorkbenchShellViewModel, sectionId: WorkbenchSectionId): number | undefined {
  return viewModel.sections.find((section) => section.id === sectionId)?.count;
}

function getMetricValue(viewModel: WorkbenchShellViewModel, metricId: WorkbenchMetricId): number | undefined {
  return viewModel.planner.metrics.find((metric) => metric.id === metricId)?.value;
}

test('app-viewmodels source removes legacy workbench section ids from shell input types', () => {
  const source = readPackageSource('../src/types.ts');

  assert.doesNotMatch(source, /\bLegacyWorkspaceSection\b/);
  assert.doesNotMatch(source, /'inbox'/);
  assert.doesNotMatch(source, /'library'/);
});

test('app-viewmodels source removes legacy workbench section normalization', () => {
  const source = readPackageSource('../src/create-workbench-shell-view-model.ts');

  assert.doesNotMatch(source, /\bnormalizeActiveSection\b/);
  assert.doesNotMatch(source, /case 'inbox'/);
  assert.doesNotMatch(source, /case 'library'/);
});

test('app-viewmodels source requires currentDate in workbench shell input', () => {
  const source = readPackageSource('../src/types.ts');

  assert.match(source, /currentDate: WorkbenchCurrentDateInput;/);
  assert.doesNotMatch(source, /currentDate\?: WorkbenchCurrentDateInput;/);
});

test('app-viewmodels creates a deterministic project-task loop shell view model', () => {
  const viewModel = createWorkbenchShellViewModel({
    locale: 'en-US',
    activeSection: 'today',
    currentDate: '2026-02-10',
    userIntent: 'Ship the desktop loop',
    projects: [
      createProjectRecord({
        id: 'project-orbit',
        title: 'Orbit Desktop',
        lastReviewedAt: '2026-02-09T17:00:00.000Z'
      }),
      createProjectRecord({
        id: 'project-launch',
        title: 'Launch Plan',
        lastReviewedAt: null
      }),
      createProjectRecord({
        id: 'project-archive',
        title: 'Knowledge Base',
        status: 'done',
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      })
    ],
    tasks: [
      createTaskRecord({
        id: 'task-focus',
        projectId: 'project-orbit',
        title: 'Wire focus card',
        status: 'todo',
        todayOn: '2026-02-10',
        focusRank: 1,
        lastReviewedAt: '2026-02-09T12:00:00.000Z'
      }),
      createTaskRecord({
        id: 'task-doing',
        projectId: 'project-orbit',
        title: 'Polish today panel',
        status: 'doing',
        todayOn: '2026-02-10',
        focusRank: 2,
        lastReviewedAt: '2026-02-10T08:30:00.000Z'
      }),
      createTaskRecord({
        id: 'task-carry',
        projectId: 'project-launch',
        title: 'Capture review notes',
        status: 'todo',
        todayOn: '2026-02-09',
        focusRank: 3,
        lastReviewedAt: null
      }),
      createTaskRecord({
        id: 'task-done',
        projectId: 'project-launch',
        title: 'Archive old sketches',
        status: 'done',
        completedAt: '2026-02-10T11:15:00.000Z',
        lastReviewedAt: '2026-02-09T09:00:00.000Z'
      }),
      createTaskRecord({
        id: 'task-canceled',
        title: 'Inbox zero pass',
        status: 'canceled'
      })
    ]
  });
  const reviewCount = getReviewCount(viewModel);

  assert.deepEqual(Object.keys(viewModel).sort(), [
    'activeProject',
    'activeSection',
    'focus',
    'planner',
    'projects',
    'review',
    'sections',
    'tasks',
    'title',
    'today'
  ]);
  assert.equal(viewModel.title, 'Orbit Workbench');
  assert.equal(reviewCount, 6);
   assert.equal(viewModel.activeProject?.id, 'project-orbit');
  assert.deepEqual(viewModel.sections, [
    { id: 'projects', label: 'Projects', count: 3, active: false },
    { id: 'tasks', label: 'Tasks', count: 5, active: false },
    { id: 'today', label: 'Today', count: 2, active: true },
    { id: 'focus', label: 'Focus', count: 1, active: false },
    { id: 'review', label: 'Review', count: reviewCount, active: false }
  ]);
  assert.deepEqual(viewModel.planner, {
    title: 'Planner',
    intentLabel: 'Intent',
    intent: 'Ship the desktop loop',
    currentDate: '2026-02-10',
    summary: '2 active projects · 3 open tasks · 2 for today · 6 review signals',
    metrics: [
      { id: 'projects', label: 'Projects', value: 2 },
      { id: 'tasks', label: 'Tasks', value: 3 },
      { id: 'today', label: 'Today', value: 2 },
      { id: 'review', label: 'Review', value: reviewCount }
    ]
  });
  assert.deepEqual(viewModel.tasks.map((task) => task.id), [
    'task-focus',
    'task-doing',
    'task-carry',
    'task-done',
    'task-canceled'
  ]);
  assert.deepEqual(viewModel.today.map((task) => task.id), ['task-focus', 'task-doing']);
  assert.equal(viewModel.focus?.id, 'task-focus');
  assert.equal(viewModel.focus?.projectTitle, 'Orbit Desktop');
  assert.deepEqual(viewModel.review, {
    summary: '1 completed today · 1 to carry forward · 4 pending review signals',
    completedToday: [viewModel.tasks[3]],
    carryForward: [viewModel.tasks[2]],
    projectsNeedingReview: [viewModel.projects[0], viewModel.projects[1]],
    tasksNeedingReview: [viewModel.tasks[0], viewModel.tasks[2]]
  });
});

test('app-viewmodels clears active project when no active projects remain', () => {
  const viewModel = createWorkbenchShellViewModel({
    locale: 'en-US',
    activeSection: 'focus',
    currentDate: '2026-02-10',
    userIntent: 'Avoid closed-project fallback',
    projects: [
      createProjectRecord({
        id: 'project-done',
        title: 'Closed launch',
        status: 'done',
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      }),
      createProjectRecord({
        id: 'project-archive',
        title: 'Archived notes',
        status: 'archived',
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      })
    ],
    tasks: [
      createTaskRecord({
        id: 'task-focus',
        projectId: 'project-done',
        title: 'Wrap the final note',
        status: 'doing',
        todayOn: '2026-02-10',
        focusRank: 1,
        lastReviewedAt: '2026-02-10T09:00:00.000Z'
      })
    ]
  });

  assert.equal(viewModel.focus?.id, 'task-focus');
  assert.equal(viewModel.activeProject, null);
});

test('app-viewmodels falls back to the first active project when focus points at a closed project', () => {
  const viewModel = createWorkbenchShellViewModel({
    locale: 'en-US',
    activeSection: 'focus',
    currentDate: '2026-02-10',
    userIntent: 'Keep active project selection stable',
    projects: [
      createProjectRecord({
        id: 'project-done',
        title: 'Closed launch',
        status: 'done',
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      }),
      createProjectRecord({
        id: 'project-active',
        title: 'Active rollout',
        status: 'active',
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      })
    ],
    tasks: [
      createTaskRecord({
        id: 'task-focus',
        projectId: 'project-done',
        title: 'Wrap the final note',
        status: 'doing',
        todayOn: '2026-02-10',
        focusRank: 1,
        lastReviewedAt: '2026-02-10T09:00:00.000Z'
      })
    ]
  });

  assert.equal(viewModel.focus?.id, 'task-focus');
  assert.equal(viewModel.activeProject?.id, 'project-active');
});

test('app-viewmodels keeps project summary task grouping linear in task count', () => {
  const projectCount = 24;
  const taskCount = 48;
  const projectIdAccessCounter = { count: 0 };
  const projects = Array.from({ length: projectCount }, (_, index) =>
    createProjectRecord({
      id: `project-${index}`,
      title: `Project ${String(index).padStart(2, '0')}`,
      lastReviewedAt: '2026-02-10T08:00:00.000Z'
    })
  );
  const tasks = Array.from({ length: taskCount }, (_, index) =>
    createTaskRecordWithProjectIdCounter(
      {
        id: `task-${index}`,
        projectId: `project-${index % projectCount}`,
        title: `Task ${String(index).padStart(2, '0')}`,
        status: index % 4 === 0 ? 'doing' : 'todo',
        todayOn: index % 6 === 0 ? '2026-02-10' : null,
        lastReviewedAt: '2026-02-10T09:00:00.000Z'
      },
      projectIdAccessCounter
    )
  );

  const viewModel = createWorkbenchShellViewModel({
    locale: 'en-US',
    activeSection: 'projects',
    currentDate: '2026-02-10',
    userIntent: 'Keep the planner fast',
    projects,
    tasks
  });

  assert.equal(viewModel.projects.length, projectCount);
  assert.equal(viewModel.tasks.length, taskCount);
  assert.ok(
    projectIdAccessCounter.count <= taskCount * 6,
    `expected project summary grouping to stay linear in task count, received ${projectIdAccessCounter.count} projectId reads for ${taskCount} tasks`
  );
});

test('app-viewmodels counts every review item surfaced in review payload badges', () => {
  const viewModel = createWorkbenchShellViewModel({
    locale: 'en-US',
    activeSection: 'review',
    currentDate: '2026-02-10',
    userIntent: 'Close the loop',
    projects: [
      createProjectRecord({
        id: 'project-1',
        title: 'Orbit Desktop',
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      })
    ],
    tasks: [
      createTaskRecord({
        id: 'task-carry',
        projectId: 'project-1',
        title: 'Follow up on yesterday',
        status: 'todo',
        todayOn: '2026-02-09',
        lastReviewedAt: '2026-02-10T09:00:00.000Z'
      }),
      createTaskRecord({
        id: 'task-done',
        projectId: 'project-1',
        title: 'Ship the patch',
        status: 'done',
        completedAt: '2026-02-10T10:30:00.000Z',
        lastReviewedAt: '2026-02-10T10:45:00.000Z'
      })
    ]
  });
  const reviewCount = getReviewCount(viewModel);

  assert.equal(reviewCount, 2);
  assert.equal(getSectionCount(viewModel, 'review'), reviewCount);
  assert.equal(getMetricValue(viewModel, 'review'), reviewCount);
  assert.deepEqual(viewModel.review.completedToday.map((task) => task.id), ['task-done']);
  assert.deepEqual(viewModel.review.carryForward.map((task) => task.id), ['task-carry']);
  assert.deepEqual(viewModel.review.projectsNeedingReview, []);
  assert.deepEqual(viewModel.review.tasksNeedingReview, []);
});

test('app-viewmodels tolerates malformed persisted date fields when building the shell view model', () => {
  const viewModel = createWorkbenchShellViewModel({
    locale: 'en-US',
    activeSection: 'review',
    currentDate: '2026-02-10',
    userIntent: 'Recover safely from persistence drift',
    projects: [
      createProjectRecord({
        id: 'project-1',
        title: 'Orbit Desktop',
        lastReviewedAt: 'not-a-date'
      })
    ],
    tasks: [
      createTaskRecord({
        id: 'task-open',
        projectId: 'project-1',
        title: 'Rebuild the review queue',
        status: 'todo',
        todayOn: 'also-not-a-date',
        lastReviewedAt: 'still-not-a-date'
      }),
      createTaskRecord({
        id: 'task-done',
        projectId: 'project-1',
        title: 'Close the loop',
        status: 'done',
        completedAt: 'bad-completed-at',
        lastReviewedAt: 'bad-review-date'
      })
    ]
  });

  assert.deepEqual(viewModel.today, []);
  assert.equal(viewModel.focus, null);
  assert.deepEqual(viewModel.review.completedToday, []);
  assert.deepEqual(viewModel.review.carryForward, []);
  assert.deepEqual(viewModel.review.projectsNeedingReview.map((project) => project.id), ['project-1']);
  assert.deepEqual(viewModel.review.tasksNeedingReview.map((task) => task.id), ['task-open']);
  assert.equal(viewModel.tasks.find((task) => task.id === 'task-open')?.isToday, false);
  assert.equal(viewModel.tasks.find((task) => task.id === 'task-open')?.isCarryForward, false);
  assert.equal(viewModel.tasks.find((task) => task.id === 'task-open')?.needsReview, true);
});

test('app-viewmodels normalizes currentDate and persisted todayOn timestamps before classifying task buckets', () => {
  const viewModel = createWorkbenchShellViewModel({
    locale: 'en-US',
    activeSection: 'today',
    currentDate: '2026-02-10T23:59:59.000Z',
    userIntent: 'Stay on schedule',
    projects: [
      createProjectRecord({
        id: 'project-1',
        title: 'Orbit Desktop',
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      })
    ],
    tasks: [
      createTaskRecord({
        id: 'task-today',
        projectId: 'project-1',
        title: 'Finish the review card',
        status: 'doing',
        todayOn: '2026-02-10T07:15:00.000Z',
        lastReviewedAt: '2026-02-10T09:00:00.000Z'
      }),
      createTaskRecord({
        id: 'task-carry',
        projectId: 'project-1',
        title: 'Continue yesterday work',
        status: 'todo',
        todayOn: '2026-02-09T18:45:00.000Z',
        lastReviewedAt: '2026-02-10T10:00:00.000Z'
      }),
      createTaskRecord({
        id: 'task-done',
        projectId: 'project-1',
        title: 'Wrap the release note',
        status: 'done',
        completedAt: '2026-02-10T05:00:00.000Z',
        lastReviewedAt: '2026-02-10T11:00:00.000Z'
      })
    ]
  });

  assert.equal(viewModel.planner.currentDate, '2026-02-10');
  assert.deepEqual(viewModel.today.map((task) => task.id), ['task-today']);
  assert.deepEqual(viewModel.review.completedToday.map((task) => task.id), ['task-done']);
  assert.deepEqual(viewModel.review.carryForward.map((task) => task.id), ['task-carry']);
  assert.equal(viewModel.tasks.find((task) => task.id === 'task-today')?.isToday, true);
  assert.equal(viewModel.tasks.find((task) => task.id === 'task-carry')?.isCarryForward, true);
});

test('app-viewmodels rejects a missing currentDate from unsafe callers instead of defaulting task classification', () => {
  const unsafeInput = {
    locale: 'en-US',
    activeSection: 'today',
    userIntent: 'Stay aligned',
    projects: [],
    tasks: [
      createTaskRecord({
        id: 'task-1',
        title: 'Capture next action',
        status: 'todo',
        todayOn: '2026-02-10'
      })
    ]
  } as unknown as WorkbenchShellInput;

  assert.throws(
    () => createWorkbenchShellViewModel(unsafeInput),
    /currentDate/i
  );
});

test('app-viewmodels prefers doing tasks when focus ranks tie', () => {
  const viewModel = createWorkbenchShellViewModel({
    locale: 'en-US',
    activeSection: 'focus',
    currentDate: '2026-02-10',
    userIntent: 'Stay in flow',
    projects: [createProjectRecord({ id: 'project-1', title: 'Orbit Desktop' })],
    tasks: [
      createTaskRecord({
        id: 'task-todo',
        projectId: 'project-1',
        title: 'Queue next action',
        status: 'todo',
        todayOn: '2026-02-10',
        focusRank: 1
      }),
      createTaskRecord({
        id: 'task-doing',
        projectId: 'project-1',
        title: 'Finish current action',
        status: 'doing',
        todayOn: '2026-02-10',
        focusRank: 1
      })
    ]
  });

  assert.equal(viewModel.focus?.id, 'task-doing');
});

test('app-viewmodels excludes soft-deleted projects and tasks from shell summaries', () => {
  const viewModel = createWorkbenchShellViewModel({
    locale: 'en-US',
    activeSection: 'projects',
    currentDate: '2026-02-10',
    userIntent: 'Keep deleted items hidden',
    projects: [
      createProjectRecord({
        id: 'project-active',
        title: 'Orbit Desktop',
        lastReviewedAt: '2026-02-10T08:00:00.000Z'
      }),
      createProjectRecord({
        id: 'project-deleted',
        title: 'Old Project',
        deletedAt: '2026-02-09T12:00:00.000Z',
        lastReviewedAt: null
      })
    ],
    tasks: [
      createTaskRecord({
        id: 'task-active',
        projectId: 'project-active',
        title: 'Finish the planner',
        status: 'todo',
        todayOn: '2026-02-10',
        focusRank: 2,
        lastReviewedAt: '2026-02-10T09:00:00.000Z'
      }),
      createTaskRecord({
        id: 'task-deleted',
        projectId: 'project-active',
        title: 'Hidden follow-up',
        status: 'todo',
        todayOn: '2026-02-10',
        focusRank: 1,
        deletedAt: '2026-02-09T12:00:00.000Z',
        lastReviewedAt: null
      }),
      createTaskRecord({
        id: 'task-orphaned',
        projectId: 'project-deleted',
        title: 'Deleted project child',
        status: 'todo',
        todayOn: '2026-02-10',
        focusRank: 1,
        lastReviewedAt: null
      })
    ]
  });

  assert.deepEqual(viewModel.projects.map((project) => project.id), ['project-active']);
  assert.deepEqual(viewModel.tasks.map((task) => task.id), ['task-active']);
  assert.deepEqual(viewModel.today.map((task) => task.id), ['task-active']);
  assert.equal(viewModel.focus?.id, 'task-active');
  assert.deepEqual(viewModel.review.projectsNeedingReview, []);
  assert.deepEqual(viewModel.review.tasksNeedingReview, []);
  assert.equal(getSectionCount(viewModel, 'projects'), 1);
  assert.equal(getSectionCount(viewModel, 'tasks'), 1);
  assert.equal(getSectionCount(viewModel, 'today'), 1);
  assert.equal(getSectionCount(viewModel, 'focus'), 1);
  assert.equal(getSectionCount(viewModel, 'review'), 0);
  assert.equal(getMetricValue(viewModel, 'projects'), 1);
  assert.equal(getMetricValue(viewModel, 'tasks'), 1);
  assert.equal(getMetricValue(viewModel, 'today'), 1);
  assert.equal(getMetricValue(viewModel, 'review'), 0);
});
