import type { IsoDateString, LegacyTaskStatus, ProjectRecord, TaskRecord } from '@orbit/domain';
import { createTranslator, type MessageKey } from '@orbit/i18n';
import type {
  WorkbenchMetricId,
  WorkbenchMetricViewModel,
  WorkbenchCurrentDateInput,
  WorkbenchPlannerSummaryViewModel,
  WorkbenchProjectSummaryViewModel,
  WorkbenchSectionId,
  WorkbenchSectionViewModel,
  WorkbenchShellInput,
  WorkbenchShellViewModel,
  WorkbenchTaskSummaryViewModel
} from './types';

const WORKBENCH_SECTION_IDS: WorkbenchSectionId[] = ['projects', 'tasks', 'today', 'focus', 'review'];
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T/;
const SECTION_LABEL_KEYS: Record<WorkbenchSectionId, MessageKey> = {
  projects: 'workbench.section.projects',
  tasks: 'workbench.section.tasks',
  today: 'workbench.section.today',
  focus: 'workbench.section.focus',
  review: 'workbench.section.review'
};
const METRIC_LABEL_KEYS: Record<WorkbenchMetricId, MessageKey> = {
  projects: 'workbench.section.projects',
  tasks: 'workbench.section.tasks',
  today: 'workbench.section.today',
  review: 'workbench.section.review'
};

function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function normalizeOptionalDateOnly(value: string | null | undefined): IsoDateString | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (ISO_DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  const isoDateTimeMatch = value.match(ISO_DATE_TIME_PATTERN);

  if (isoDateTimeMatch) {
    return isoDateTimeMatch[1];
  }

  return null;
}

function normalizeRequiredDateOnly(value: string | null | undefined, fieldName: string): IsoDateString {
  const normalizedDate = normalizeOptionalDateOnly(value);

  if (normalizedDate !== null) {
    return normalizedDate;
  }

  throw new Error(`${fieldName} must be a YYYY-MM-DD date or ISO timestamp`);
}

function resolveCurrentDate(currentDate: WorkbenchCurrentDateInput | null | undefined): IsoDateString {
  if (currentDate !== null && currentDate !== undefined) {
    return normalizeRequiredDateOnly(currentDate, 'currentDate');
  }

  throw new Error('currentDate is required and must be a YYYY-MM-DD date or ISO timestamp');
}

function isOpenTaskStatus(status: LegacyTaskStatus): boolean {
  return status === 'todo' || status === 'doing';
}

function isTodayTask(task: TaskRecord, currentDate: IsoDateString): boolean {
  return isOpenTaskStatus(task.status) && normalizeOptionalDateOnly(task.todayOn) === currentDate;
}

function isCarryForwardTask(task: TaskRecord, currentDate: IsoDateString): boolean {
  const todayOn = normalizeOptionalDateOnly(task.todayOn);
  return isOpenTaskStatus(task.status) && todayOn !== null && todayOn < currentDate;
}

function isCompletedToday(
  task: Pick<TaskRecord, 'status' | 'completedAt'> | Pick<WorkbenchTaskSummaryViewModel, 'status' | 'completedAt'>,
  currentDate: IsoDateString
): boolean {
  return task.status === 'done' && normalizeOptionalDateOnly(task.completedAt) === currentDate;
}

function needsProjectReview(project: ProjectRecord, currentDate: IsoDateString): boolean {
  const lastReviewedOn = normalizeOptionalDateOnly(project.lastReviewedAt);
  return project.status === 'active' && (lastReviewedOn === null || lastReviewedOn < currentDate);
}

function needsTaskReview(task: TaskRecord, currentDate: IsoDateString): boolean {
  const lastReviewedOn = normalizeOptionalDateOnly(task.lastReviewedAt);
  return isOpenTaskStatus(task.status) && (lastReviewedOn === null || lastReviewedOn < currentDate);
}

function isNotSoftDeleted<RecordType extends { deletedAt?: string | null }>(record: RecordType): boolean {
  return record.deletedAt === null || record.deletedAt === undefined;
}

function projectSortOrder(project: WorkbenchProjectSummaryViewModel): number {
  switch (project.status) {
    case 'active':
      return 0;
    case 'paused':
      return 1;
    case 'done':
      return 2;
    case 'archived':
      return 3;
  }
}

function taskSortBucket(task: WorkbenchTaskSummaryViewModel): number {
  if (task.isToday) {
    return 0;
  }

  if (task.isCarryForward) {
    return 1;
  }

  if (task.status === 'doing' || task.status === 'todo') {
    return 2;
  }

  if (task.status === 'done') {
    return 3;
  }

  return 4;
}

