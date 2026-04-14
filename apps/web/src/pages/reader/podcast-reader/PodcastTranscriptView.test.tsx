import { describe, it, expect, vi } from 'vitest';
import { PodcastTranscriptView } from './PodcastTranscriptView';
import type { PodcastTranscriptSegment, PodcastHighlight } from '../../../data/use-podcast-reader';

const mockSegments: PodcastTranscriptSegment[] = [
  { start: 0, end: 10, text: 'Hello and welcome to the show.' },
  { start: 10, end: 25, text: 'Today we will discuss TypeScript.' },
  { start: 25, end: 40, text: 'TypeScript is a typed superset of JavaScript.' },
];

const mockHighlights: PodcastHighlight[] = [
  {
    id: 'hl-1',
    quoteText: 'TypeScript is a typed superset of JavaScript.',
    timestampSeconds: 25,
    color: '#fbbf24',
    note: 'Important definition',
  },
];

describe('PodcastTranscriptView', () => {
  it('exports a valid component', () => {
    expect(PodcastTranscriptView).toBeDefined();
    expect(typeof PodcastTranscriptView).toBe('function');
  });

  it('accepts required props without crashing', () => {
    const onSeek = vi.fn();
    expect(() => {
      PodcastTranscriptView({
        status: 'completed',
        progress: 100,
        segments: mockSegments,
        currentTime: 0,
        onSeek,
        highlights: mockHighlights,
      });
    }).not.toThrow();
  });
});
