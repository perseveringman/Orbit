import type { ResolverResult } from './types.js';

const APPLE_PODCAST_RE = /^podcasts\.apple\.com$/i;
const SPOTIFY_RE = /^open\.spotify\.com$/i;
const XIAOYUZHOU_RE = /^(?:www\.)?xiaoyuzhoufm\.com$/i;
const PODCAST_RSS_EXTENSIONS = /\.(?:rss|xml|atom)(?:\?|$)/i;
const PODCAST_RSS_PATH_HINTS = /\/(?:feed|rss|podcast)(?:\/|$)/i;

export function isPodcastUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (APPLE_PODCAST_RE.test(parsed.hostname)) return true;
    if (SPOTIFY_RE.test(parsed.hostname) && parsed.pathname.startsWith('/show/')) return true;
    if (XIAOYUZHOU_RE.test(parsed.hostname)) return true;
    // Generic podcast RSS heuristics
    if (PODCAST_RSS_EXTENSIONS.test(parsed.pathname) && PODCAST_RSS_PATH_HINTS.test(parsed.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function extractApplePodcastId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!APPLE_PODCAST_RE.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(/\/id(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function extractSpotifyShowId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!SPOTIFY_RE.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/show\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function extractXiaoyuzhouShowId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!XIAOYUZHOU_RE.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/podcast\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function buildAppleLookupUrl(podcastId: string): string {
  return `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`;
}

export function resolvePodcastUrl(url: string): ResolverResult {
  if (!isPodcastUrl(url)) {
    return {
      ok: false,
      source: null,
      error: 'Not a podcast URL',
      resolverUsed: 'podcast',
    };
  }

  const appleId = extractApplePodcastId(url);
  if (appleId) {
    return {
      ok: true,
      source: {
        kind: 'podcast_feed',
        feedUrl: null,
        title: `Apple Podcast ${appleId}`,
        description: null,
        language: null,
        iconUrl: null,
        metadata: { platform: 'apple', podcastId: appleId, lookupUrl: buildAppleLookupUrl(appleId), originalUrl: url },
      },
      error: null,
      resolverUsed: 'podcast',
    };
  }

  const spotifyId = extractSpotifyShowId(url);
  if (spotifyId) {
    return {
      ok: true,
      source: {
        kind: 'podcast_feed',
        feedUrl: null,
        title: `Spotify Show ${spotifyId}`,
        description: null,
        language: null,
        iconUrl: null,
        metadata: { platform: 'spotify', showId: spotifyId, originalUrl: url },
      },
      error: null,
      resolverUsed: 'podcast',
    };
  }

  const xiaoyuzhouId = extractXiaoyuzhouShowId(url);
  if (xiaoyuzhouId) {
    return {
      ok: true,
      source: {
        kind: 'podcast_feed',
        feedUrl: null,
        title: `小宇宙 ${xiaoyuzhouId}`,
        description: null,
        language: null,
        iconUrl: null,
        metadata: { platform: 'xiaoyuzhou', showId: xiaoyuzhouId, originalUrl: url },
      },
      error: null,
      resolverUsed: 'podcast',
    };
  }

  return {
    ok: true,
    source: {
      kind: 'podcast_feed',
      feedUrl: url,
      title: 'Podcast Feed',
      description: null,
      language: null,
      iconUrl: null,
      metadata: { originalUrl: url },
    },
    error: null,
    resolverUsed: 'podcast',
  };
}
