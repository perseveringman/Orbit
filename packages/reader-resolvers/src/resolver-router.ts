import type { ResolverResult } from './types.js';
import { isYouTubeUrl, resolveYouTubeUrl } from './youtube-resolver.js';
import { isPodcastUrl, resolvePodcastUrl } from './podcast-resolver.js';
import { isRssFeedUrl, discoverRssLinks, resolveRssUrl } from './rss-resolver.js';
import { isNewsletterUrl, resolveNewsletterUrl } from './newsletter-resolver.js';
import { resolveGenericUrl } from './generic-resolver.js';

export interface ResolveOptions {
  readonly url: string;
  readonly html?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export type ResolverType = 'rss' | 'youtube' | 'podcast' | 'newsletter' | 'generic';

export interface RouteResult {
  readonly resolverType: ResolverType;
  readonly result: ResolverResult;
}

/**
 * Simple URL-only router — delegates to {@link routeUrl} without HTML context.
 */
export function resolveUrl(url: string): ResolverResult {
  return routeUrl({ url }).result;
}

/**
 * Full router that accepts optional pre-fetched HTML for RSS discovery.
 *
 * Priority order:
 *  1. YouTube (URL pattern)
 *  2. Podcast platforms (Apple, Spotify, Xiaoyuzhou, generic podcast RSS)
 *  3. Direct RSS/Atom feed URL
 *  4. RSS discovery from HTML `<link rel="alternate">` tags
 *  5. Newsletter platforms (Substack, beehiiv, Buttondown, etc.)
 *  6. Generic fallback
 */
export function routeUrl(options: ResolveOptions): RouteResult {
  const { url, html } = options;

  // 1. YouTube — fast URL pattern check
  if (isYouTubeUrl(url)) {
    return { resolverType: 'youtube', result: resolveYouTubeUrl(url) };
  }

  // 2. Podcast platforms
  if (isPodcastUrl(url)) {
    return { resolverType: 'podcast', result: resolvePodcastUrl(url) };
  }

  // 3. Direct RSS/Atom feed URL (by extension or path hint)
  if (isRssFeedUrl(url)) {
    return { resolverType: 'rss', result: resolveRssUrl(url) };
  }

  // 4. If HTML is provided, attempt RSS link discovery
  if (html) {
    const discovered = discoverRssLinks(html, url);
    if (discovered.length > 0) {
      return { resolverType: 'rss', result: resolveRssUrl(url, html) };
    }
  }

  // 5. Newsletter platforms
  if (isNewsletterUrl(url)) {
    return { resolverType: 'newsletter', result: resolveNewsletterUrl(url) };
  }

  // 6. Generic fallback
  return { resolverType: 'generic', result: resolveGenericUrl(url) };
}
