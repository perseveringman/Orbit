import { describe, it, expect, vi } from 'vitest';
import { PodcastReaderShell } from './PodcastReaderShell';
import type { PodcastReaderViewModel } from '../../../data/use-podcast-reader';

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
  it('exports a valid component', () => {
    expect(PodcastReaderShell).toBeDefined();
    expect(typeof PodcastReaderShell).toBe('function');
  });

  it('accepts required props without crashing', () => {
    const onBack = vi.fn();
    expect(() => {
      PodcastReaderShell({ podcast: mockPodcast, onBack });
    }).not.toThrow();
  });
});
