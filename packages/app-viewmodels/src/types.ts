import type {
  IsoDateString,
  IsoDateTimeString,
  OrbitEntityId,
  LegacyTaskStatus,
  ProjectRecord,
  ProjectStatus,
  TaskRecord,
} from '@orbit/domain';
import type { LocaleCode } from '@orbit/i18n';

export type WorkspaceSection = 'projects' | 'tasks' | 'today' | 'focus' | 'review';
export type WorkbenchSectionId = WorkspaceSection;
export type WorkbenchMetricId = 'projects' | 'tasks' | 'today' | 'review';
export type SelectionMode = 'single' | 'range';
export type WorkbenchCurrentDateInput = IsoDateString | IsoDateTimeString;

export interface WorkbenchMetricViewModel {
  id: WorkbenchMetricId;
  label: string;
  value: number;
}

export interface WorkbenchSectionViewModel {
  id: WorkbenchSectionId;
  label: string;
  count: number;
  active: boolean;
}

export interface WorkbenchPlannerSummaryViewModel {
  title: string;
  intentLabel: string;
  intent: string;
  currentDate: IsoDateString;
  summary: string;
  metrics: WorkbenchMetricViewModel[];
}

export interface WorkbenchProjectSummaryViewModel {
  id: OrbitEntityId;
  title: string;
  status: ProjectStatus;
  taskCount: number;
  openTaskCount: number;
  doneTaskCount: number;
  todayCount: number;
  lastReviewedAt: IsoDateTimeString | null;
  needsReview: boolean;
}

export interface WorkbenchTaskSummaryViewModel {
  id: OrbitEntityId;
  title: string;
  status: LegacyTaskStatus;
  projectId: OrbitEntityId | null;
  projectTitle: string | null;
  todayOn: IsoDateString | null;
  focusRank: number | null;
  completedAt: IsoDateTimeString | null;
  lastReviewedAt: IsoDateTimeString | null;
  isToday: boolean;
  isCarryForward: boolean;
  needsReview: boolean;
}

export interface WorkbenchReviewSummaryViewModel {
  summary: string;
  completedToday: WorkbenchTaskSummaryViewModel[];
  carryForward: WorkbenchTaskSummaryViewModel[];
  projectsNeedingReview: WorkbenchProjectSummaryViewModel[];
  tasksNeedingReview: WorkbenchTaskSummaryViewModel[];
}

export interface WorkbenchShellInput {
  locale: LocaleCode;
  activeSection: WorkspaceSection;
  currentDate: WorkbenchCurrentDateInput;
  userIntent?: string;
  projects?: readonly ProjectRecord[];
  tasks?: readonly TaskRecord[];
}

export interface WorkbenchShellViewModel {
  title: string;
  activeSection: WorkbenchSectionId;
  sections: WorkbenchSectionViewModel[];
  planner: WorkbenchPlannerSummaryViewModel;
  projects: WorkbenchProjectSummaryViewModel[];
  activeProject: WorkbenchProjectSummaryViewModel | null;
  tasks: WorkbenchTaskSummaryViewModel[];
  today: WorkbenchTaskSummaryViewModel[];
  focus: WorkbenchTaskSummaryViewModel | null;
  review: WorkbenchReviewSummaryViewModel;
}
