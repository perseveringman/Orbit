import { useState, type ReactElement } from 'react';
import type { PodcastEpisode } from './mock-data';
import { PodcastReaderShell } from './podcast-reader/PodcastReaderShell';
import { usePodcastReader } from '../../data/use-podcast-reader';
import type { PodcastReaderViewModel } from '../../data/use-podcast-reader';

interface PodcastPlayerViewProps {
  episode: PodcastEpisode;
  onBack: () => void;
}

/**
 * Temporary compatibility shim for PodcastPlayerView.
 * This component bridges the old mock-based PodcastEpisode interface
 * to the new PodcastReaderViewModel from usePodcastReader.
 * 
 * In Task 4, this will be removed in favor of direct PodcastReaderShell usage.
 */
export function PodcastPlayerView({ episode, onBack }: PodcastPlayerViewProps): ReactElement {
  // Try to use the real data adapter if we have an article ID
  const { podcast, loading } = usePodcastReader(episode.id, undefined);

  // If we have real podcast data from the database, use the new shell
  if (podcast && !loading) {
    return <PodcastReaderShell podcast={podcast} onBack={onBack} />;
  }

  // Otherwise, create a mock view model from the episode data
  const mockPodcast: PodcastReaderViewModel = {
    articleId: episode.id,
    title: episode.title,
    author: null,
    sourceUrl: episode.url ?? null,
    status: 'reading',
    readingProgress: 0,
    publishedAt: episode.publishedAt ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    show: {
      id: 'mock-show',
      title: episode.podcastName,
      url: null,
      description: null,
    },
    episode: {
      audioUrl: episode.audioUrl,
      duration: episode.duration.toString(),
      durationSeconds: episode.duration,
      artwork: episode.coverUrl ?? null,
      showNotes: episode.description ?? null,
    },
    playback: {
      currentTime: 0,
      lastUpdated: null,
    },
    transcript: {
      status: 'pending',
      progress: 0,
      segments: null,
      fullText: null,
    },
    translation: null,
    summary: {
      status: 'pending',
      progress: 0,
      summaryText: null,
      keyPoints: null,
    },
    highlights: [],
  };

  return <PodcastReaderShell podcast={mockPodcast} onBack={onBack} />;
}
