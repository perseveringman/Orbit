/**
 * YouTube video metadata fetching and channel feed resolution.
 * Migrated from old-orbit/src/main/services/youtube-service.ts
 */

import type { FetchPageOptions } from './fetch-helpers.js';
import { fetchJson, fetchPageHtml, BROWSER_UA } from './fetch-helpers.js';

// ── Video Metadata (oEmbed) ────────────────────────────────

export interface YouTubeVideoMeta {
  readonly title: string;
  readonly author: string | null;
  readonly thumbnail: string;
  readonly duration: number | null; // seconds (only via Innertube, null for oEmbed-only)
}

/**
 * Fetch YouTube video metadata via the oEmbed API (no API key required).
 */
export async function fetchYouTubeVideoMeta(
  videoId: string,
  options?: FetchPageOptions,
): Promise<YouTubeVideoMeta | null> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

  const data = await fetchJson<{
    title?: string;
    author_name?: string;
  }>(oembedUrl, options);

  if (!data) return null;

  return {
    title: data.title ?? videoId,
    author: data.author_name ?? null,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: null, // oEmbed doesn't provide duration; needs Innertube or yt-dlp
  };
}

// ── Channel Feed Resolution ────────────────────────────────

/**
 * Resolve a YouTube channel/handle URL to its RSS feed URL.
 * Fetches the channel page HTML and extracts the channel ID.
 */
export async function resolveYouTubeChannelFeed(
  url: string,
  options?: FetchPageOptions,
): Promise<string | null> {
  const html = await fetchPageHtml(url, {
    ...options,
    userAgent: options?.userAgent ?? BROWSER_UA,
  });
  if (!html) return null;

  // Method 1: meta itemprop="channelId"
  const metaMatch = html.match(/<meta\s+itemprop="channelId"\s+content="([^"]+)"/);
  if (metaMatch) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${metaMatch[1]}`;
  }

  // Method 2: canonical channel URL in page content
  const canonicalMatch = html.match(
    /https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/,
  );
  if (canonicalMatch) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${canonicalMatch[1]}`;
  }

  // Method 3: RSS link tag
  const rssMatch = html.match(
    /<link[^>]+type="application\/rss\+xml"[^>]+href="([^"]+)"/,
  );
  if (rssMatch) {
    return rssMatch[1];
  }

  return null;
}
