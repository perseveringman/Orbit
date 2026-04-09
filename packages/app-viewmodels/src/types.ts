import type { LocaleCode } from '@orbit/i18n';

export type WorkspaceSection = 'inbox' | 'library';
export type SelectionMode = 'single' | 'range';

export interface ReaderArticleSummary {
  id: string;
  title: string;
  excerpt: string;
  isRead: boolean;
  updatedAt: string;
}

export interface WorkbenchSectionViewModel {
  id: WorkspaceSection;
  label: string;
  count: number;
  active: boolean;
}

export interface WorkbenchArticleCardViewModel {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  isRead: boolean;
  emphasis: 'default' | 'muted';
}

export interface WorkbenchShellInput {
  locale: LocaleCode;
  activeSection: WorkspaceSection;
  searchQuery: string;
  articles: ReaderArticleSummary[];
}

export interface WorkbenchShellViewModel {
  title: string;
  searchPlaceholder: string;
  activeSection: WorkspaceSection;
  sections: WorkbenchSectionViewModel[];
  filteredArticles: WorkbenchArticleCardViewModel[];
  emptyState: string;
}
