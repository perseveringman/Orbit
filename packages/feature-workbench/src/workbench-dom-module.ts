import {
  createWorkbenchShellViewModel,
  type SelectionMode,
  type WorkbenchShellInput,
  type WorkbenchShellViewModel,
  type WorkspaceSection
} from '@orbit/app-viewmodels';
import { createEditorDomModule, type EditorDomModule } from '@orbit/editor-dom';
import { createDomSlot, createDomThemeContract, type DomSlot, type DomThemeContract } from '@orbit/ui-dom';

export type WorkbenchDomHostKind = 'web' | 'desktop';

export interface WorkbenchDomHost {
  kind: WorkbenchDomHostKind;
  containerId: string;
  openExternal?: (url: string) => void;
}

export interface WorkbenchPlannerSlotProps extends Record<string, unknown> {
  activeSection: WorkspaceSection;
  currentDate: string;
  intent: string;
  summary: string;
}

export interface WorkbenchWorkspaceSlotProps extends Record<string, unknown> {
  projectCount: number;
  taskCount: number;
  todayCount: number;
  focusTaskId: string | null;
}

export interface WorkbenchReviewSlotProps extends Record<string, unknown> {
  reviewItemCount: number;
  completedTodayCount: number;
  carryForwardCount: number;
  pendingReviewCount: number;
}

export interface WorkbenchDomInput
  extends Pick<WorkbenchShellInput, 'locale' | 'activeSection' | 'currentDate' | 'userIntent' | 'projects' | 'tasks'> {
  host: WorkbenchDomHost;
  draft: string;
  selectionMode?: SelectionMode;
}

export interface WorkbenchDomModule {
  host: WorkbenchDomHost;
  shell: WorkbenchShellViewModel;
  editor: EditorDomModule;
  theme: DomThemeContract;
  slots: {
    planner: DomSlot<WorkbenchPlannerSlotProps>;
    workspace: DomSlot<WorkbenchWorkspaceSlotProps>;
    review: DomSlot<WorkbenchReviewSlotProps>;
  };
}

export interface MountedWorkbench extends WorkbenchDomModule {
  hostKind: WorkbenchDomHostKind;
  mountTarget: string;
  rerender: (patch: Partial<Omit<WorkbenchDomInput, 'host'>>) => MountedWorkbench;
}

function getPendingReviewCount(shell: WorkbenchShellViewModel): number {
  return shell.review.projectsNeedingReview.length + shell.review.tasksNeedingReview.length;
}

function getReviewItemCount(shell: WorkbenchShellViewModel): number {
  return shell.review.completedToday.length + shell.review.carryForward.length + getPendingReviewCount(shell);
}

export function createWorkbenchDomModule(input: WorkbenchDomInput): WorkbenchDomModule {
  const shell = createWorkbenchShellViewModel({
    locale: input.locale,
    activeSection: input.activeSection,
    currentDate: input.currentDate,
    userIntent: input.userIntent,
    projects: input.projects,
    tasks: input.tasks
  });
  const editor = createEditorDomModule({
    draft: input.draft,
    selectionMode: input.selectionMode ?? 'single'
  });
  const pendingReviewCount = getPendingReviewCount(shell);
  const reviewItemCount = getReviewItemCount(shell);

  return {
    host: input.host,
    shell,
    editor,
    theme: createDomThemeContract(),
    slots: {
      planner: createDomSlot('planner-sidebar', {
        activeSection: input.activeSection,
        currentDate: shell.planner.currentDate,
        intent: shell.planner.intent,
        summary: shell.planner.summary
      }),
      workspace: createDomSlot('workspace-main', {
        projectCount: shell.projects.length,
        taskCount: shell.tasks.length,
        todayCount: shell.today.length,
        focusTaskId: shell.focus?.id ?? null
      }),
      review: createDomSlot('review-panel', {
        reviewItemCount,
        completedTodayCount: shell.review.completedToday.length,
        carryForwardCount: shell.review.carryForward.length,
        pendingReviewCount
      })
    }
  };
}

export function mountWorkbench(input: WorkbenchDomInput): MountedWorkbench {
  const module = createWorkbenchDomModule(input);

  return {
    ...module,
    hostKind: input.host.kind,
    mountTarget: input.host.containerId,
    rerender(patch) {
      return mountWorkbench({
        ...input,
        ...patch,
        host: input.host
      });
    }
  };
}
