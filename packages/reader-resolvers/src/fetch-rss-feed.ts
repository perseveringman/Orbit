/**
 * RSS/Atom feed fetching with ETag/Last-Modified support.
 * Migrated from old-orbit/src/main/services/rss-service.ts
 */

import type { IsoDateTimeString } from '@orbit/domain';
import type { RssFeedEntry, PodcastEpisodeEntry } from './types.js';
import type { FetchPageOptions, FetchFn } from './fetch-helpers.js';
import { BOT_UA } from './fetch-helpers.js';
import { parseRssFeedXml } from './rss-resolver.js';

// ── Types ──────────────────────────────────────────────────

export interface FeedFetchOptions extends FetchPageOptions {
  /** Previous ETag for conditional fetch */
  readonly etag?: string | null;
  /** Previous Last-Modified for conditional fetch */
  readonly lastModified?: string | null;
}

export interface FetchedFeed {
  readonly title: string;
  readonly description: string | null;
  readonly entries: readonly RssFeedEntry[];
  readonly podcastEntries: readonly PodcastEpisodeEntry[];
  /** True if feed has iTunes namespace or audio enclosures */
  readonly isPodcast: boolean;
  /** New ETag from response headers */
  readonly etag: string | null;
  /** New Last-Modified from response headers */
  readonly lastModified: string | null;
  /** Whether content was unchanged (HTTP 304) */
  readonly notModified: boolean;
}

// ── Main fetch function ────────────────────────────────────

/**
 * Fetch an RSS/Atom feed from a URL with conditional fetch support.
 * Returns parsed feed data or notModified=true if unchanged.
 */
export async function fetchRssFeed(
  feedUrl: string,
  options?: FeedFetchOptions,
): Promise<FetchedFeed | null> {
  const doFetch = options?.fetchFn ?? globalThis.fetch;

  const headers: Record<string, string> = {
    'User-Agent': options?.userAgent ?? BOT_UA,
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  };

  // Conditional fetch headers
  if (options?.etag) headers['If-None-Match'] = options.etag;
  if (options?.lastModified) headers['If-Modified-Since'] = options.lastModified;

  try {
    const response = await doFetch(feedUrl, {
      headers,
      signal: AbortSignal.timeout(options?.timeoutMs ?? 15_000),
      redirect: 'follow',
    });

    // 304 Not Modified
    if (response.status === 304) {
      return {
        title: '',
        description: null,
        entries: [],
        podcastEntries: [],
        isPodcast: false,
        etag: options?.etag ?? null,
        lastModified: options?.lastModified ?? null,
        notModified: true,
      };
    }

    if (!response.ok) return null;

    const xml = await response.text();
    const parsed = parseRssFeedXml(xml);

    // Detect podcast feed
    const isPodcast =
      xml.includes('xmlns:itunes') ||
      xml.includes('itunes:') ||
      parsed.entries.some((e) => e.contentUrl?.match(/\.(mp3|m4a|ogg|wav|aac)/i));

    // Extract podcast-specific data if applicable
    const podcastEntries: PodcastEpisodeEntry[] = isPodcast
      ? parsed.entries.map((e) => parsePodcastEntry(e, xml))
      : [];

    return {
      title: parsed.title,
      description: parsed.description,
      entries: parsed.entries,
      podcastEntries,
      isPodcast,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      notModified: false,
    };
  } catch {
    return null;
  }
}

// ── Podcast entry parsing ──────────────────────────────────

function parsePodcastEntry(entry: RssFeedEntry, xml: string): PodcastEpisodeEntry {
  // Try to find this entry's raw XML for itunes-specific fields
  const entryTitle = entry.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Duration: try itunes:duration near the title
  let duration: number | null = null;
  const durationMatch = xml.match(
    new RegExp(`<item>[\\s\\S]*?${entryTitle}[\\s\\S]*?<itunes:duration>([^<]+)</itunes:duration>`, 'i'),
  );
  if (durationMatch) {
    duration = parseItunesDuration(durationMatch[1]);
  }

  // Episode/season numbers
  let episodeNumber: number | null = null;
  let seasonNumber: number | null = null;
  const epMatch = xml.match(
    new RegExp(`<item>[\\s\\S]*?${entryTitle}[\\s\\S]*?<itunes:episode>(\\d+)</itunes:episode>`, 'i'),
  );
  if (epMatch) episodeNumber = parseInt(epMatch[1], 10);

  const snMatch = xml.match(
    new RegExp(`<item>[\\s\\S]*?${entryTitle}[\\s\\S]*?<itunes:season>(\\d+)</itunes:season>`, 'i'),
  );
  if (snMatch) seasonNumber = parseInt(snMatch[1], 10);

  return {
    title: entry.title,
    audioUrl: entry.contentUrl ?? '',
    duration,
    publishedAt: entry.publishedAt,
    summary: entry.summary,
    episodeNumber,
    seasonNumber,
  };
}

/** Parse itunes:duration which can be HH:MM:SS, MM:SS, or just seconds */
function parseItunesDuration(raw: string): number | null {
  const trimmed = raw.trim();

  // Pure number (seconds)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // HH:MM:SS or MM:SS
  const parts = trimmed.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];

  return null;
}
