/**
 * Resolver Test Page — 订阅抓取测试面板
 *
 * Features:
 * 1. Parse single URL → article (web, podcast episode, YouTube video)
 * 2. Subscribe to sources as RSS (GitHub trending, HN, YouTube channel, podcast feed)
 * 3. Search podcast episodes by title
 */

import { useState, useCallback, type ReactElement } from 'react';
import { Button, Card, Chip, Input, Separator, Tabs } from '@heroui/react';
import {
  Link2,
  Rss,
  Search,
  Play,
  FileText,
  Headphones,
  Video,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Podcast,
  Flame,
  TrendingUp,
  ExternalLink,
  Trash2,
  Database,
} from 'lucide-react';

import {
  // Sync resolvers
  routeUrl,
  isYouTubeUrl,
  extractYouTubeVideoId,
  isPodcastUrl,
  isPodcastEpisodeUrl,
  isRssFeedUrl,
  parseRssFeedXml,
  // Async fetchers
  fetchYouTubeVideoMeta,
  fetchYouTubeVideoDetails,
  resolveYouTubeChannelFeed,
  fetchPodcastEpisodeMeta,
  resolvePodcastFeedUrl,
  searchPodcasts,
  parseArticleContent,
  fetchRssFeed,
  fetchPageHtml,
  // Types
  type YouTubeVideoMeta,
  type PodcastEpisodeMeta,
  type ParsedArticle,
  type PodcastSearchResult,
  type ResolvedPodcastFeed,
  type FetchedFeed,
  type RouteResult,
} from '@orbit/reader-resolvers';

import { useOrbitData } from '../../data/orbit-data-context';
import { readerFetchOptions } from '../../data/proxied-fetch';
import { useReaderMutations } from '../../data/use-reader-mutations';
import { useSubscriptionMutations } from '../../data/use-subscription-mutations';

// ── Proxied fetch for CORS ─────────────────────────────────

const fetchOptions = readerFetchOptions;

// ── Types ──────────────────────────────────────────────────

interface ParseResult {
  id: string;
  url: string;
  type: 'article' | 'video' | 'podcast' | 'unknown';
  title: string | null;
  author: string | null;
  thumbnail: string | null;
  summary: string | null;
  duration: number | null;
  meta: Record<string, unknown>;
  timestamp: string;
}

interface SubscriptionItem {
  id: string;
  title: string;
  kind: string;
  feedUrl: string | null;
  sourceUrl: string;
  status: 'resolving' | 'active' | 'error';
  errorMessage?: string;
  entryCount?: number;
  lastFetchedEntries?: Array<{ title: string; url: string; publishedAt: string | null }>;
}

// ── Main Component ─────────────────────────────────────────

