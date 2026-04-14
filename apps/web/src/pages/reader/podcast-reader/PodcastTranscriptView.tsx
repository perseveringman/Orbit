import { useState, useEffect, useRef, type ReactElement } from 'react';
import { Input, ProgressBar, Chip } from '@heroui/react';
import { Search, AlertCircle } from 'lucide-react';
import type {
  PodcastTranscriptSegment,
  PodcastHighlight,
} from '../../../data/use-podcast-reader';

interface PodcastTranscriptViewProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  segments: PodcastTranscriptSegment[] | null;
  currentTime: number;
  onSeek: (time: number) => void;
  highlights: PodcastHighlight[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function findHighlightForSegment(
  segment: PodcastTranscriptSegment,
  highlights: PodcastHighlight[]
): PodcastHighlight | null {
  return highlights.find((hl) => {
    if (!hl.timestampSeconds) return false;
    return hl.timestampSeconds >= segment.start && hl.timestampSeconds < segment.end;
  }) || null;
}

export function PodcastTranscriptView({
  status,
  progress,
  segments,
  currentTime,
  onSeek,
  highlights,
}: PodcastTranscriptViewProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = segments
    ? segments.findIndex((seg) => currentTime >= seg.start && currentTime < seg.end)
    : -1;

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  if (status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-sm text-muted text-center">Transcript not started</p>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
        <p className="text-sm text-muted text-center">Processing transcript...</p>
        <ProgressBar
          aria-label="Transcript processing progress"
          value={progress}
          size="md"
          color="accent"
          className="w-64"
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        <p className="text-xs text-muted">{progress}%</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-2">
        <AlertCircle size={32} className="text-danger opacity-50" />
        <p className="text-sm text-danger text-center">Transcript generation failed</p>
      </div>
    );
  }

  if (!segments || segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-sm text-muted text-center">No transcript available</p>
      </div>
    );
  }

  const filtered = searchQuery.trim()
    ? segments.filter((seg) => seg.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments;

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-muted shrink-0" />
          <Input
            placeholder="搜索转写内容…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Segments */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-1">
        {filtered.length === 0 && (
          <p className="text-sm text-muted text-center py-8">无匹配内容</p>
        )}
        {filtered.map((seg, i) => {
          const realIndex = segments.indexOf(seg);
          const isActive = realIndex === activeIndex;
          const highlight = findHighlightForSegment(seg, highlights);

          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={`
                flex gap-2 p-2 rounded-lg cursor-pointer transition-colors relative
                ${isActive ? 'bg-warning/15' : 'hover:bg-surface-secondary'}
              `}
              onClick={() => onSeek(seg.start)}
            >
              <span className="text-xs text-muted shrink-0 pt-0.5 font-mono w-10">
                {formatTime(seg.start)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-relaxed">{seg.text}</p>
                {highlight && (
                  <div className="mt-1">
                    <Chip
                      size="sm"
                      variant="soft"
                      style={{ backgroundColor: `${highlight.color ?? '#fbbf24'}20` }}
                    >
                      <span className="text-xs">🔖 highlight</span>
                    </Chip>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
