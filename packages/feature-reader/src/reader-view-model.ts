// ── Unified Reader UI Model ────────────────────────────────
import type { Article, Highlight, Note, IsoDateTimeString } from '@orbit/domain';

// ── Reader scroll state ────────────────────────────────────

export interface ReaderScrollState {
  readonly scrollPercentage: number;
  readonly currentParagraphIndex: number;
  readonly lastUpdated: IsoDateTimeString;
}

// ── Translation overlay ────────────────────────────────────

export interface TranslationOverlay {
  readonly enabled: boolean;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly paragraphs: readonly TranslatedParagraph[];
}

export interface TranslatedParagraph {
  readonly index: number;
  readonly originalText: string;
  readonly translatedText: string;
}

// ── Context sidebar ────────────────────────────────────────

export interface ContextSidebarItem {
  readonly kind: 'highlight' | 'note' | 'related_article' | 'definition';
  readonly id: string;
  readonly title: string;
  readonly preview: string;
}

// ── Reader layout ──────────────────────────────────────────

export interface ReaderLayout {
  readonly title: string;
  readonly source: string | null;
  readonly mainContent: string;
  readonly translationLayer: TranslationOverlay | null;
  readonly highlightLayer: readonly Highlight[];
  readonly contextSidebar: readonly ContextSidebarItem[];
}

// ── Reader view model ──────────────────────────────────────

export interface ReaderViewModel {
  readonly article: Article;
  readonly contentBody: string;
  readonly highlights: readonly Highlight[];
  readonly notes: readonly Note[];
  readonly translationOverlay: TranslationOverlay | null;
  readonly contextSidebar: readonly ContextSidebarItem[];
  readonly scrollState: ReaderScrollState;
  readonly layout: ReaderLayout;
}

export function createReaderViewModel(
  article: Article,
  contentBody: string,
  highlights: readonly Highlight[],
  notes: readonly Note[],
): ReaderViewModel {
  const scrollState: ReaderScrollState = {
    scrollPercentage: article.readingProgress ?? 0,
    currentParagraphIndex: 0,
    lastUpdated: article.updatedAt,
  };

  const sidebarItems: ContextSidebarItem[] = [
    ...highlights.map((h) => ({
      kind: 'highlight' as const,
      id: h.id,
      title: h.quoteText.slice(0, 50),
      preview: h.quoteText,
    })),
    ...notes.map((n) => ({
      kind: 'note' as const,
      id: n.id,
      title: n.title,
      preview: n.title,
    })),
  ];

  const layout: ReaderLayout = {
    title: article.title,
    source: article.sourceUrl,
    mainContent: contentBody,
    translationLayer: null,
    highlightLayer: highlights,
    contextSidebar: sidebarItems,
  };

  return {
    article,
    contentBody,
    highlights,
    notes,
    translationOverlay: null,
    contextSidebar: sidebarItems,
    scrollState,
    layout,
  };
}

export function updateReadingProgress(
  vm: ReaderViewModel,
  scrollPercentage: number,
  paragraphIndex: number,
): ReaderViewModel {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    ...vm,
    scrollState: {
      scrollPercentage,
      currentParagraphIndex: paragraphIndex,
      lastUpdated: now,
    },
  };
}