export function ResolverTestPage(): ReactElement {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
        <Flame size={20} className="text-accent" />
        <h1 className="text-lg font-semibold text-foreground">订阅 & 解析测试</h1>
        <Chip size="sm" variant="soft" color="warning">DEV</Chip>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Tabs>
          <Tabs.List>
            <Tabs.Tab id="parse"><FileText size={14} /> 链接解析</Tabs.Tab>
            <Tabs.Tab id="subscribe"><Rss size={14} /> 来源订阅</Tabs.Tab>
            <Tabs.Tab id="search"><Search size={14} /> 播客搜索</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel id="parse"><UrlParsePanel /></Tabs.Panel>
          <Tabs.Panel id="subscribe"><SubscribePanel /></Tabs.Panel>
          <Tabs.Panel id="search"><PodcastSearchPanel /></Tabs.Panel>
        </Tabs>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel 1: URL Parse → Article
// ═══════════════════════════════════════════════════════════

function UrlParsePanel(): ReactElement {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ParseResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { ready } = useOrbitData();
  const { saveArticleFromUrl } = useReaderMutations();

  const handleParse = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await parseUrl(url.trim());
      setResults((prev) => [result, ...prev]);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败');
    } finally {
      setLoading(false);
    }
  }, [url]);

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted">
        粘贴任意链接，自动识别类型并解析元数据。支持普通网页、YouTube 视频、播客单集（小宇宙/Apple Podcast）。
      </p>

      {/* URL Input */}
      <div className="flex gap-2">
        <Input
          placeholder="粘贴 URL... (网页/YouTube/播客单集)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleParse()}
          className="flex-1"
        />
        <Button variant="primary" size="sm" onPress={handleParse} isDisabled={loading || !url.trim()}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
          {loading ? '解析中...' : '解析'}
        </Button>
      </div>

      {/* Quick examples */}
      <div className="flex flex-wrap gap-1">
        <span className="text-xs text-muted">试试:</span>
        {EXAMPLE_URLS.map(({ label, url: exUrl }) => (
          <button
            key={exUrl}
            className="text-xs text-accent hover:underline cursor-pointer"
            onClick={() => setUrl(exUrl)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Results */}
      {results.map((r) => (
        <ParseResultCard
          key={r.id}
          result={r}
          canSave={ready}
          onSave={() =>
            saveArticleFromUrl({
              title: r.title ?? r.url,
              sourceUrl: r.url,
              author: r.author,
              summary: r.summary,
              mediaType: r.type === 'video' ? 'youtube' : r.type === 'podcast' ? 'podcast' : 'web_article',
            })
          }
        />
      ))}
    </div>
  );
}

const EXAMPLE_URLS = [
  { label: 'YouTube 视频', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { label: '小宇宙单集', url: 'https://www.xiaoyuzhoufm.com/episode/67c8ac84bb3281fa59d1a5ee' },
  { label: 'HN', url: 'https://news.ycombinator.com' },
  { label: 'GitHub Blog', url: 'https://github.blog/engineering/' },
];

function ParseResultCard({
  result,
  canSave,
  onSave,
}: {
  result: ParseResult;
  canSave: boolean;
  onSave: () => string | null;
}): ReactElement {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const typeConfig = {
    article: { icon: <FileText size={14} />, label: '网页文章', color: 'accent' as const },
    video: { icon: <Video size={14} />, label: '视频', color: 'danger' as const },
    podcast: { icon: <Headphones size={14} />, label: '播客', color: 'success' as const },
    unknown: { icon: <Globe size={14} />, label: '未知', color: 'default' as const },
  };
  const tc = typeConfig[result.type];

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="soft" color={tc.color}>
            {tc.icon} {tc.label}
          </Chip>
          <span className="text-xs text-muted">{result.timestamp}</span>
        </div>
      </Card.Header>
      <Card.Title>{result.title ?? '(无标题)'}</Card.Title>
      <Card.Content>
        <div className="space-y-1">
          {result.author && <p className="text-xs">作者: {result.author}</p>}
          {result.duration != null && (
            <p className="text-xs">时长: {formatDuration(result.duration)}</p>
          )}
          {result.summary && <p className="text-xs line-clamp-2">{result.summary}</p>}
          <div className="flex items-center gap-1 mt-1">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              <ExternalLink size={10} /> {result.url}
            </a>
          </div>
          {result.thumbnail && (
            <img
              src={result.thumbnail}
              alt=""
              className="mt-2 rounded-md max-h-32 object-cover"
            />
          )}
        </div>
      </Card.Content>
      <Card.Footer>
        <div className="flex flex-col items-start gap-2">
          <Button
            variant={saved ? 'ghost' : 'primary'}
            size="sm"
            isDisabled={saved || !canSave}
            onPress={() => {
              setSaveError(null);
              const savedId = onSave();
              if (savedId) {
                setSaved(true);
                return;
              }
              setSaveError('保存失败，阅读库还没有初始化完成。');
            }}
          >
            {saved ? (
              <>
                <CheckCircle2 size={12} /> 已保存
              </>
            ) : !canSave ? (
              <>
                <Loader2 size={12} className="animate-spin" /> 阅读库初始化中...
              </>
            ) : (
              <>
                <Database size={12} /> 保存到阅读库
              </>
            )}
          </Button>
          {saveError && <p className="text-xs text-danger">{saveError}</p>}
        </div>
      </Card.Footer>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel 2: Subscribe to Sources
// ═══════════════════════════════════════════════════════════

function SubscribePanel(): ReactElement {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { createSubscription, deleteSubscription } = useSubscriptionMutations();

  const handleSubscribe = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    const subId = crypto.randomUUID();
    const newSub: SubscriptionItem = {
      id: subId,
      title: '正在解析...',
      kind: 'unknown',
      feedUrl: null,
      sourceUrl: url.trim(),
      status: 'resolving',
    };
    setSubscriptions((prev) => [newSub, ...prev]);
    setUrl('');

    try {
      const resolved = await resolveSubscription(url.trim());
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, ...resolved, status: 'active' as const } : s)),
      );
      // Persist to DB
      createSubscription({
        title: resolved.title ?? url.trim(),
        endpointType: resolved.kind ?? 'rss',
        url: url.trim(),
        feedUrl: resolved.feedUrl ?? undefined,
      });
    } catch (err) {
      setSubscriptions((prev) =>
        prev.map((s) =>
          s.id === subId
            ? { ...s, status: 'error' as const, errorMessage: err instanceof Error ? err.message : '订阅失败' }
            : s,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleFetchFeed = useCallback(async (sub: SubscriptionItem) => {
    if (!sub.feedUrl) return;
    try {
      const feed = await fetchRssFeed(sub.feedUrl, fetchOptions);
      if (feed && !feed.notModified) {
        setSubscriptions((prev) =>
          prev.map((s) =>
            s.id === sub.id
              ? {
                  ...s,
                  entryCount: feed.entries.length,
                  lastFetchedEntries: feed.entries.slice(0, 5).map((e) => ({
                    title: e.title,
                    url: e.url,
                    publishedAt: e.publishedAt,
                  })),
                }
              : s,
          ),
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const handleRemove = (id: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted">
        输入来源 URL 进行订阅，自动发现 RSS feed。支持 GitHub Trending、HackerNews、YouTube 频道、播客频道。
      </p>

      {/* URL Input */}
      <div className="flex gap-2">
        <Input
          placeholder="输入订阅来源 URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
          className="flex-1"
        />
        <Button variant="primary" size="sm" onPress={handleSubscribe} isDisabled={loading || !url.trim()}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Rss size={14} />}
          订阅
        </Button>
      </div>

      {/* Quick subscribe presets */}
      <div className="grid grid-cols-2 gap-2">
        {PRESET_SOURCES.map((source) => (
          <button
            key={source.url}
            className="flex items-center gap-2 p-2 rounded-lg border border-border bg-surface-secondary hover:bg-surface text-left text-sm transition"
            onClick={() => setUrl(source.url)}
          >
            {source.icon}
            <div>
              <p className="font-medium text-foreground">{source.label}</p>
              <p className="text-xs text-muted truncate">{source.url}</p>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <Separator />

      {/* Subscription list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">已订阅 ({subscriptions.length})</h3>
        {subscriptions.length === 0 && (
          <p className="text-sm text-muted py-4 text-center">还没有订阅，点击上方添加来源</p>
        )}
        {subscriptions.map((sub) => (
          <SubscriptionCard
            key={sub.id}
            sub={sub}
            onFetch={() => handleFetchFeed(sub)}
            onRemove={() => handleRemove(sub.id)}
          />
        ))}
      </div>
    </div>
  );
}

const PRESET_SOURCES = [
  {
    label: 'GitHub Trending',
    url: 'https://rsshub.app/github/trending/daily/all/en',
    icon: <TrendingUp size={16} className="text-accent shrink-0" />,
  },
  {
    label: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    icon: <Flame size={16} className="text-warning shrink-0" />,
  },
  {
    label: 'YouTube 频道',
    url: 'https://www.youtube.com/@Fireship',
    icon: <Video size={16} className="text-danger shrink-0" />,
  },
  {
    label: '播客 (小宇宙)',
    url: 'https://www.xiaoyuzhoufm.com/podcast/6013f9f58e2f7ee375cf4216',
    icon: <Podcast size={16} className="text-success shrink-0" />,
  },
];

function SubscriptionCard({
  sub,
  onFetch,
  onRemove,
}: {
  sub: SubscriptionItem;
  onFetch: () => void;
  onRemove: () => void;
}): ReactElement {
  const statusColor =
    sub.status === 'active' ? 'success' : sub.status === 'error' ? 'danger' : 'warning';
  const statusLabel =
    sub.status === 'active' ? '已订阅' : sub.status === 'error' ? '错误' : '解析中...';

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="soft" color={statusColor}>
            {sub.status === 'resolving' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : sub.status === 'active' ? (
              <CheckCircle2 size={12} />
            ) : (
              <AlertCircle size={12} />
            )}
            {statusLabel}
          </Chip>
          {sub.kind !== 'unknown' && (
            <Chip size="sm" variant="soft">{sub.kind}</Chip>
          )}
        </div>
      </Card.Header>
      <Card.Title>{sub.title}</Card.Title>
      <Card.Content>
        <div className="space-y-1 text-xs">
          <p className="text-muted truncate">{sub.sourceUrl}</p>
          {sub.feedUrl && <p className="text-accent truncate">Feed: {sub.feedUrl}</p>}
          {sub.errorMessage && <p className="text-red-400">{sub.errorMessage}</p>}
          {sub.entryCount != null && <p className="text-muted">{sub.entryCount} 条内容</p>}
          {sub.lastFetchedEntries && sub.lastFetchedEntries.length > 0 && (
            <div className="mt-2 space-y-1 pl-2 border-l-2 border-border">
              {sub.lastFetchedEntries.map((entry, i) => (
                <div key={i}>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-accent hover:underline"
                  >
                    {entry.title}
                  </a>
                  {entry.publishedAt && (
                    <span className="text-muted ml-1">
                      {new Date(entry.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card.Content>
      <Card.Footer>
        <div className="flex gap-1">
          {sub.feedUrl && (
            <Button variant="secondary" size="sm" onPress={onFetch}>
              <Play size={12} /> 抓取
            </Button>
          )}
          <Button variant="danger" size="sm" onPress={onRemove}>
            <Trash2 size={12} /> 移除
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel 3: Podcast Search
// ═══════════════════════════════════════════════════════════

function PodcastSearchPanel(): ReactElement {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PodcastSearchResult[]>([]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const podcasts = await searchPodcasts(query.trim(), 'show', 20);
      setResults(podcasts);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted">
        通过关键词搜索播客（iTunes 目录），查找单集或订阅频道。
      </p>

      <div className="flex gap-2">
        <Input
          placeholder="搜索播客名称或关键词..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button variant="primary" size="sm" onPress={handleSearch} isDisabled={loading || !query.trim()}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          搜索
        </Button>
      </div>

      {/* Results */}
      <div className="space-y-2">
        {results.map((podcast) => (
          <Card key={`${podcast.source}-${podcast.id}`}>
            <Card.Header>
              <div className="flex items-center gap-2">
                <Chip size="sm" variant="soft" color="success">
                  <Podcast size={12} /> {podcast.source}
                </Chip>
              </div>
            </Card.Header>
            <Card.Title>
              <div className="flex items-center gap-3">
                {podcast.image && (
                  <img
                    src={podcast.image}
                    alt=""
                    className="w-10 h-10 rounded-md object-cover shrink-0"
                  />
                )}
                <span>{podcast.title}</span>
              </div>
            </Card.Title>
            <Card.Content>
              <div className="text-xs space-y-1">
                {podcast.author && <p>作者: {podcast.author}</p>}
                {podcast.feedUrl && (
                  <p className="text-accent truncate">Feed: {podcast.feedUrl}</p>
                )}
                {podcast.website && (
                  <a
                    href={podcast.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> {podcast.website}
                  </a>
                )}
              </div>
            </Card.Content>
          </Card>
        ))}
        {results.length === 0 && query && !loading && (
          <p className="text-sm text-muted py-4 text-center">没有找到结果</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Logic: URL Parsing
// ═══════════════════════════════════════════════════════════

async function parseUrl(url: string): Promise<ParseResult> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toLocaleTimeString();

  // 1. Detect URL type with sync router
  const routeResult = routeUrl({ url });

  // 2. YouTube video
  if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      const [meta, details] = await Promise.all([
        fetchYouTubeVideoMeta(videoId, fetchOptions),
        fetchYouTubeVideoDetails(videoId, fetchOptions),
      ]);
      return {
        id,
        url,
        type: 'video',
        title: details?.title ?? meta?.title ?? null,
        author: details?.channelName ?? meta?.author ?? null,
        thumbnail:
          details?.thumbnail ??
          meta?.thumbnail ??
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        summary: details?.description ?? null,
        duration: details?.duration ?? meta?.duration ?? null,
        meta: {
          videoId,
          commentCount: details?.commentCount ?? null,
          viewCount: details?.viewCount ?? null,
          routeResult: routeResult.resolverType,
        },
        timestamp,
      };
    }
  }

  // 3. Podcast episode
  if (isPodcastEpisodeUrl(url)) {
    const meta = await fetchPodcastEpisodeMeta(url, fetchOptions);
    return {
      id,
      url,
      type: 'podcast',
      title: meta?.title ?? null,
      author: meta?.author ?? meta?.showName ?? null,
      thumbnail: meta?.thumbnail ?? null,
      summary: meta?.summary ?? null,
      duration: meta?.duration ?? null,
      meta: { showName: meta?.showName, audioUrl: meta?.audioUrl, routeResult: routeResult.resolverType },
      timestamp,
    };
  }

  // 4. General web article
  const parsed = await parseArticleContent(url, fetchOptions);
  return {
    id,
    url,
    type: 'article',
    title: parsed?.title ?? null,
    author: parsed?.author ?? null,
    thumbnail: parsed?.leadImageUrl ?? null,
    summary: parsed?.excerpt ?? null,
    duration: null,
    meta: {
      wordCount: parsed?.wordCount,
      readingTime: parsed?.readingTimeMinutes,
      language: parsed?.language,
      routeResult: routeResult.resolverType,
    },
    timestamp,
  };
}

// ═══════════════════════════════════════════════════════════
// Logic: Subscription Resolution
// ═══════════════════════════════════════════════════════════

async function resolveSubscription(
  url: string,
): Promise<Partial<SubscriptionItem>> {
  // YouTube channel
  if (isYouTubeUrl(url) && !extractYouTubeVideoId(url)) {
    const feedUrl = await resolveYouTubeChannelFeed(url, fetchOptions);
    if (feedUrl) {
      return {
        title: `YouTube: ${new URL(url).pathname.split('/').pop() ?? url}`,
        kind: 'youtube',
        feedUrl,
      };
    }
    throw new Error('无法解析 YouTube 频道 feed');
  }

  // Podcast platform URL
  if (isPodcastUrl(url)) {
    const resolved = await resolvePodcastFeedUrl(url, fetchOptions);
    if (resolved) {
      return {
        title: resolved.title ?? '播客',
        kind: 'podcast',
        feedUrl: resolved.feedUrl,
      };
    }
    throw new Error('无法解析播客 feed URL');
  }

  // Direct RSS feed URL
  if (isRssFeedUrl(url)) {
    // Try to fetch and get the title
    const feed = await fetchRssFeed(url, fetchOptions);
    return {
      title: feed?.title ?? 'RSS Feed',
      kind: 'rss',
      feedUrl: url,
      entryCount: feed?.entries.length,
    };
  }

  // Generic URL — try to discover RSS from HTML
  const html = await fetchPageHtml(url, fetchOptions);
  if (html) {
    const routeResult = routeUrl({ url, html });
    if (routeResult.result.ok && routeResult.result.source?.feedUrl) {
      return {
        title: routeResult.result.source.title,
        kind: routeResult.resolverType,
        feedUrl: routeResult.result.source.feedUrl,
      };
    }
  }

  // Last resort: try fetching as RSS directly
  const feed = await fetchRssFeed(url, fetchOptions);
  if (feed && !feed.notModified && feed.entries.length > 0) {
    return {
      title: feed.title || url,
      kind: 'rss',
      feedUrl: url,
      entryCount: feed.entries.length,
    };
  }

  throw new Error('无法发现 RSS 订阅源');
}

// ── Helpers ────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
