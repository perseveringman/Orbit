/**
 * Podcast episode detection and metadata fetching.
 * Migrated from old-orbit/src/main/services/podcast-resolver.ts
 */

import type { FetchPageOptions } from './fetch-helpers.js';
import { fetchPageHtml, extractMetaContent, extractHtmlTitle, truncateText } from './fetch-helpers.js';

// ── Episode URL Detection ──────────────────────────────────

/**
 * Detect if a URL points to a specific podcast episode (not a show/channel).
 * Supports: 小宇宙, Apple Podcasts, Spotify.
 */
export function isPodcastEpisodeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 小宇宙: /episode/xxxxx
    if (
      (hostname.includes('xiaoyuzhoufm.com') || hostname.includes('xyzfm.link')) &&
      pathname.startsWith('/episode/')
    ) {
      return true;
    }

    // Apple Podcasts: ?i= parameter indicates an episode
    if (
      (hostname.includes('podcasts.apple.com') || hostname.includes('itunes.apple.com')) &&
      parsed.searchParams.has('i')
    ) {
      return true;
    }

    // Spotify: /episode/xxxxx
    if (
      (hostname.includes('open.spotify.com') || hostname.includes('spotify.com')) &&
      pathname.startsWith('/episode/')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ── Episode Metadata ───────────────────────────────────────

export interface PodcastEpisodeMeta {
  readonly title: string;
  readonly author: string | null;
  readonly showName: string | null;
  readonly summary: string | null;
  readonly content: string | null;
  readonly thumbnail: string | null;
  readonly audioUrl: string | null;
  readonly duration: number | null; // seconds
  readonly publishedAt: string | null; // ISO 8601
}

/**
 * Fetch metadata for a podcast episode from its page HTML.
 * Uses og: meta tags + JSON-LD structured data.
 */
export async function fetchPodcastEpisodeMeta(
  url: string,
  options?: FetchPageOptions,
): Promise<PodcastEpisodeMeta | null> {
  const html = await fetchPageHtml(url, options);
  if (!html) return null;

  // Basic metadata from og: tags
  const title =
    extractMetaContent(html, 'og:title') ??
    extractMetaContent(html, 'twitter:title') ??
    extractHtmlTitle(html);
  if (!title) return null;

  const ogDescription =
    extractMetaContent(html, 'og:description') ?? extractMetaContent(html, 'description');
  const thumbnail = extractMetaContent(html, 'og:image');
  const audioUrl = extractMetaContent(html, 'og:audio');

  // JSON-LD: PodcastEpisode structured data (小宇宙 etc.)
  let showName: string | null = null;
  let duration: number | null = null;
  let publishedAt: string | null = null;
  let ldAuthor: string | null = null;
  let ldDescription: string | null = null;

  const ldMatch = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]) as {
        '@type'?: string;
        name?: string;
        description?: string;
        datePublished?: string;
        timeRequired?: string;
        partOfSeries?: { name?: string };
        author?: { name?: string } | string;
      };
      if (ld.description) ldDescription = ld.description;
      if (ld.datePublished) publishedAt = ld.datePublished;
      if (ld.timeRequired) duration = parseIso8601Duration(ld.timeRequired);
      if (ld.partOfSeries?.name) showName = ld.partOfSeries.name;
      if (typeof ld.author === 'string') ldAuthor = ld.author;
      else if (ld.author?.name) ldAuthor = ld.author.name;
    } catch {
      // JSON-LD parse failure — continue with meta data
    }
  }

  const author =
    ldAuthor ??
    extractMetaContent(html, 'og:site_name') ??
    extractMetaContent(html, 'author');

  const fullDescription = ldDescription ?? ogDescription;

  return {
    title,
    author,
    showName,
    summary: fullDescription ? truncateText(fullDescription, 500) : null,
    content: fullDescription ?? null,
    thumbnail,
    audioUrl,
    duration,
    publishedAt,
  };
}

// ── Helpers ────────────────────────────────────────────────

/** Parse ISO 8601 duration (PT173M, PT1H30M, PT45M30S etc.) to seconds */
export function parseIso8601Duration(iso: string): number | null {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}
