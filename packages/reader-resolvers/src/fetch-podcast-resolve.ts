/**
 * Async podcast URL resolution: resolves platform URLs to RSS feed URLs.
 * Migrated from old-orbit/src/main/services/podcast-resolver.ts
 */

import type { FetchPageOptions, FetchFn } from './fetch-helpers.js';
import { fetchPageHtml, extractMetaContent, extractHtmlTitle } from './fetch-helpers.js';
import { itunesLookup, searchPodcasts } from './fetch-podcast-directory.js';
import { extractApplePodcastId } from './podcast-resolver.js';

// ── Types ──────────────────────────────────────────────────

export interface ResolvedPodcastFeed {
  readonly feedUrl: string;
  readonly title?: string;
  readonly author?: string;
  readonly image?: string;
}

// ── Main resolver ──────────────────────────────────────────

/**
 * Resolve a podcast platform URL to its RSS feed URL.
 *
 * Strategy:
 * 1. Apple Podcasts → extract ID → iTunes Lookup → feedUrl
 * 2. Spotify / 小宇宙 → scrape page metadata → directory search → best match
 * 3. Generic → check if URL is RSS or has RSS link
 */
export async function resolvePodcastFeedUrl(
  url: string,
  options?: FetchPageOptions,
): Promise<ResolvedPodcastFeed | null> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Apple Podcasts
    if (hostname.includes('podcasts.apple.com') || hostname.includes('itunes.apple.com')) {
      return resolveApplePodcasts(url, options);
    }

    // Spotify or 小宇宙 — resolve via metadata search
    if (
      hostname.includes('open.spotify.com') ||
      hostname.includes('spotify.com') ||
      hostname.includes('xiaoyuzhoufm.com') ||
      hostname.includes('xyzfm.link')
    ) {
      return resolveViaMetadataSearch(url, options);
    }

    // Generic: try to fetch and check for RSS
    return resolveGenericPodcast(url, options);
  } catch {
    return null;
  }
}

// ── Apple Podcasts ─────────────────────────────────────────

async function resolveApplePodcasts(
  url: string,
  options?: FetchPageOptions,
): Promise<ResolvedPodcastFeed | null> {
  const podcastId = extractApplePodcastId(url);
  if (!podcastId) {
    return resolveViaMetadataSearch(url, options);
  }

  const result = await itunesLookup(podcastId, options);
  if (!result.feedUrl) return null;

  return {
    feedUrl: result.feedUrl,
    title: result.title ?? undefined,
    author: result.author ?? undefined,
    image: result.image ?? undefined,
  };
}

// ── Metadata search (Spotify, 小宇宙) ──────────────────────

async function resolveViaMetadataSearch(
  url: string,
  options?: FetchPageOptions,
): Promise<ResolvedPodcastFeed | null> {
  const html = await fetchPageHtml(url, options);
  if (!html) return null;

  // Try RSS link first
  const rssLink = extractRssLink(html, url);
  if (rssLink) return { feedUrl: rssLink };

  // Extract metadata from page
  const title =
    extractMetaContent(html, 'og:title') ??
    extractMetaContent(html, 'twitter:title') ??
    extractHtmlTitle(html);
  const author = extractMetaContent(html, 'og:site_name') ?? extractMetaContent(html, 'author');
  const image = extractMetaContent(html, 'og:image');

  if (!title) return null;

  // Search directory for a match
  const results = await searchPodcasts(title, 'show', 10, options);
  if (results.length === 0) return null;

  // Find the best title match
  const normalizedTitle = title.toLowerCase().trim();
  const bestMatch =
    results.find((r) => r.feedUrl && r.title.toLowerCase().trim() === normalizedTitle) ??
    results.find((r) => r.feedUrl && normalizedTitle.includes(r.title.toLowerCase().trim())) ??
    results.find((r) => r.feedUrl && r.title.toLowerCase().trim().includes(normalizedTitle)) ??
    results.find((r) => r.feedUrl);

  if (!bestMatch?.feedUrl) return null;

  return {
    feedUrl: bestMatch.feedUrl,
    title: bestMatch.title ?? title ?? undefined,
    author: bestMatch.author ?? author ?? undefined,
    image: bestMatch.image ?? image ?? undefined,
  };
}

// ── Generic podcast URL ────────────────────────────────────

async function resolveGenericPodcast(
  url: string,
  options?: FetchPageOptions,
): Promise<ResolvedPodcastFeed | null> {
  const doFetch = options?.fetchFn ?? globalThis.fetch;
  try {
    const response = await doFetch(url, {
      headers: { 'User-Agent': 'Orbit/1.0' },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';

    // Already an RSS/XML feed
    if (
      contentType.includes('application/rss+xml') ||
      contentType.includes('application/atom+xml') ||
      contentType.includes('text/xml') ||
      contentType.includes('application/xml')
    ) {
      return { feedUrl: url };
    }

    // Check HTML for RSS link
    if (contentType.includes('text/html')) {
      const html = await response.text();
      const rssLink = extractRssLink(html, url);
      if (rssLink) return { feedUrl: rssLink };
    }

    return null;
  } catch {
    return null;
  }
}

// ── HTML helper ────────────────────────────────────────────

function extractRssLink(html: string, baseUrl: string): string | null {
  // Try both attribute orders
  const linkMatch =
    html.match(/<link[^>]+rel=["']alternate["'][^>]+type=["']application\/rss\+xml["'][^>]*>/i) ??
    html.match(/<link[^>]+type=["']application\/rss\+xml["'][^>]+rel=["']alternate["'][^>]*>/i);

  if (!linkMatch) return null;

  const hrefMatch = linkMatch[0].match(/href=["']([^"']+)["']/);
  if (!hrefMatch) return null;

  try {
    return new URL(hrefMatch[1], baseUrl).toString();
  } catch {
    return null;
  }
}
