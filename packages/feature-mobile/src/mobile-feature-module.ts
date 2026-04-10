import {
  createWorkbenchShellViewModel,
  type WorkbenchShellInput,
  type WorkbenchShellViewModel
} from '@orbit/app-viewmodels';
import { createTranslator, type LocaleCode } from '@orbit/i18n';
import {
  createNativeScreenScaffold,
  createNativeThemeContract,
  type NativeScreenScaffold,
  type NativeThemeContract
} from '@orbit/ui-native';

export interface MobileHost {
  kind: 'ios';
  navigationStyle: 'stack' | 'split';
}

export interface MobileFocusScreen {
  kind: 'native-focus';
  focusTaskId: string | null;
  focusTitle: string | null;
  todayTaskIds: string[];
  reviewSummary: string;
  navigationStyle: MobileHost['navigationStyle'];
}

export interface MobileFeatureInput
  extends Pick<WorkbenchShellInput, 'locale' | 'activeSection' | 'currentDate' | 'userIntent' | 'projects' | 'tasks'> {
  host: MobileHost;
}

export interface MobileFeatureModule {
  host: MobileHost;
  hostKind: 'ios';
  shell: WorkbenchShellViewModel;
  theme: NativeThemeContract;
  tabs: Array<{
    id: 'home' | 'library';
    label: string;
  }>;
  screens: {
    home: NativeScreenScaffold & { projectCount: number; todayCount: number; focusTaskId: string | null };
    library: NativeScreenScaffold & { openTaskCount: number; reviewCount: number };
    focus: MobileFocusScreen;
  };
}

function getMetricValue(shell: WorkbenchShellViewModel, metricId: 'projects' | 'tasks'): number {
  return shell.planner.metrics.find((metric) => metric.id === metricId)?.value ?? 0;
}

function getReviewCount(shell: WorkbenchShellViewModel): number {
  return (
    shell.review.completedToday.length +
    shell.review.carryForward.length +
    shell.review.projectsNeedingReview.length +
    shell.review.tasksNeedingReview.length
  );
}

export function createMobileFeatureModule(input: MobileFeatureInput): MobileFeatureModule {
  const translator = createTranslator(input.locale as LocaleCode);
  const shell = createWorkbenchShellViewModel({
    locale: input.locale,
    activeSection: input.activeSection,
    currentDate: input.currentDate,
    userIntent: input.userIntent,
    projects: input.projects,
    tasks: input.tasks
  });

  return {
    host: input.host,
    hostKind: 'ios',
    shell,
    theme: createNativeThemeContract(),
    tabs: [
      {
        id: 'home',
        label: translator.t('mobile.tab.home')
      },
      {
        id: 'library',
        label: translator.t('mobile.tab.library')
      }
    ],
    screens: {
      home: {
        ...createNativeScreenScaffold(translator.t('mobile.tab.home'), shell.planner.summary),
        projectCount: getMetricValue(shell, 'projects'),
        todayCount: shell.today.length,
        focusTaskId: shell.focus?.id ?? null
      },
      library: {
        ...createNativeScreenScaffold(translator.t('mobile.tab.library'), shell.review.summary),
        openTaskCount: getMetricValue(shell, 'tasks'),
        reviewCount: getReviewCount(shell)
      },
      focus: {
        kind: 'native-focus',
        focusTaskId: shell.focus?.id ?? null,
        focusTitle: shell.focus?.title ?? null,
        todayTaskIds: shell.today.map((task) => task.id),
        reviewSummary: shell.review.summary,
        navigationStyle: input.host.navigationStyle
      }
    }
  };
}

export function mountMobileFeature(input: MobileFeatureInput): MobileFeatureModule {
  return createMobileFeatureModule(input);
}
