import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { ReaderPage } from './ReaderPage';

const mockUseArticle = vi.fn();
const mockSaveArticleFromUrl = vi.fn();
const mockNavigate = vi.fn();
const mockSetContentType = vi.fn();

const podcastArticle = {
  id: 'art-podcast',
  contentItemId: 'ci-podcast',
  sourceEndpointId: 'ep-lex',
  title: 'Stored podcast article',
  sourceUrl: 'https://example.com/podcast',
  author: 'Host',
  mediaType: 'podcast',
  language: 'en',
  summary: null,
  status: 'reading' as const,
  readingProgress: 0.25,
  origin: 'feed_auto',
  publishedAt: '2024-01-01T00:00:00Z',
  fetchedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockRouterState = {
  currentRoute: null as { type: 'podcast'; id: string } | null,
  navigate: mockNavigate,
  contentType: 'all' as const,
  setContentType: mockSetContentType,
};

vi.mock('../../data/use-reader', () => ({
  useArticle: (id: string | null) => mockUseArticle(id),
}));

vi.mock('../../data/use-reader-mutations', () => ({
  useReaderMutations: () => ({
    saveArticleFromUrl: mockSaveArticleFromUrl,
  }),
}));

vi.mock('./ReaderView', () => ({
  ReaderView: () => <div data-testid="reader-view">reader view</div>,
}));

vi.mock('./PodcastPlayerView', () => ({
  PodcastPlayerView: (props: { articleId?: string; episode?: { id: string } }) => (
    <div data-testid="podcast-player">{props.articleId ?? props.episode?.id}</div>
  ),
}));

vi.mock('./VideoPlayerView', () => ({
  VideoPlayerView: () => <div data-testid="video-player">video view</div>,
}));

vi.mock('./BookReaderView', () => ({
  BookReaderView: () => <div data-testid="book-reader">book view</div>,
}));

vi.mock('./YouTubeVideoReaderView', () => ({
  YouTubeVideoReaderView: () => <div data-testid="youtube-player">youtube view</div>,
}));

vi.mock('./SubscriptionPanel', () => ({
  SubscriptionPanel: () => <div>subscription panel</div>,
}));

vi.mock('./ContentListPage', () => ({
  ContentListPage: (props: { onSelectItem: (type: 'article', id: string) => void }) => (
    <button type="button" onClick={() => props.onSelectItem('article', 'art-podcast')}>
      open stored article
    </button>
  ),
}));

vi.mock('./AddContentModal', () => ({
  AddContentModal: () => null,
}));

vi.mock('./ReaderRouter', () => ({
  ReaderRouter: (props: {
    children: (args: {
      currentRoute: { type: 'podcast'; id: string } | null;
      navigate: typeof mockNavigate;
      contentType: 'all';
      setContentType: typeof mockSetContentType;
    }) => ReactElement;
  }) =>
    props.children({
      currentRoute: mockRouterState.currentRoute,
      navigate: mockRouterState.navigate,
      contentType: mockRouterState.contentType,
      setContentType: mockRouterState.setContentType,
    }),
}));

describe('ReaderPage', () => {
  beforeEach(() => {
    mockUseArticle.mockReset();
    mockSaveArticleFromUrl.mockReset();
    mockNavigate.mockReset();
    mockSetContentType.mockReset();
    mockRouterState.currentRoute = null;

    mockUseArticle.mockImplementation((id: string | null) => {
      return id === 'art-podcast' ? podcastArticle : null;
    });
  });

  it('opens stored podcast articles in the podcast reader from library selection', async () => {
    const user = userEvent.setup();

    render(<ReaderPage />);
    await user.click(screen.getByRole('button', { name: /open stored article/i }));

    expect(screen.getByTestId('podcast-player')).toHaveTextContent('art-podcast');
    expect(screen.queryByTestId('reader-view')).not.toBeInTheDocument();
  });

  it('opens stored podcast routes in the podcast reader', () => {
    mockRouterState.currentRoute = { type: 'podcast', id: 'art-podcast' };

    render(<ReaderPage />);

    expect(screen.getByTestId('podcast-player')).toHaveTextContent('art-podcast');
    expect(screen.queryByTestId('reader-view')).not.toBeInTheDocument();
  });
});
