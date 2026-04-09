import { createTranslator } from '@orbit/i18n';
import type {
  ReaderArticleSummary,
  WorkbenchArticleCardViewModel,
  WorkbenchShellInput,
  WorkbenchShellViewModel,
  WorkbenchSectionViewModel
} from './types';

function matchesSearch(article: ReaderArticleSummary, searchQuery: string): boolean {
  if (!searchQuery.trim()) {
    return true;
  }

  const normalized = searchQuery.trim().toLowerCase();
  return `${article.title} ${article.excerpt}`.toLowerCase().includes(normalized);
}

function toArticleCard(article: ReaderArticleSummary): WorkbenchArticleCardViewModel {
  return {
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    updatedAt: article.updatedAt,
    isRead: article.isRead,
    emphasis: article.isRead ? 'muted' : 'default'
  };
}

function createSections(
  activeSection: WorkbenchShellInput['activeSection'],
  unreadCount: number,
  totalCount: number,
  t: ReturnType<typeof createTranslator>['t']
): WorkbenchSectionViewModel[] {
  return [
    {
      id: 'inbox',
      label: t('workbench.section.inbox'),
      count: unreadCount,
      active: activeSection === 'inbox'
    },
    {
      id: 'library',
      label: t('workbench.section.library'),
      count: totalCount,
      active: activeSection === 'library'
    }
  ];
}

export function createWorkbenchShellViewModel(input: WorkbenchShellInput): WorkbenchShellViewModel {
  const translator = createTranslator(input.locale);
  const filteredArticles = input.articles.filter((article) => matchesSearch(article, input.searchQuery)).map(toArticleCard);
  const unreadCount = input.articles.filter((article) => !article.isRead).length;

  return {
    title: translator.t('workbench.title'),
    searchPlaceholder: translator.t('reader.search.placeholder'),
    activeSection: input.activeSection,
    sections: createSections(input.activeSection, unreadCount, input.articles.length, translator.t),
    filteredArticles,
    emptyState: translator.t('reader.empty')
  };
}
