import {
  createWorkbenchShellViewModel,
  type ReaderArticleSummary,
  type SelectionMode,
  type WorkbenchShellViewModel,
  type WorkspaceSection
} from '@orbit/app-viewmodels';
import { createEditorDomModule, type EditorDomModule } from '@orbit/editor-dom';
import type { LocaleCode } from '@orbit/i18n';
import { createDomSlot, createDomThemeContract, type DomSlot, type DomThemeContract } from '@orbit/ui-dom';

export type WorkbenchDomHostKind = 'web' | 'desktop';

export interface WorkbenchDomHost {
  kind: WorkbenchDomHostKind;
  containerId: string;
  openExternal?: (url: string) => void;
}

export interface WorkbenchDomInput {
  host: WorkbenchDomHost;
  locale: LocaleCode;
  activeSection: WorkspaceSection;
  searchQuery: string;
  articles: ReaderArticleSummary[];
  draft: string;
  selectionMode?: SelectionMode;
}

export interface WorkbenchDomModule {
  host: WorkbenchDomHost;
  shell: WorkbenchShellViewModel;
  editor: EditorDomModule;
  theme: DomThemeContract;
  slots: {
    sidebar: DomSlot<{ activeSection: WorkspaceSection }>;
    list: DomSlot<{ empty: boolean; total: number }>;
    detail: DomSlot<{ activeArticleId: string | null }>;
  };
}

export interface MountedWorkbench extends WorkbenchDomModule {
  hostKind: WorkbenchDomHostKind;
  mountTarget: string;
  rerender: (patch: Partial<Omit<WorkbenchDomInput, 'host'>>) => MountedWorkbench;
}

export function createWorkbenchDomModule(input: WorkbenchDomInput): WorkbenchDomModule {
  const shell = createWorkbenchShellViewModel({
    locale: input.locale,
    activeSection: input.activeSection,
    searchQuery: input.searchQuery,
    articles: input.articles
  });
  const editor = createEditorDomModule({
    draft: input.draft,
    selectionMode: input.selectionMode ?? 'single'
  });
  const firstArticleId = shell.filteredArticles[0]?.id ?? null;

  return {
    host: input.host,
    shell,
    editor,
    theme: createDomThemeContract(),
    slots: {
      sidebar: createDomSlot('sidebar', { activeSection: input.activeSection }),
      list: createDomSlot('article-list', {
        empty: shell.filteredArticles.length === 0,
        total: shell.filteredArticles.length
      }),
      detail: createDomSlot('detail-panel', { activeArticleId: firstArticleId })
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
