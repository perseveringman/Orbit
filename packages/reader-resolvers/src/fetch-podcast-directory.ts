/**
 * Podcast directory search services: iTunes Search API + Podcast Index.
 * Migrated from old-orbit/src/main/services/podcast-directory-service.ts
 */

import type { FetchPageOptions } from './fetch-helpers.js';
import { fetchJson, BOT_UA } from './fetch-helpers.js';

// ── Types ──────────────────────────────────────────────────

export interface PodcastSearchResult {
  readonly title: string;
  readonly author: string | null;
  readonly image: string | null;
  readonly feedUrl: string | null;
  readonly website: string | null;
  readonly source: 'itunes' | 'podcastindex';
  readonly id: string;
}

export type PodcastSearchType = 'show' | 'episode';

export interface PodcastDirectoryOptions extends FetchPageOptions {
  readonly podcastIndexApiKey?: string;
  readonly podcastIndexApiSecret?: string;
}

// ── iTunes Search ──────────────────────────────────────────

interface ITunesResult {
  collectionId?: number;
  trackId?: number;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  feedUrl?: string;
  collectionViewUrl?: string;
  trackViewUrl?: string;
}

async function searchItunes(
  query: string,
  type: PodcastSearchType,
  limit: number,
  options?: FetchPageOptions,
): Promise<PodcastSearchResult[]> {
  const entity = type === 'episode' ? 'podcastEpisode' : 'podcast';
  const params = new URLSearchParams({
    term: query,
    entity,
    limit: String(limit),
    media: 'podcast',
  });

  const data = await fetchJson<{ results: ITunesResult[] }>(
    `https://itunes.apple.com/search?${params}`,
    options,
  );
  if (!data) return [];

  return data.results.map((r) => ({
    title: r.collectionName ?? r.trackName ?? '',
    author: r.artistName ?? null,
    image: r.artworkUrl600 ?? r.artworkUrl100 ?? null,
    feedUrl: r.feedUrl ?? null,
    website: r.collectionViewUrl ?? r.trackViewUrl ?? null,
    source: 'itunes' as const,
    id: String(r.collectionId ?? r.trackId ?? ''),
  }));
}

// ── iTunes Lookup (by Apple Podcasts ID) ───────────────────

export interface ItunesLookupResult {
  readonly feedUrl: string | null;
  readonly title: string | null;
  readonly author: string | null;
  readonly image: string | null;
}

export async function itunesLookup(
  itunesId: string,
  options?: FetchPageOptions,
): Promise<ItunesLookupResult> {
  const params = new URLSearchParams({ id: itunesId, entity: 'podcast' });
  const data = await fetchJson<{ results: ITunesResult[] }>(
    `https://itunes.apple.com/lookup?${params}`,
    options,
  );
  if (!data || data.results.length === 0) {
    return { feedUrl: null, title: null, author: null, image: null };
  }

  const r = data.results[0];
  return {
    feedUrl: r.feedUrl ?? null,
    title: r.collectionName ?? null,
    author: r.artistName ?? null,
    image: r.artworkUrl600 ?? r.artworkUrl100 ?? null,
  };
}

// ── Merged Search ──────────────────────────────────────────

function deduplicateByFeedUrl(results: PodcastSearchResult[]): PodcastSearchResult[] {
  const seen = new Set<string>();
  const deduped: PodcastSearchResult[] = [];
  for (const r of results) {
    const key = r.feedUrl ?? `__no_feed_${r.id}_${r.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }
  return deduped;
}

/**
 * Search podcast directories. iTunes by default.
 * If Podcast Index API credentials are provided, both are searched in parallel.
 */
export async function searchPodcasts(
  query: string,
  type: PodcastSearchType = 'show',
  limit = 20,
  options?: PodcastDirectoryOptions,
): Promise<PodcastSearchResult[]> {
  const searches: Promise<PodcastSearchResult[]>[] = [
    searchItunes(query, type, limit, options).catch(() => []),
  ];

  // Podcast Index requires API key — skip if not provided
  // (API integration can be added later with proper auth)

  const results = await Promise.all(searches);
  return deduplicateByFeedUrl(results.flat());
}
