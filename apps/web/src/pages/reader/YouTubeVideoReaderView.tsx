import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Button, Card, Chip, ProgressBar, Tabs } from '@heroui/react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Captions,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MessageSquareText,
  StickyNote,
} from 'lucide-react';
import {
  extractYouTubeVideoId,
  fetchYouTubeTranscript,
  fetchYouTubeVideoDetails,
  fetchYouTubeVideoMeta,
  type YouTubeComment,
  type YouTubeTranscript,
  type YouTubeTranscriptSegment,
  type YouTubeVideoDetails,
  type YouTubeVideoMeta,
} from '@orbit/reader-resolvers';
import type { ReaderArticle } from '../../data/use-reader';
import { useHighlightsForArticle } from '../../data/use-reader';
import { useReaderMutations } from '../../data/use-reader-mutations';
import { readerFetchOptions } from '../../data/proxied-fetch';
import { HighlightFloatingMenu } from './HighlightFloatingMenu';
import { ReadingExitBar } from './ReadingExitBar';
import type { TranscriptSegment } from './mock-data';
import { TranscriptView } from './TranscriptView';

interface YouTubeVideoReaderViewProps {
  article: ReaderArticle;
  onBack: () => void;
}

interface YouTubePlayerHandle {
  seekTo: (seconds: number) => void;
}

interface YouTubePlayerApi {
  readonly Player: new (
    element: HTMLDivElement,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: () => void;
        onError?: () => void;
      };
    },
  ) => YouTubePlayerInstance;
}

interface YouTubePlayerInstance {
  readonly destroy: () => void;
  readonly seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  readonly getCurrentTime: () => number;
  readonly getDuration: () => number;
}

declare global {
  interface Window {
    YT?: YouTubePlayerApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let iframeApiPromise: Promise<YouTubePlayerApi> | null = null;

const SENTENCE_END_PATTERN = /[.!?。！？；;…]\s*$/;
const CJK_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/;
const MIN_SMART_SEGMENT_DURATION = 8;

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatCount(count: number | null): string | null {
  if (count == null) return null;
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

function formatPublishedDate(dateString: string | null): string | null {
  if (!dateString) return null;

  const normalized = /^\d{8}$/.test(dateString)
    ? `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`
    : dateString;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isCjkText(text: string): boolean {
  if (!text) return false;

  let total = 0;
  let cjk = 0;

  for (const character of text) {
    if (!character.trim()) continue;
    total += 1;
    if (CJK_PATTERN.test(character)) cjk += 1;
  }

  return total > 0 && cjk / total > 0.3;
}

function mergeTranscriptSegments(
  segments: readonly YouTubeTranscriptSegment[],
): TranscriptSegment[] {
  if (segments.length === 0) return [];

  const merged: TranscriptSegment[] = [];
  let bufferText = '';
  let bufferStart = segments[0].startTime;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const separator = bufferText && !isCjkText(bufferText) ? ' ' : '';
    bufferText = bufferText ? `${bufferText}${separator}${segment.text}` : segment.text;

    const isLast = index === segments.length - 1;
    const duration = segment.endTime - bufferStart;
    const shouldBreak =
      isLast ||
      duration >= 30 ||
      (duration >= MIN_SMART_SEGMENT_DURATION && SENTENCE_END_PATTERN.test(bufferText.trim()));

    if (shouldBreak) {
      merged.push({
        startTime: bufferStart,
        endTime: segment.endTime,
        speaker: '',
        text: bufferText.trim(),
      });

      bufferText = '';
      if (!isLast) {
        bufferStart = segments[index + 1].startTime;
      }
    }
  }

  return merged;
}

function findActiveSegment(
  segments: readonly YouTubeTranscriptSegment[],
  currentTime: number,
): YouTubeTranscriptSegment | null {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (currentTime >= segment.startTime && currentTime < segment.endTime) {
      return segment;
    }
  }

  return null;
}

function loadYouTubeIframeApi(): Promise<YouTubePlayerApi> {
  if (globalThis.window.YT?.Player) {
    return Promise.resolve(globalThis.window.YT);
  }

  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise<YouTubePlayerApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    const handleReady = () => {
      if (globalThis.window.YT?.Player) {
        resolve(globalThis.window.YT);
      } else {
        reject(new Error('YouTube IFrame API 未就绪'));
      }
    };

    const previousReady = globalThis.window.onYouTubeIframeAPIReady;
    globalThis.window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      handleReady();
    };

    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('无法加载 YouTube IFrame API'));
      document.head.appendChild(script);
    }

    globalThis.window.setTimeout(() => {
      if (!globalThis.window.YT?.Player) {
        reject(new Error('YouTube IFrame API 加载超时'));
      }
    }, 15_000);
  }).catch((error) => {
    iframeApiPromise = null;
    throw error;
  });

  return iframeApiPromise;
}

