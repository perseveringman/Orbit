import { useState, useCallback, type ReactElement } from 'react';
import { Button, Chip, ProgressBar } from '@heroui/react';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
} from 'lucide-react';
import type { PodcastEpisode } from './mock-data';
import { MOCK_TRANSCRIPT, MOCK_SPEAKERS } from './mock-data';
import { TranscriptView } from './TranscriptView';
import { ReaderContextPanel } from './ReaderContextPanel';
import { ReadingExitBar } from './ReadingExitBar';

interface PodcastPlayerViewProps {
  episode: PodcastEpisode;
  onBack: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PodcastPlayerView({ episode, onBack }: PodcastPlayerViewProps): ReactElement {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const progress = episode.duration > 0 ? (currentTime / episode.duration) * 100 : 0;

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackSpeed as (typeof SPEED_OPTIONS)[number]);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % SPEED_OPTIONS.length;
    setPlaybackSpeed(SPEED_OPTIONS[nextIdx]);
  };

  const skip = (delta: number) => {
    setCurrentTime((prev) => Math.max(0, Math.min(episode.duration, prev + delta)));
  };

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(e.target.value));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
        <Button variant="ghost" size="sm" onPress={onBack}>
          <ArrowLeft size={16} /> 返回
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{episode.title}</h1>
        </div>
        <Chip size="sm" variant="soft">{episode.podcastName}</Chip>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Player section */}
          <div className="px-6 py-4 border-b border-border bg-surface-secondary">
            {/* Progress slider */}
            <input
              type="range"
              min={0}
              max={episode.duration}
              value={currentTime}
              onChange={handleSliderChange}
              className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
            />
            <div className="flex items-center justify-between text-xs text-muted mt-1 mb-3">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(episode.duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <Button variant="ghost" size="sm" onPress={() => skip(-15)}>
                <SkipBack size={16} />
                <span className="text-xs">15s</span>
              </Button>
              <Button
                variant="primary"
                size="md"
                onPress={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </Button>
              <Button variant="ghost" size="sm" onPress={() => skip(15)}>
                <span className="text-xs">15s</span>
                <SkipForward size={16} />
              </Button>
              <Button variant="ghost" size="sm" onPress={cycleSpeed}>
                <Gauge size={14} />
                <span className="text-xs font-mono">{playbackSpeed}x</span>
              </Button>
            </div>

            {/* Mini progress bar */}
            <ProgressBar aria-label="播放进度" value={progress} size="sm" color="accent" className="mt-3">
              <ProgressBar.Track className="h-0.5 rounded-full">
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>

          {/* Transcript panel */}
          <div className="flex-1 overflow-hidden">
            <TranscriptView
              segments={MOCK_TRANSCRIPT}
              currentTime={currentTime}
              onSeek={handleSeek}
              speakers={MOCK_SPEAKERS}
            />
          </div>
        </div>

        {/* Right context panel */}
        <aside className="w-72 border-l border-border bg-surface shrink-0 overflow-hidden">
          <ReaderContextPanel articleId={episode.id} />
        </aside>
      </div>

      {/* Bottom exit bar */}
      <ReadingExitBar />
    </div>
  );
}
