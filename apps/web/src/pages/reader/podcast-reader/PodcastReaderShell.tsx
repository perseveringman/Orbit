import { useState, type ReactElement } from 'react';
import { Button, Chip, Tabs } from '@heroui/react';
import { ArrowLeft, ChevronLeft, ChevronRight, SidebarOpen, PanelRightOpen, Languages } from 'lucide-react';
import type { PodcastReaderViewModel } from '../../../data/use-podcast-reader';
import { useReaderMutations } from '../../../data/use-reader-mutations';
import { PodcastTimelineSidebar } from './PodcastTimelineSidebar';
import { PodcastAudioPlayer } from './PodcastAudioPlayer';
import { PodcastAboutTab } from './PodcastAboutTab';
import { PodcastSummaryTab } from './PodcastSummaryTab';
import { PodcastTranscriptTab } from './PodcastTranscriptTab';
import { PodcastDetailPanel } from './PodcastDetailPanel';
import { ReadingExitBar } from '../ReadingExitBar';
import {
  annotatePodcastTimestampLines,
  extractPodcastTimestampOutlineFromAnnotatedHtml,
} from './podcast-timestamps';

interface PodcastReaderShellProps {
  podcast: PodcastReaderViewModel;
  onBack: () => void;
}

export function PodcastReaderShell({ podcast, onBack }: PodcastReaderShellProps): ReactElement {
  const [currentTime, setCurrentTime] = useState(podcast.playback.currentTime);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [translationVisible, setTranslationVisible] = useState(false);

  const mutations = useReaderMutations();

  // Extract outline from show notes
  const outlineItems =
    podcast.episode?.showNotes
      ? extractPodcastTimestampOutlineFromAnnotatedHtml(
          annotatePodcastTimestampLines(podcast.episode.showNotes)
        )
      : [];

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
  };

  const handleTimeUpdate = (seconds: number) => {
    setCurrentTime(seconds);

    // Persist playback position (0-1 fraction as expected by updateReadingProgress)
    const progress = podcast.episode?.durationSeconds
      ? seconds / podcast.episode.durationSeconds
      : 0;
    mutations.updateReadingProgress(podcast.articleId, progress, { currentTime: seconds });
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
  };

  const handleHighlightClick = (highlight: PodcastReaderViewModel['highlights'][number]) => {
    if (highlight.timestampSeconds !== null) {
      handleSeek(highlight.timestampSeconds);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
        <Button variant="ghost" size="sm" onPress={onBack} aria-label="返回">
          <ArrowLeft size={16} /> 返回
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{podcast.title}</h1>
        </div>
        {podcast.show && (
          <Chip size="sm" variant="soft">
            {podcast.show.title}
          </Chip>
        )}
      </div>

      {/* Micro-toolbar controls */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-surface">
        <Button
          variant="ghost"
          size="sm"
          onPress={() => setTimelineCollapsed(!timelineCollapsed)}
          aria-label={timelineCollapsed ? 'Show timeline' : 'Hide timeline'}
          className="h-7 px-2 text-xs"
        >
          <SidebarOpen size={14} />
          <span className="ml-1">Outline</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => setDetailCollapsed(!detailCollapsed)}
          aria-label={detailCollapsed ? 'Show details' : 'Hide details'}
          className="h-7 px-2 text-xs"
        >
          <PanelRightOpen size={14} />
          <span className="ml-1">Details</span>
        </Button>
        {podcast.translation && (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setTranslationVisible(!translationVisible)}
            aria-label={translationVisible ? 'Hide translation' : 'Show translation'}
            className={`h-7 px-2 text-xs ${translationVisible ? 'bg-primary-100 dark:bg-primary-900/30' : ''}`}
          >
            <Languages size={14} />
            <span className="ml-1">Translation</span>
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left timeline sidebar */}
        {!timelineCollapsed && (
          <aside
            role="navigation"
            aria-label="timeline"
            className="w-64 border-r border-border bg-surface shrink-0 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <h2 className="text-xs font-semibold text-foreground uppercase">Timeline</h2>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setTimelineCollapsed(true)}
                aria-label="collapse timeline"
              >
                <ChevronLeft size={14} />
              </Button>
            </div>
            <PodcastTimelineSidebar
              items={outlineItems}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
          </aside>
        )}

        {timelineCollapsed && (
          <div className="flex items-center border-r border-border bg-surface">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setTimelineCollapsed(false)}
              aria-label="expand timeline"
              className="h-full rounded-none"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Audio player */}
          <PodcastAudioPlayer
            audioUrl={podcast.episode?.audioUrl ?? null}
            currentTime={currentTime}
            duration={podcast.episode?.durationSeconds ?? 0}
            onTimeUpdate={handleTimeUpdate}
            onRateChange={handleRateChange}
          />

          {/* Tabs */}
          <Tabs className="flex-1 flex flex-col overflow-hidden">
            <Tabs.List className="px-4 py-2 border-b border-border shrink-0">
              <Tabs.Tab id="about">About</Tabs.Tab>
              <Tabs.Tab id="summary">Summary</Tabs.Tab>
              <Tabs.Tab id="transcript">Transcript</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel id="about">
              <div className="flex-1 overflow-hidden relative">
                <PodcastAboutTab showNotes={podcast.episode?.showNotes ?? null} onSeek={handleSeek} />
                {translationVisible && podcast.translation?.translatedText && (
                  <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="max-w-3xl mx-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground">
                          Translation ({podcast.translation.targetLocale})
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => setTranslationVisible(false)}
                          aria-label="Close translation"
                        >
                          <ChevronLeft size={14} />
                        </Button>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="whitespace-pre-wrap">{podcast.translation.translatedText}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Tabs.Panel>

            <Tabs.Panel id="summary">
              <div className="flex-1 overflow-hidden relative">
                <PodcastSummaryTab
                  status={podcast.summary.status}
                  progress={podcast.summary.progress}
                  summaryText={podcast.summary.summaryText}
                  keyPoints={podcast.summary.keyPoints}
                />
                {translationVisible && podcast.translation?.translatedText && (
                  <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="max-w-3xl mx-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground">
                          Translation ({podcast.translation.targetLocale})
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => setTranslationVisible(false)}
                          aria-label="Close translation"
                        >
                          <ChevronLeft size={14} />
                        </Button>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="whitespace-pre-wrap">{podcast.translation.translatedText}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Tabs.Panel>

            <Tabs.Panel id="transcript">
              <div className="flex-1 overflow-hidden relative">
                <PodcastTranscriptTab
                  status={podcast.transcript.status}
                  progress={podcast.transcript.progress}
                  segments={podcast.transcript.segments}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  highlights={podcast.highlights}
                />
                {translationVisible && podcast.translation?.translatedText && (
                  <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="max-w-3xl mx-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground">
                          Translation ({podcast.translation.targetLocale})
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => setTranslationVisible(false)}
                          aria-label="Close translation"
                        >
                          <ChevronLeft size={14} />
                        </Button>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="whitespace-pre-wrap">{podcast.translation.translatedText}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Tabs.Panel>
          </Tabs>
        </div>

        {/* Right detail panel */}
        {!detailCollapsed && (
          <aside
            role="complementary"
            aria-label="detail panel"
            className="w-72 border-l border-border bg-surface shrink-0 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <h2 className="text-xs font-semibold text-foreground uppercase">Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setDetailCollapsed(true)}
                aria-label="collapse detail"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
            <PodcastDetailPanel
              highlights={podcast.highlights}
              onHighlightClick={handleHighlightClick}
              showInfo={
                podcast.show
                  ? {
                      title: podcast.show.title,
                      description: podcast.show.description,
                    }
                  : undefined
              }
            />
          </aside>
        )}

        {detailCollapsed && (
          <div className="flex items-center border-l border-border bg-surface">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setDetailCollapsed(false)}
              aria-label="expand detail"
              className="h-full rounded-none"
            >
              <ChevronLeft size={14} />
            </Button>
          </div>
        )}
      </div>

      {/* Bottom exit bar */}
      <ReadingExitBar />
    </div>
  );
}
