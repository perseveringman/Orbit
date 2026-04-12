// ── Podcast Renderer ────────────────────────────────────────
import type { IsoDateTimeString } from '@orbit/domain';
import type { Transcript } from './transcription-layer.js';

// ── Podcast episode info ────────────────────────────────────

export interface PodcastEpisodeInfo {
  readonly title: string;
  readonly showName: string | null;
  readonly audioUrl: string;
  readonly duration: number | null;
  readonly publishedAt: IsoDateTimeString | null;
  readonly artworkUrl: string | null;
}

// ── Podcast reader state ────────────────────────────────────

export interface PodcastReaderState {
  readonly episode: PodcastEpisodeInfo;
  readonly transcript: Transcript | null;
  readonly playbackRate: number;
  readonly currentTime: number;
  readonly isPlaying: boolean;
  readonly speakerMap: Readonly<Record<string, string>>;
}

export function createPodcastReaderState(episode: PodcastEpisodeInfo): PodcastReaderState {
  return {
    episode,
    transcript: null,
    playbackRate: 1,
    currentTime: 0,
    isPlaying: false,
    speakerMap: {},
  };
}

export function updatePlaybackPosition(
  state: PodcastReaderState,
  timeSeconds: number,
): PodcastReaderState {
  return { ...state, currentTime: timeSeconds };
}

export function mapSpeaker(
  state: PodcastReaderState,
  speakerId: string,
  displayName: string,
): PodcastReaderState {
  return {
    ...state,
    speakerMap: { ...state.speakerMap, [speakerId]: displayName },
  };
}
