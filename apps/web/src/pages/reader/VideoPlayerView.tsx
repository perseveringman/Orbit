import { useState, useCallback, type ReactElement } from 'react';
import { Button, Chip, Tabs } from '@heroui/react';
import {
  ArrowLeft,
  Play,
  FileText,
  StickyNote,
  Link2,
} from 'lucide-react';
import type { VideoItem } from './mock-data';
import { MOCK_TRANSCRIPT, MOCK_SPEAKERS, MOCK_HIGHLIGHTS } from './mock-data';
import { TranscriptView } from './TranscriptView';
import { ReaderContextPanel } from './ReaderContextPanel';
import { ReadingExitBar } from './ReadingExitBar';

interface VideoPlayerViewProps {
  video: VideoItem;
  onBack: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function VideoPlayerView({ video, onBack }: VideoPlayerViewProps): ReactElement {
  const [currentTime, setCurrentTime] = useState(0);

  const formattedDate = new Date(video.publishedAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const highlights = MOCK_HIGHLIGHTS.filter((h) => h.articleId === video.id);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
        <Button variant="ghost" size="sm" onPress={onBack}>
          <ArrowLeft size={16} /> 返回
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{video.title}</h1>
        </div>
        <Chip size="sm" variant="soft">{video.channelName}</Chip>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video embed placeholder */}
          <div className="relative aspect-video bg-black flex items-center justify-center shrink-0">
            <div className="flex flex-col items-center gap-2 text-white/60">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                <Play size={32} className="ml-1" />
              </div>
              <span className="text-sm">{formatDuration(video.duration)}</span>
            </div>
          </div>

          {/* Video info */}
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground mb-1">{video.title}</h2>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>{video.channelName}</span>
              <span>·</span>
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Tabs below video */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs>
              <Tabs.List>
                <Tabs.Tab id="transcript">
                  <FileText size={14} className="inline" /> 转写
                </Tabs.Tab>
                <Tabs.Tab id="notes">
                  <StickyNote size={14} className="inline" /> 笔记
                </Tabs.Tab>
                <Tabs.Tab id="related">
                  <Link2 size={14} className="inline" /> 相关
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel id="transcript" className="flex-1 overflow-hidden">
                <TranscriptView
                  segments={MOCK_TRANSCRIPT}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  speakers={MOCK_SPEAKERS}
                />
              </Tabs.Panel>
              <Tabs.Panel id="notes" className="flex-1 overflow-y-auto p-4">
                {highlights.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-sm text-muted">
                    <StickyNote size={24} className="mb-2 opacity-50" />
                    暂无笔记
                  </div>
                ) : (
                  <div className="space-y-3">
                    {highlights.map((hl) => (
                      <div key={hl.id} className="text-sm">
                        <div className="border-l-3 pl-2 py-1" style={{ borderColor: hl.color }}>
                          <p className="text-foreground">{hl.text}</p>
                        </div>
                        {hl.note && (
                          <p className="text-muted mt-1 text-xs pl-3">💬 {hl.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Tabs.Panel>
              <Tabs.Panel id="related" className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2 text-sm text-muted">
                  <p>暂无相关内容</p>
                </div>
              </Tabs.Panel>
            </Tabs>
          </div>
        </div>

        {/* Right context panel */}
        <aside className="w-72 border-l border-border bg-surface shrink-0 overflow-hidden">
          <ReaderContextPanel articleId={video.id} />
        </aside>
      </div>

      {/* Bottom exit bar */}
      <ReadingExitBar />
    </div>
  );
}