const YouTubePlayerEmbed = forwardRef<
  YouTubePlayerHandle,
  {
    videoId: string;
    onReady: () => void;
    onDuration: (duration: number) => void;
    onTimeUpdate: (currentTime: number) => void;
  }
>(function YouTubePlayerEmbed({ videoId, onReady, onDuration, onTimeUpdate }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const tickerRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopTicker = useCallback(() => {
    if (tickerRef.current != null) {
      globalThis.window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const startTicker = useCallback(() => {
    stopTicker();
    tickerRef.current = globalThis.window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();

      if (Number.isFinite(duration) && duration > 0) {
        onDuration(duration);
      }
      if (Number.isFinite(currentTime) && currentTime >= 0) {
        onTimeUpdate(currentTime);
      }
    }, 500);
  }, [onDuration, onTimeUpdate, stopTicker]);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      playerRef.current?.seekTo(seconds, true);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    void loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;

        playerRef.current?.destroy();
        playerRef.current = new YT.Player(containerRef.current, {
          videoId,
          playerVars: {
            rel: 0,
            autoplay: 0,
            playsinline: 1,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              startTicker();
              onReady();
            },
            onStateChange: () => {
              startTicker();
            },
            onError: () => {
              setError('播放器初始化失败');
            },
          },
        });
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      });

    return () => {
      cancelled = true;
      stopTicker();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [onReady, startTicker, stopTicker, videoId]);

  if (error) {
    return (
      <div className="relative aspect-video rounded-2xl bg-black/90 flex items-center justify-center">
        <div className="text-center text-sm text-white/70 px-6">
          <AlertCircle size={18} className="mx-auto mb-2" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
});

function TranscriptPanel({
  transcript,
  transcriptLoading,
  transcriptError,
  currentTime,
  onSeek,
}: {
  transcript: YouTubeTranscript | null;
  transcriptLoading: boolean;
  transcriptError: string | null;
  currentTime: number;
  onSeek: (time: number) => void;
}): ReactElement {
  const mergedSegments = useMemo(
    () => mergeTranscriptSegments(transcript?.segments ?? []),
    [transcript?.segments],
  );

  if (transcriptLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-sm text-muted">
        <Loader2 size={18} className="animate-spin mb-2" />
        正在加载视频字幕…
      </div>
    );
  }

  if (transcriptError) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-sm text-danger">
        <AlertCircle size={18} className="mb-2" />
        {transcriptError}
      </div>
    );
  }

  if (!transcript || mergedSegments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-sm text-muted">
        <FileText size={18} className="mb-2 opacity-60" />
        当前视频没有可用字幕
      </div>
    );
  }

  return (
    <TranscriptView
      segments={mergedSegments}
      currentTime={currentTime}
      onSeek={onSeek}
      speakers={[]}
    />
  );
}

