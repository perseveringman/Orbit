import type { ResolverResult, RssFeedEntry, OpmlOutline } from './types.js';

export interface RssDiscoveryResult {
  readonly url: string;
  readonly title: string | null;
  readonly type: 'rss' | 'atom';
}

const RSS_EXTENSIONS_RE = /\.(?:xml|rss|atom)(?:\?|$)/i;
const RSS_PATH_HINTS_RE = /\/(?:feed|rss)(?:\/|$)/i;

export function isRssFeedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (RSS_EXTENSIONS_RE.test(parsed.pathname)) return true;
    if (RSS_PATH_HINTS_RE.test(parsed.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function discoverRssLinks(html: string, baseUrl: string): readonly RssDiscoveryResult[] {
  const results: RssDiscoveryResult[] = [];
  const linkRe = /<link\s[^>]*?>/gi;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkRe.exec(html)) !== null) {
    const tag = linkMatch[0];

    // Must have rel="alternate"
    if (!/rel\s*=\s*["']alternate["']/i.test(tag)) continue;

    const typeMatch = tag.match(/type\s*=\s*["'](application\/(?:rss|atom)\+xml)["']/i);
    if (!typeMatch) continue;

    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;

    const titleMatch = tag.match(/title\s*=\s*["']([^"']*)["']/i);

    const rawType = typeMatch[1].toLowerCase();
    const feedType: 'rss' | 'atom' = rawType.includes('atom') ? 'atom' : 'rss';

    let resolvedUrl: string;
    try {
      resolvedUrl = new URL(hrefMatch[1], baseUrl).toString();
    } catch {
      continue;
    }

    results.push({
      url: resolvedUrl,
      title: titleMatch ? titleMatch[1] : null,
      type: feedType,
    });
  }

  return results;
}

function extractTagContent(xml: string, tagName: string): string | null {
  // Handle both <tag>content</tag> and <tag><![CDATA[content]]></tag>
  const re = new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tagName}>`, 'i');
  const match = xml.match(re);
  if (!match) return null;
  const raw = match[1] ?? match[2] ?? '';
  return raw.trim() || null;
}

export function parseRssFeedXml(xml: string): {
  readonly title: string;
  readonly description: string | null;
  readonly entries: readonly RssFeedEntry[];
} {
  // Detect Atom vs RSS 2.0
  const isAtom = /<feed[\s>]/i.test(xml);

  if (isAtom) {
    return parseAtomFeed(xml);
  }
  return parseRss2Feed(xml);
}

function parseRss2Feed(xml: string): {
  readonly title: string;
  readonly description: string | null;
  readonly entries: readonly RssFeedEntry[];
} {
  const channelMatch = xml.match(/<channel>([\s\S]*)<\/channel>/i);
  const channelXml = channelMatch ? channelMatch[1] : xml;

  // Extract channel-level info (before first <item>)
  const firstItemIdx = channelXml.indexOf('<item');
  const channelHeader = firstItemIdx >= 0 ? channelXml.slice(0, firstItemIdx) : channelXml;
  const title = extractTagContent(channelHeader, 'title') ?? 'Untitled Feed';
  const description = extractTagContent(channelHeader, 'description');

  const entries: RssFeedEntry[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRe.exec(channelXml)) !== null) {
    const itemXml = itemMatch[1];
    const itemTitle = extractTagContent(itemXml, 'title') ?? 'Untitled';
    const link = extractTagContent(itemXml, 'link');
    const pubDate = extractTagContent(itemXml, 'pubDate');
    const author = extractTagContent(itemXml, 'author') ?? extractTagContent(itemXml, 'dc:creator');
    const summary = extractTagContent(itemXml, 'description');
    const enclosureMatch = itemXml.match(/<enclosure[^>]+url\s*=\s*["']([^"']+)["']/i);

    entries.push({
      title: itemTitle,
      url: link ?? '',
      publishedAt: pubDate ?? null,
      author: author ?? null,
      summary: summary ?? null,
      contentUrl: enclosureMatch ? enclosureMatch[1] : null,
    });
  }

  return { title, description, entries };
}

function parseAtomFeed(xml: string): {
  readonly title: string;
  readonly description: string | null;
  readonly entries: readonly RssFeedEntry[];
} {
  // Extract feed-level info (before first <entry>)
  const firstEntryIdx = xml.indexOf('<entry');
  const feedHeader = firstEntryIdx >= 0 ? xml.slice(0, firstEntryIdx) : xml;
  const title = extractTagContent(feedHeader, 'title') ?? 'Untitled Feed';
  const description = extractTagContent(feedHeader, 'subtitle');

  const entries: RssFeedEntry[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRe.exec(xml)) !== null) {
    const entryXml = entryMatch[1];
    const entryTitle = extractTagContent(entryXml, 'title') ?? 'Untitled';
    const linkMatch = entryXml.match(/<link[^>]+href\s*=\s*["']([^"']+)["']/i);
    const published = extractTagContent(entryXml, 'published') ?? extractTagContent(entryXml, 'updated');
    const author = extractTagContent(entryXml, 'name');
    const summary = extractTagContent(entryXml, 'summary') ?? extractTagContent(entryXml, 'content');

    entries.push({
      title: entryTitle,
      url: linkMatch ? linkMatch[1] : '',
      publishedAt: published ?? null,
      author: author ?? null,
      summary: summary ?? null,
      contentUrl: null,
    });
  }

  return { title, description, entries };
}

export function parseOpml(xml: string): readonly OpmlOutline[] {
  const outlines: OpmlOutline[] = [];
  const outlineRe = /<outline\s[^>]*?>/gi;
  let match: RegExpExecArray | null;

  while ((match = outlineRe.exec(xml)) !== null) {
    const tag = match[0];
    const xmlUrlMatch = tag.match(/xmlUrl\s*=\s*["']([^"']*)["']/i);
    if (!xmlUrlMatch) continue;

    const titleMatch = tag.match(/(?:title|text)\s*=\s*["']([^"']*)["']/i);
    const htmlUrlMatch = tag.match(/htmlUrl\s*=\s*["']([^"']*)["']/i);
    const typeMatch = tag.match(/type\s*=\s*["']([^"']*)["']/i);

    outlines.push({
      title: titleMatch ? titleMatch[1] : '',
      xmlUrl: xmlUrlMatch[1],
      htmlUrl: htmlUrlMatch ? htmlUrlMatch[1] : null,
      type: typeMatch ? typeMatch[1] : null,
    });
  }

  return outlines;
}

export function exportOpml(outlines: readonly OpmlOutline[], title?: string): string {
  const feedTitle = title ?? 'Orbit Subscriptions';
  const outlineLines = outlines.map((o) => {
    const attrs: string[] = [
      `text="${escapeXml(o.title)}"`,
      `title="${escapeXml(o.title)}"`,
      `xmlUrl="${escapeXml(o.xmlUrl)}"`,
    ];
    if (o.htmlUrl) attrs.push(`htmlUrl="${escapeXml(o.htmlUrl)}"`);
    if (o.type) attrs.push(`type="${escapeXml(o.type)}"`);
    return `      <outline ${attrs.join(' ')} />`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    `    <title>${escapeXml(feedTitle)}</title>`,
    '  </head>',
    '  <body>',
    ...outlineLines,
    '  </body>',
    '</opml>',
  ].join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function resolveRssUrl(url: string, html?: string): ResolverResult {
  if (isRssFeedUrl(url)) {
    return {
      ok: true,
      source: {
        kind: 'rss_feed',
        feedUrl: url,
        title: 'RSS Feed',
        description: null,
        language: null,
        iconUrl: null,
        metadata: { originalUrl: url },
      },
      error: null,
      resolverUsed: 'rss',
    };
  }

  if (html) {
    const discovered = discoverRssLinks(html, url);
    if (discovered.length > 0) {
      const first = discovered[0];
      return {
        ok: true,
        source: {
          kind: 'rss_feed',
          feedUrl: first.url,
          title: first.title ?? 'Discovered Feed',
          description: null,
          language: null,
          iconUrl: null,
          metadata: { originalUrl: url, discoveredFeeds: discovered },
        },
        error: null,
        resolverUsed: 'rss',
      };
    }
  }

  return {
    ok: false,
    source: null,
    error: 'No RSS feed found',
    resolverUsed: 'rss',
  };
}