function taskStatusOrder(task: WorkbenchTaskSummaryViewModel): number {
  switch (task.status) {
    case 'doing':
      return 0;
    case 'todo':
      return 1;
    case 'done':
      return 2;
    case 'canceled':
      return 3;
  }
}

function focusRankOrder(task: WorkbenchTaskSummaryViewModel): number {
  return task.focusRank ?? Number.MAX_SAFE_INTEGER;
}

function compareTaskSummaries(left: WorkbenchTaskSummaryViewModel, right: WorkbenchTaskSummaryViewModel): number {
  return (
    taskSortBucket(left) - taskSortBucket(right) ||
    focusRankOrder(left) - focusRankOrder(right) ||
    taskStatusOrder(left) - taskStatusOrder(right) ||
    compareStrings(left.title, right.title) ||
    compareStrings(left.id, right.id)
  );
}

function createSections(
  activeSection: WorkbenchSectionId,
  counts: Record<WorkbenchSectionId, number>,
  t: ReturnType<typeof createTranslator>['t']
): WorkbenchSectionViewModel[] {
  return WORKBENCH_SECTION_IDS.map((sectionId) => ({
    id: sectionId,
    label: t(SECTION_LABEL_KEYS[sectionId]),
    count: counts[sectionId],
    active: activeSection === sectionId
  }));
}

function createMetrics(
  counts: Record<WorkbenchMetricId, number>,
  t: ReturnType<typeof createTranslator>['t']
): WorkbenchMetricViewModel[] {
  return (['projects', 'tasks', 'today', 'review'] as const).map((metricId) => ({
    id: metricId,
    label: t(METRIC_LABEL_KEYS[metricId]),
    value: counts[metricId]
  }));
}

function createPlanner(
  currentDate: IsoDateString,
  userIntent: string,
  counts: Record<WorkbenchMetricId, number>,
  t: ReturnType<typeof createTranslator>['t']
): WorkbenchPlannerSummaryViewModel {
  return {
    title: t('workbench.planner.title'),
    intentLabel: t('workbench.planner.intentLabel'),
    intent: userIntent,
    currentDate,
    summary: t('workbench.planner.summary', {
      projectCount: counts.projects,
      taskCount: counts.tasks,
      todayCount: counts.today,
      reviewCount: counts.review
    }),
    metrics: createMetrics(counts, t)
  };
}

function createTasksByProjectId(tasks: readonly TaskRecord[]) {
  const tasksByProjectId = new Map<string, TaskRecord[]>();

  for (const task of tasks) {
    if (task.projectId === null || task.projectId === undefined) {
      continue;
    }

    const projectTasks = tasksByProjectId.get(task.projectId);

    if (projectTasks) {
      projectTasks.push(task);
      continue;
    }

    tasksByProjectId.set(task.projectId, [task]);
  }

  return tasksByProjectId;
}

function createProjectSummaries(projects: readonly ProjectRecord[], tasks: readonly TaskRecord[], currentDate: IsoDateString) {
  const tasksByProjectId = createTasksByProjectId(tasks);
  const projectSummaries = projects
    .map<WorkbenchProjectSummaryViewModel>((project) => {
      const projectTasks = tasksByProjectId.get(project.id) ?? [];
      let openTaskCount = 0;
      let doneTaskCount = 0;
      let todayCount = 0;

      for (const task of projectTasks) {
        if (isOpenTaskStatus(task.status)) {
          openTaskCount += 1;
        }

        if (task.status === 'done') {
          doneTaskCount += 1;
        }

        if (isTodayTask(task, currentDate)) {
          todayCount += 1;
        }
      }

      return {
        id: project.id,
        title: project.title,
        status: project.status,
        taskCount: projectTasks.length,
        openTaskCount,
        doneTaskCount,
        todayCount,
        lastReviewedAt: project.lastReviewedAt ?? null,
        needsReview: needsProjectReview(project, currentDate)
      };
    })
    .sort((left, right) => {
      return (
        projectSortOrder(left) - projectSortOrder(right) ||
        compareStrings(left.title, right.title) ||
        compareStrings(left.id, right.id)
      );
    });

  const projectTitleById = new Map(projectSummaries.map((project) => [project.id, project.title]));

  return {
    projectSummaries,
    projectTitleById
  };
}

