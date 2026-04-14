import { useState, useEffect, useRef, type ReactElement } from 'react';
import { Button, ProgressBar } from '@heroui/react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';

interface PodcastAudioPlayerProps {
  audioUrl: string | null;
  currentTime: number;
  duration: number;
  onTimeUpdate: (time: number) => void;
  onRateChange: (rate: number) => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PodcastAudioPlayer({
  audioUrl,
  currentTime,
  duration,
  onTimeUpdate,
  onRateChange,
}: PodcastAudioPlayerProps): ReactElement {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.currentTime = currentTime;
    audio.playbackRate = playbackRate;

    const handleTimeUpdate = () => {
      onTimeUpdate(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const skip = (delta: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    onTimeUpdate(newTime);
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate as (typeof SPEED_OPTIONS)[number]);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % SPEED_OPTIONS.length;
    const newRate = SPEED_OPTIONS[nextIdx];
    setPlaybackRate(newRate);
    onRateChange(newRate);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTimeUpdate(Number(e.target.value));
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="px-6 py-4 border-b border-border bg-surface-secondary">
      {/* Progress slider */}
      <input
        type="range"
        min={0}
        max={duration}
        value={currentTime}
        onChange={handleSliderChange}
        aria-label="progress"
        className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
      />
      <div className="flex items-center justify-between text-xs text-muted mt-1 mb-3">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onPress={() => skip(-15)}
          aria-label="skip back 15 seconds"
        >
          <SkipBack size={16} />
          <span className="text-xs">15s</span>
        </Button>
        <Button
          variant="primary"
          size="md"
          onPress={togglePlayPause}
          aria-label={isPlaying ? 'pause' : 'play'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => skip(15)}
          aria-label="skip forward 15 seconds"
        >
          <span className="text-xs">15s</span>
          <SkipForward size={16} />
        </Button>
        <Button variant="ghost" size="sm" onPress={cycleSpeed} aria-label={`${playbackRate}x`}>
          <Gauge size={14} />
          <span className="text-xs font-mono">{playbackRate}x</span>
        </Button>
      </div>

      {/* Mini progress bar */}
      <ProgressBar aria-label="播放进度" value={progress} size="sm" color="accent" className="mt-3">
        <ProgressBar.Track className="h-0.5 rounded-full">
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  );
}
