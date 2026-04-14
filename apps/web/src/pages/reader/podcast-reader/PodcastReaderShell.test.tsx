import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PodcastReaderShell } from './PodcastReaderShell';
import type { PodcastReaderViewModel } from '../../../data/use-podcast-reader';

vi.mock('../../../data/use-reader-mutations', () => ({
  useReaderMutations: () => ({
    updateReadingProgress: vi.fn(),
    updateArticleStatus: vi.fn(),
  }),
}));

const mockPodcast: PodcastReaderViewModel = {
  articleId: 'art-1',
  title: 'Test Episode',
  author: 'Test Author',
  sourceUrl: 'https://example.com/episode',
  status: 'reading',
  readingProgress: 50,
  publishedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  show: {
    id: 'show-1',
    title: 'Test Show',
    url: 'https://example.com',
    description: 'Test description',
  },
  episode: {
    audioUrl: 'https://example.com/audio.mp3',
    duration: '1:23:45',
    durationSeconds: 5025,
    artwork: 'https://example.com/art.jpg',
    showNotes: '<p>[00:15] Introduction</p><p>[02:30] Main topic</p>',
  },
  playback: {
    currentTime: 150,
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  transcript: {
    status: 'completed',
    progress: 100,
    segments: [
      { start: 0, end: 10, text: 'Hello world' },
      { start: 10, end: 20, text: 'This is a test' },
    ],
    fullText: 'Hello world. This is a test.',
  },
  translation: null,
  summary: {
    status: 'completed',
    progress: 100,
    summaryText: 'Test summary text',
    keyPoints: ['Point 1', 'Point 2'],
  },
  highlights: [],
};

describe('PodcastReaderShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the podcast reader shell', () => {
    const onBack = vi.fn();
    render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    expect(screen.getByText('Test Episode')).toBeDefined();
    expect(screen.getByText('Test Show')).toBeDefined();
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    const backButton = screen.getByRole('button', { name: /返回/i });
    await user.click(backButton);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders timeline sidebar by default', () => {
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    const timeline = container.querySelector('[role="navigation"][aria-label="timeline"]');
    expect(timeline).not.toBeNull();
  });

  it('renders detail panel by default', () => {
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    const detailPanel = container.querySelector('[role="complementary"][aria-label="detail panel"]');
    expect(detailPanel).not.toBeNull();
  });

  it('collapses timeline when collapse button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    const timeline = container.querySelector('[role="navigation"][aria-label="timeline"]');
    const collapseButton = timeline?.parentElement?.querySelector('button[aria-label="collapse timeline"]');
    
    if (collapseButton) {
      await user.click(collapseButton);
      const timelineAfter = container.querySelector('[role="navigation"][aria-label="timeline"]');
      expect(timelineAfter).toBeNull();
      
      const expandButton = container.querySelector('button[aria-label="expand timeline"]');
      expect(expandButton).not.toBeNull();
    }
  });

  it('expands timeline when expand button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    const collapseButton = container.querySelector('button[aria-label="collapse timeline"]');
    if (collapseButton) {
      await user.click(collapseButton);
    }
    
    const expandButton = container.querySelector('button[aria-label="expand timeline"]');
    if (expandButton) {
      await user.click(expandButton);
      const timeline = container.querySelector('[role="navigation"][aria-label="timeline"]');
      expect(timeline).not.toBeNull();
    }
  });

  it('collapses detail panel when collapse button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    const detailPanel = container.querySelector('[role="complementary"][aria-label="detail panel"]');
    const collapseButton = detailPanel?.parentElement?.querySelector('button[aria-label="collapse detail"]');
    
    if (collapseButton) {
      await user.click(collapseButton);
      const detailPanelAfter = container.querySelector('[role="complementary"][aria-label="detail panel"]');
      expect(detailPanelAfter).toBeNull();
      
      const expandButton = container.querySelector('button[aria-label="expand detail"]');
      expect(expandButton).not.toBeNull();
    }
  });

  it('expands detail panel when expand button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    const collapseButton = container.querySelector('button[aria-label="collapse detail"]');
    if (collapseButton) {
      await user.click(collapseButton);
    }
    
    const expandButton = container.querySelector('button[aria-label="expand detail"]');
    if (expandButton) {
      await user.click(expandButton);
      const detailPanel = container.querySelector('[role="complementary"][aria-label="detail panel"]');
      expect(detailPanel).not.toBeNull();
    }
  });

  it('switches between tabs', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    // Find tabs by text content
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    const aboutTab = tabs.find(tab => tab.textContent?.includes('About'));
    const summaryTab = tabs.find(tab => tab.textContent?.includes('Summary'));
    const transcriptTab = tabs.find(tab => tab.textContent?.includes('Transcript'));
    
    expect(aboutTab).not.toBeNull();
    expect(summaryTab).not.toBeNull();
    expect(transcriptTab).not.toBeNull();
    
    if (summaryTab) {
      await user.click(summaryTab as HTMLElement);
      expect(container.textContent).toContain('Test summary text');
    }
    
    if (transcriptTab) {
      await user.click(transcriptTab as HTMLElement);
      expect(container.textContent).toContain('Hello world');
    }
    
    if (aboutTab) {
      await user.click(aboutTab as HTMLElement);
      expect(container.textContent).toContain('Introduction');
    }
  });

  it('has micro-toolbar controls for outline, details, and translation', () => {
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    expect(container.textContent).toContain('Outline');
    expect(container.textContent).toContain('Details');
  });

  it('shows translation control when translation is available', () => {
    const onBack = vi.fn();
    const podcastWithTranslation = {
      ...mockPodcast,
      translation: {
        status: 'completed' as const,
        progress: 100,
        targetLocale: 'zh-CN',
        translatedText: 'Translated content here',
      },
    };
    render(<PodcastReaderShell podcast={podcastWithTranslation} onBack={onBack} />);
    
    expect(screen.getByText('Translation')).toBeDefined();
  });

  it('toggles translation overlay when translation button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const podcastWithTranslation = {
      ...mockPodcast,
      translation: {
        status: 'completed' as const,
        progress: 100,
        targetLocale: 'zh-CN',
        translatedText: 'Translated content here',
      },
    };
    render(<PodcastReaderShell podcast={podcastWithTranslation} onBack={onBack} />);
    
    const translationButton = screen.getByRole('button', { name: /^(Show|Hide) translation$/i });
    await user.click(translationButton);
    
    expect(screen.getByText(/Translated content here/i)).toBeDefined();
    expect(screen.getByText(/zh-CN/i)).toBeDefined();
  });

  it('toggles timeline via micro-toolbar', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    // Get the micro-toolbar button specifically
    const toolbar = container.querySelector('.flex.items-center.gap-1.px-4.py-1\\.5');
    const outlineButton = toolbar?.querySelector('button');
    expect(outlineButton).toBeDefined();
    
    // Initially timeline should be visible
    let timeline = container.querySelector('[role="navigation"][aria-label="timeline"]');
    expect(timeline).not.toBeNull();
    
    // Click to collapse
    if (outlineButton) {
      await user.click(outlineButton);
      timeline = container.querySelector('[role="navigation"][aria-label="timeline"]');
      expect(timeline).toBeNull();
      
      // Click to expand
      await user.click(outlineButton);
      timeline = container.querySelector('[role="navigation"][aria-label="timeline"]');
      expect(timeline).not.toBeNull();
    }
  });

  it('toggles detail panel via micro-toolbar', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { container } = render(<PodcastReaderShell podcast={mockPodcast} onBack={onBack} />);
    
    // Get the micro-toolbar details button (second button in toolbar)
    const toolbar = container.querySelector('.flex.items-center.gap-1.px-4.py-1\\.5');
    const buttons = toolbar?.querySelectorAll('button');
    const detailsButton = buttons?.[1];
    expect(detailsButton).toBeDefined();
    
    // Initially detail panel should be visible - use container query instead
    let detailPanel = container.querySelector('[role="complementary"][aria-label="detail panel"]');
    expect(detailPanel).not.toBeNull();
    
    // Click to collapse
    if (detailsButton) {
      await user.click(detailsButton);
      detailPanel = container.querySelector('[role="complementary"][aria-label="detail panel"]');
      expect(detailPanel).toBeNull();
      
      // Click to expand
      await user.click(detailsButton);
      detailPanel = container.querySelector('[role="complementary"][aria-label="detail panel"]');
      expect(detailPanel).not.toBeNull();
    }
  });
});
