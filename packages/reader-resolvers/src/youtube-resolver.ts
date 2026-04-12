import type { ResolverResult } from './types.js';

const YOUTUBE_HOST_RE = /^(?:www\.)?(?:youtube\.com|youtu\.be|m\.youtube\.com)$/i;

export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return YOUTUBE_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!YOUTUBE_HOST_RE.test(parsed.hostname)) return null;

    // youtu.be/{id}
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      return id || null;
    }

    // /watch?v={id}
    const vParam = parsed.searchParams.get('v');
    if (vParam) return vParam;

    // /shorts/{id}
    const shortsMatch = parsed.pathname.match(/^\/shorts\/([A-Za-z0-9_-]+)/);
    if (shortsMatch) return shortsMatch[1];

    // /embed/{id}
    const embedMatch = parsed.pathname.match(/^\/embed\/([A-Za-z0-9_-]+)/);
    if (embedMatch) return embedMatch[1];

    // /live/{id}
    const liveMatch = parsed.pathname.match(/^\/live\/([A-Za-z0-9_-]+)/);
    if (liveMatch) return liveMatch[1];

    return null;
  } catch {
    return null;
  }
}

export function extractYouTubeChannelId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!YOUTUBE_HOST_RE.test(parsed.hostname)) return null;

    // /channel/UCxxxxxxx
    const channelMatch = parsed.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]+)/);
    if (channelMatch) return channelMatch[1];

    // /@handle
    const handleMatch = parsed.pathname.match(/^\/@([A-Za-z0-9_.-]+)/);
    if (handleMatch) return `@${handleMatch[1]}`;

    // /c/name
    const cMatch = parsed.pathname.match(/^\/c\/([A-Za-z0-9_.-]+)/);
    if (cMatch) return `c/${cMatch[1]}`;

    return null;
  } catch {
    return null;
  }
}

export function getYouTubeChannelFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

export function resolveYouTubeUrl(url: string): ResolverResult {
  if (!isYouTubeUrl(url)) {
    return {
      ok: false,
      source: null,
      error: 'Not a YouTube URL',
      resolverUsed: 'youtube',
    };
  }

  const channelId = extractYouTubeChannelId(url);
  if (channelId) {
    const feedUrl = channelId.startsWith('UC')
      ? getYouTubeChannelFeedUrl(channelId)
      : null;

    return {
      ok: true,
      source: {
        kind: 'youtube_channel',
        feedUrl,
        title: channelId,
        description: null,
        language: null,
        iconUrl: null,
        metadata: { channelId, originalUrl: url },
      },
      error: null,
      resolverUsed: 'youtube',
    };
  }

  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return {
      ok: true,
      source: {
        kind: 'manual_url',
        feedUrl: null,
        title: videoId,
        description: null,
        language: null,
        iconUrl: null,
        metadata: { videoId, originalUrl: url },
      },
      error: null,
      resolverUsed: 'youtube',
    };
  }

  return {
    ok: false,
    source: null,
    error: 'Could not extract video or channel ID from YouTube URL',
    resolverUsed: 'youtube',
  };
}
