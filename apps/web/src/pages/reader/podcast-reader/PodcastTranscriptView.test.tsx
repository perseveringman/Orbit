import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PodcastTranscriptView } from './PodcastTranscriptView';
import type { PodcastTranscriptSegment, PodcastHighlight } from '../../../data/use-podcast-reader';

// Mock scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

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
  it('renders completed transcript segments', () => {
    const onSeek = vi.fn();
    render(
      <PodcastTranscriptView
        status="completed"
        progress={100}
        segments={mockSegments}
        currentTime={0}
        onSeek={onSeek}
        highlights={mockHighlights}
      />
    );
    
    expect(screen.getByText('Hello and welcome to the show.')).toBeDefined();
    expect(screen.getByText('Today we will discuss TypeScript.')).toBeDefined();
  });

  it('shows processing state', () => {
    const onSeek = vi.fn();
    render(
      <PodcastTranscriptView
        status="processing"
        progress={50}
        segments={null}
        currentTime={0}
        onSeek={onSeek}
        highlights={[]}
      />
    );
    
    expect(screen.getByText(/processing/i)).toBeDefined();
  });

  it('shows empty state when no segments', () => {
    const onSeek = vi.fn();
    render(
      <PodcastTranscriptView
        status="completed"
        progress={100}
        segments={null}
        currentTime={0}
        onSeek={onSeek}
        highlights={[]}
      />
    );
    
    expect(screen.getByText(/no transcript/i)).toBeDefined();
  });
});
