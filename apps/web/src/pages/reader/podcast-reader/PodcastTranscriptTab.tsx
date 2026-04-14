import type { ReactElement } from 'react';
import { PodcastTranscriptView } from './PodcastTranscriptView';
import type {
  PodcastTranscriptSegment,
  PodcastHighlight,
} from '../../../data/use-podcast-reader';

interface PodcastTranscriptTabProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  segments: PodcastTranscriptSegment[] | null;
  currentTime: number;
  onSeek: (time: number) => void;
  highlights: PodcastHighlight[];
}

export function PodcastTranscriptTab({
  status,
  progress,
  segments,
  currentTime,
  onSeek,
  highlights,
}: PodcastTranscriptTabProps): ReactElement {
  return (
    <PodcastTranscriptView
      status={status}
      progress={progress}
      segments={segments}
      currentTime={currentTime}
      onSeek={onSeek}
      highlights={highlights}
    />
  );
}
