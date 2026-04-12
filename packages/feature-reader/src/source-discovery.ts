// ── Source Discovery ────────────────────────────────────────
import type { IsoDateTimeString } from '@orbit/domain';

// ── RSS Feed Discovery ─────────────────────────────────────

export interface RssDiscoveryResult {
  readonly feedUrl: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly siteUrl: string;
}

/**
 * Parse HTML to discover RSS/Atom feed links via
 * `<link rel="alternate" type="application/rss+xml">` and
 * `<link rel="alternate" type="application/atom+xml">`.
 */
export function discoverRssFeeds(pageUrl: string, html: string): readonly RssDiscoveryResult[] {
  const results: RssDiscoveryResult[] = [];

  const linkRegex = /<link\s[^>]*rel\s*=\s*["']alternate["'][^>]*>/gi;
  const typeRegex = /type\s*=\s*["'](application\/(?:rss|atom)\+xml)["']/i;
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/i;
  const titleRegex = /title\s*=\s*["']([^"']*)["']/i;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0];
    if (!typeRegex.test(tag)) continue;

    const hrefMatch = hrefRegex.exec(tag);
    if (!hrefMatch) continue;

    const rawHref = hrefMatch[1];
    const feedUrl = rawHref.startsWith('http') ? rawHref : new URL(rawHref, pageUrl).href;

    const titleMatch = titleRegex.exec(tag);

    results.push({
      feedUrl,
      title: titleMatch ? titleMatch[1] : null,
      description: null,
      siteUrl: pageUrl,
    });
  }

  return results;
}

// ── Site Watch ─────────────────────────────────────────────

export interface SiteWatchRule {
  readonly url: string;
  readonly selector: string | null;
  readonly checkIntervalMinutes: number;
  readonly lastHash: string | null;
  readonly lastCheckedAt: IsoDateTimeString | null;
}

export function createSiteWatch(url: string, selector?: string): SiteWatchRule {
  return {
    url,
    selector: selector ?? null,
    checkIntervalMinutes: 60,
    lastHash: null,
    lastCheckedAt: null,
  };
}

// ── Social Digest ──────────────────────────────────────────

export interface SocialDigestConfig {
  readonly sources: readonly string[];
  readonly digestFrequency: 'daily' | 'weekly';
  readonly filterKeywords: readonly string[];
  readonly maxItemsPerDigest: number;
  readonly includeReposts: boolean;
}
