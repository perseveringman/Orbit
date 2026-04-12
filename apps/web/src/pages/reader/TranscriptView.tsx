import { useState, useEffect, useRef, type ReactElement } from 'react';
import { Input, Chip } from '@heroui/react';
import { Search } from 'lucide-react';
import type { TranscriptSegment, SpeakerInfo } from './mock-data';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
  speakers: SpeakerInfo[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function findSpeaker(speakerId: string, speakers: SpeakerInfo[]): SpeakerInfo | undefined {
  return speakers.find((s) => s.id === speakerId);
}

export function TranscriptView({ segments, currentTime, onSeek, speakers }: TranscriptViewProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = segments.findIndex(
    (seg) => currentTime >= seg.startTime && currentTime < seg.endTime,
  );

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

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
          const speaker = findSpeaker(seg.speaker, speakers);

          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={`flex gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                isActive ? 'bg-warning/15' : 'hover:bg-surface-secondary'
              }`}
              onClick={() => onSeek(seg.startTime)}
            >
              <span className="text-xs text-muted shrink-0 pt-0.5 font-mono w-10">
                {formatTime(seg.startTime)}
              </span>
              <div className="flex-1 min-w-0">
                {speaker && (
                  <Chip
                    size="sm"
                    variant="soft"
                    className="mb-1"
                    style={{ backgroundColor: `${speaker.color}20`, color: speaker.color }}
                  >
                    {speaker.label}
                  </Chip>
                )}
                <p className="text-sm text-foreground leading-relaxed">{seg.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