function createTaskSummaries(tasks: readonly TaskRecord[], projectTitleById: Map<string, string>, currentDate: IsoDateString) {
  return tasks
    .map<WorkbenchTaskSummaryViewModel>((task) => {
      const projectId = task.projectId;
      const normalizedTodayOn = normalizeOptionalDateOnly(task.todayOn);

      return {
        id: task.id,
        title: task.title,
        status: task.status,
        projectId,
        projectTitle: projectId ? projectTitleById.get(projectId) ?? null : null,
        todayOn: normalizedTodayOn,
        focusRank: task.focusRank ?? null,
        completedAt: task.completedAt ?? null,
        lastReviewedAt: task.lastReviewedAt ?? null,
        isToday: isOpenTaskStatus(task.status) && normalizedTodayOn === currentDate,
        isCarryForward: isOpenTaskStatus(task.status) && normalizedTodayOn !== null && normalizedTodayOn < currentDate,
        needsReview: needsTaskReview(task, currentDate)
      };
    })
    .sort(compareTaskSummaries);
}

function createReviewSummary(
  taskSummaries: readonly WorkbenchTaskSummaryViewModel[],
  projectSummaries: readonly WorkbenchProjectSummaryViewModel[],
  currentDate: IsoDateString,
  t: ReturnType<typeof createTranslator>['t']
) {
  const completedToday = taskSummaries.filter((task) => isCompletedToday(task, currentDate));
  const carryForward = taskSummaries.filter((task) => task.isCarryForward);
  const projectsNeedingReview = projectSummaries.filter((project) => project.needsReview);
  const tasksNeedingReview = taskSummaries.filter((task) => task.needsReview);
  const pendingReviewCount = projectsNeedingReview.length + tasksNeedingReview.length;
  const reviewItemCount = completedToday.length + carryForward.length + pendingReviewCount;

  return {
    review: {
      summary: t('workbench.review.summary', {
        completedCount: completedToday.length,
        carryForwardCount: carryForward.length,
        pendingCount: pendingReviewCount
      }),
      completedToday,
      carryForward,
      projectsNeedingReview,
      tasksNeedingReview
    },
    reviewItemCount
  };
}

function resolveActiveProject(
  projectSummaries: readonly WorkbenchProjectSummaryViewModel[],
  focus: WorkbenchTaskSummaryViewModel | null
): WorkbenchProjectSummaryViewModel | null {
  if (focus?.projectId) {
    const focusProject = projectSummaries.find((project) => project.id === focus.projectId);

    if (focusProject?.status === 'active') {
      return focusProject;
    }
  }

  return projectSummaries.find((project) => project.status === 'active') ?? null;
}

export function createWorkbenchShellViewModel(input: WorkbenchShellInput): WorkbenchShellViewModel {
  const translator = createTranslator(input.locale);
  const currentDate = resolveCurrentDate(input.currentDate);
  const userIntent = input.userIntent?.trim() ?? '';
  const projects = (input.projects ?? []).filter(isNotSoftDeleted);
  const survivingProjectIds = new Set(projects.map((project) => project.id));
  const tasks = (input.tasks ?? []).filter((task) => {
    if (!isNotSoftDeleted(task)) {
      return false;
    }

    const projectId = task.projectId;
    return projectId === null || projectId === undefined || survivingProjectIds.has(projectId);
  });
  const activeSection = input.activeSection;

  const { projectSummaries, projectTitleById } = createProjectSummaries(projects, tasks, currentDate);
  const taskSummaries = createTaskSummaries(tasks, projectTitleById, currentDate);
  const today = taskSummaries.filter((task) => task.isToday);
  const focus = today[0] ?? null;
  const activeProject = resolveActiveProject(projectSummaries, focus);
  const { review, reviewItemCount } = createReviewSummary(taskSummaries, projectSummaries, currentDate, translator.t);
  const metricCounts: Record<WorkbenchMetricId, number> = {
    projects: projectSummaries.filter((project) => project.status === 'active').length,
    tasks: taskSummaries.filter((task) => task.status === 'todo' || task.status === 'doing').length,
    today: today.length,
    review: reviewItemCount
  };
  const sectionCounts: Record<WorkbenchSectionId, number> = {
    projects: projectSummaries.length,
    tasks: taskSummaries.length,
    today: today.length,
    focus: focus ? 1 : 0,
    review: reviewItemCount
  };

  return {
    title: translator.t('workbench.title'),
    activeSection,
    sections: createSections(activeSection, sectionCounts, translator.t),
    planner: createPlanner(currentDate, userIntent, metricCounts, translator.t),
    projects: projectSummaries,
    activeProject,
    tasks: taskSummaries,
    today,
    focus,
    review
  };
}
