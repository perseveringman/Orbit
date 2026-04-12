// ── Video Renderer ──────────────────────────────────────────
import type { Transcript, TranscriptSegment } from './transcription-layer.js';
import { getSegmentAtTime } from './transcription-layer.js';

// ── Video stream ────────────────────────────────────────────

export interface VideoStream {
  readonly url: string;
  readonly qualityLabel: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly hasAudio: boolean;
}

// ── Video reader state ──────────────────────────────────────

export interface VideoReaderState {
  readonly videoId: string;
  readonly streams: readonly VideoStream[];
  readonly selectedQuality: string;
  readonly transcript: Transcript | null;
  readonly currentTime: number;
  readonly duration: number;
  readonly playbackRate: number;
  readonly isPlaying: boolean;
}

export function createVideoReaderState(
  videoId: string,
  streams: readonly VideoStream[],
  duration: number,
): VideoReaderState {
  return {
    videoId,
    streams,
    selectedQuality: streams.length > 0 ? streams[0].qualityLabel : '',
    transcript: null,
    currentTime: 0,
    duration,
    playbackRate: 1,
    isPlaying: false,
  };
}

export function selectStream(
  state: VideoReaderState,
  qualityLabel: string,
): VideoReaderState {
  return { ...state, selectedQuality: qualityLabel };
}

export function syncVideoToTranscript(
  state: VideoReaderState,
  timeSeconds: number,
): { readonly state: VideoReaderState; readonly activeSegment: TranscriptSegment | undefined } {
  const updatedState: VideoReaderState = { ...state, currentTime: timeSeconds };
  const activeSegment = state.transcript
    ? getSegmentAtTime(state.transcript, timeSeconds)
    : undefined;
  return { state: updatedState, activeSegment };
}