function NotesPanel({ articleId }: { articleId: string }): ReactElement {
  const highlights = useHighlightsForArticle(articleId);

  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-sm text-muted">
        <StickyNote size={18} className="mb-2 opacity-60" />
        暂无高亮或笔记
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 overflow-y-auto">
      {highlights.map((highlight) => (
        <Card key={highlight.id}>
          <Card.Content className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: highlight.color ?? '#fbbf24' }}
              />
              <Chip size="sm" variant="soft">
                {highlight.highlightKind === 'note' ? '笔记' : '高亮'}
              </Chip>
              <span className="text-xs text-muted">
                {new Date(highlight.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {highlight.quoteText}
            </p>
            {highlight.note && (
              <p className="text-xs text-muted whitespace-pre-wrap">{highlight.note}</p>
            )}
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}

function CommentList({ comments }: { comments: readonly YouTubeComment[] }): ReactElement | null {
  if (comments.length === 0) return null;

  return (
    <Card>
      <Card.Header>
        <Card.Title className="text-base">评论</Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4">
        {comments.map((comment, index) => (
          <div key={`${comment.author}-${index}`} className="flex gap-3">
            {comment.authorThumbnail ? (
              <img
                src={comment.authorThumbnail}
                alt=""
                className="h-8 w-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-surface-secondary text-muted flex items-center justify-center text-xs shrink-0">
                {comment.author.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-1">
                <span className="text-foreground font-medium">{comment.author}</span>
                {comment.publishedText && <span>{comment.publishedText}</span>}
                {comment.likeCount != null && <span>{formatCount(comment.likeCount)} 赞</span>}
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {comment.text}
              </p>
            </div>
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

export function YouTubeVideoReaderView({
  article,
  onBack,
}: YouTubeVideoReaderViewProps): ReactElement {
  const videoId = useMemo(
    () => (article.sourceUrl ? extractYouTubeVideoId(article.sourceUrl) : null),
    [article.sourceUrl],
  );
  const playerRef = useRef<YouTubePlayerHandle | null>(null);
  const resumeAppliedRef = useRef(false);
  const lastSavedProgressRef = useRef(article.readingProgress ?? 0);

  const [meta, setMeta] = useState<YouTubeVideoMeta | null>(null);
  const [details, setDetails] = useState<YouTubeVideoDetails | null>(null);
  const [transcript, setTranscript] = useState<YouTubeTranscript | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [resumeSettled, setResumeSettled] = useState(false);
  const [hasPlaybackSample, setHasPlaybackSample] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(details?.duration ?? meta?.duration ?? 0);
  const [subtitleOverlay, setSubtitleOverlay] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const { updateArticleStatus, updateReadingProgress } = useReaderMutations();

  useEffect(() => {
    lastSavedProgressRef.current = article.readingProgress ?? 0;
    resumeAppliedRef.current = false;
    setPlayerReady(false);
    setResumeSettled(false);
    setHasPlaybackSample(false);
    setCurrentTime(0);
    setDescriptionExpanded(false);
  }, [article.id, article.readingProgress]);

  useEffect(() => {
    setDuration((previousDuration) => {
      const nextDuration = details?.duration ?? meta?.duration ?? previousDuration;
      return nextDuration;
    });
  }, [details?.duration, meta?.duration]);

  useEffect(() => {
    if (article.status === 'unread') {
      updateArticleStatus(article.id, 'reading');
    }
  }, [article.id, article.status, updateArticleStatus]);

  useEffect(() => {
    if (!videoId) {
      setDetailsError('无法识别当前视频链接');
      setTranscriptError('无法识别当前视频链接');
      return;
    }

    let cancelled = false;
    setMeta(null);
    setDetails(null);
    setTranscript(null);
    setDetailsLoading(true);
    setTranscriptLoading(true);
    setDetailsError(null);
    setTranscriptError(null);

    void Promise.all([
      fetchYouTubeVideoMeta(videoId, readerFetchOptions),
      fetchYouTubeVideoDetails(videoId, readerFetchOptions),
    ])
      .then(([nextMeta, nextDetails]) => {
        if (cancelled) return;

        setMeta(nextMeta);
        setDetails(nextDetails);

        if (!nextMeta && !nextDetails) {
          setDetailsError('未能加载视频元数据');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDetailsError(error instanceof Error ? error.message : '视频元数据加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      });

    void fetchYouTubeTranscript(videoId, readerFetchOptions)
      .then((nextTranscript) => {
        if (!cancelled) {
          setTranscript(nextTranscript);
          if (!nextTranscript) {
            setTranscriptError('当前视频没有可用字幕');
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTranscriptError(error instanceof Error ? error.message : '字幕加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTranscriptLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(() => {
    if (!playerReady || !playerRef.current || resumeAppliedRef.current || duration <= 0) return;

    const savedProgress = article.readingProgress ?? 0;
    const resumeTime = Math.max(0, Math.min(duration - 1, savedProgress * duration));

    if (resumeTime > 0) {
      playerRef.current.seekTo(resumeTime);
      setCurrentTime(resumeTime);
    }

    resumeAppliedRef.current = true;
    setResumeSettled(true);
  }, [article.readingProgress, duration, playerReady]);

  useEffect(() => {
    if (!resumeSettled || !hasPlaybackSample || duration <= 0) return;

    const nextProgress = Math.max(0, Math.min(1, currentTime / duration));
    const previousProgress = lastSavedProgressRef.current;

    if (
      Math.abs(nextProgress - previousProgress) < 0.01 &&
      !(nextProgress >= 0.999 && previousProgress < 0.999)
    ) {
      return;
    }

    updateReadingProgress(article.id, nextProgress);
    lastSavedProgressRef.current = nextProgress;
  }, [article.id, currentTime, duration, hasPlaybackSample, resumeSettled, updateReadingProgress]);

  const progressValue =
    duration > 0
      ? Math.max(0, Math.min(100, (currentTime / duration) * 100))
      : (article.readingProgress ?? 0) * 100;

  const displayTitle = details?.title ?? meta?.title ?? article.title;
  const displayAuthor = details?.channelName ?? meta?.author ?? article.author ?? '未知频道';
  const description = details?.description ?? article.summary ?? null;
  const activeSubtitleSegment = useMemo(
    () => findActiveSegment(transcript?.segments ?? [], currentTime),
    [currentTime, transcript?.segments],
  );

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
    setCurrentTime(time);
    setHasPlaybackSample(true);
  }, []);

  if (!videoId) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
          <Button variant="ghost" size="sm" onPress={onBack}>
            <ArrowLeft size={16} /> 返回
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertCircle size={16} />
            当前条目不是有效的 YouTube 视频链接。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <ProgressBar aria-label="视频播放进度" value={progressValue} size="sm" color="accent">
        <ProgressBar.Track className="h-1 rounded-none">
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      <HighlightFloatingMenu articleId={article.id} />

      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
        <Button variant="ghost" size="sm" onPress={onBack}>
          <ArrowLeft size={16} /> 返回
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">{displayTitle}</h1>
        </div>
        <Chip size="sm" variant="soft">
          {displayAuthor}
        </Chip>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {article.sourceUrl && (
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-secondary"
                >
                  <ExternalLink size={14} />
                  在 YouTube 打开
                </a>
              )}
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setSubtitleOverlay((value) => !value)}
              >
                <Captions size={14} />
                {subtitleOverlay ? '隐藏字幕叠层' : '显示字幕叠层'}
              </Button>
              {transcript?.language && (
                <Chip size="sm" variant="soft">
                  {transcript.language}
                  {transcript.isAutoGenerated ? ' · 自动字幕' : ' · 手动字幕'}
                </Chip>
              )}
            </div>

            <div className="relative">
              <YouTubePlayerEmbed
                ref={playerRef}
                videoId={videoId}
                onReady={() => setPlayerReady(true)}
                onDuration={setDuration}
                onTimeUpdate={(time) => {
                  setCurrentTime(time);
                  setHasPlaybackSample(true);
                }}
              />

              {subtitleOverlay && activeSubtitleSegment && (
                <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
                  <div className="max-w-3xl rounded-xl bg-black/75 px-4 py-2 text-center text-sm leading-relaxed text-white shadow-lg backdrop-blur">
                    {activeSubtitleSegment.text}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
              <span className="flex items-center gap-1">
                <Clock3 size={14} />
                {formatDuration(currentTime) ?? '00:00'}
                {duration > 0 ? ` / ${formatDuration(duration)}` : ''}
              </span>
              {details?.viewCount != null && (
                <span className="flex items-center gap-1">
                  <Eye size={14} />
                  {formatCount(details.viewCount)} 次观看
                </span>
              )}
              {details?.uploadDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatPublishedDate(details.uploadDate)}
                </span>
              )}
            </div>

            <Card>
              <Card.Header>
                <Card.Title className="text-xl">{displayTitle}</Card.Title>
              </Card.Header>
              <Card.Content className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <Chip size="sm" variant="soft">
                    YouTube
                  </Chip>
                  {detailsLoading && (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 size={14} className="animate-spin" />
                      加载视频详情中
                    </span>
                  )}
                  {detailsError && (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <AlertCircle size={14} />
                      {detailsError}
                    </span>
                  )}
                </div>

                {description && (
                  <div className="space-y-2">
                    <p
                      className={`text-sm leading-relaxed text-foreground whitespace-pre-wrap ${
                        !descriptionExpanded ? 'line-clamp-5' : ''
                      }`}
                    >
                      {description}
                    </p>
                    {description.length > 280 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => setDescriptionExpanded((value) => !value)}
                      >
                        {descriptionExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {descriptionExpanded ? '收起' : '展开更多'}
                      </Button>
                    )}
                  </div>
                )}

                {details?.channelThumbnail && (
                  <div className="flex items-center gap-3">
                    <img
                      src={details.channelThumbnail}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {displayAuthor}
                      </div>
                      {details.subscriberCount && (
                        <div className="text-xs text-muted">{details.subscriberCount}</div>
                      )}
                    </div>
                  </div>
                )}
              </Card.Content>
            </Card>

            <CommentList comments={details?.comments ?? []} />
          </div>
        </div>

        <aside className="w-[28rem] min-w-[22rem] shrink-0 border-l border-border bg-surface overflow-hidden">
          <Tabs className="flex h-full flex-col">
            <Tabs.List>
              <Tabs.Tab id="transcript">
                <FileText size={14} /> 字幕
              </Tabs.Tab>
              <Tabs.Tab id="notes">
                <MessageSquareText size={14} /> 笔记
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="transcript" className="flex-1 overflow-hidden">
              <TranscriptPanel
                transcript={transcript}
                transcriptLoading={transcriptLoading}
                transcriptError={transcriptError}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            </Tabs.Panel>
            <Tabs.Panel id="notes" className="flex-1 overflow-hidden">
              <NotesPanel articleId={article.id} />
            </Tabs.Panel>
          </Tabs>
        </aside>
      </div>

      <ReadingExitBar />
    </div>
  );
}
