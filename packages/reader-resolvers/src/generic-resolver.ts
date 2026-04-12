import type { ResolverResult } from './types.js';

export interface ExtractedMetadata {
  readonly title: string | null;
  readonly description: string | null;
  readonly author: string | null;
  readonly language: string | null;
  readonly imageUrl: string | null;
  readonly publishedAt: string | null;
  readonly siteName: string | null;
}

function extractMetaContent(html: string, nameOrProperty: string): string | null {
  // Match both name="..." and property="..." meta tags
  const re = new RegExp(
    `<meta\\s[^>]*?(?:name|property)\\s*=\\s*["']${escapeRegex(nameOrProperty)}["'][^>]*?>`,
    'i',
  );
  const match = html.match(re);
  if (!match) return null;

  const contentMatch = match[0].match(/content\s*=\s*["']([^"']*)["']/i);
  return contentMatch ? contentMatch[1].trim() || null : null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractMetadataFromHtml(html: string, url: string): ExtractedMetadata {
  // Title: og:title > <title>
  const ogTitle = extractMetaContent(html, 'og:title');
  const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = ogTitle ?? (titleTagMatch ? titleTagMatch[1].trim() || null : null);

  // Description: og:description > meta description
  const description =
    extractMetaContent(html, 'og:description') ?? extractMetaContent(html, 'description');

  // Author
  const author =
    extractMetaContent(html, 'author') ?? extractMetaContent(html, 'article:author');

  // Language: html lang or og:locale
  const langMatch = html.match(/<html[^>]*\slang\s*=\s*["']([^"']*)["']/i);
  const language = langMatch ? langMatch[1].trim() || null : (extractMetaContent(html, 'og:locale') ?? null);

  // Image
  const imageUrl =
    extractMetaContent(html, 'og:image') ?? extractMetaContent(html, 'twitter:image');

  // Published at
  const publishedAt =
    extractMetaContent(html, 'article:published_time') ??
    extractMetaContent(html, 'date') ??
    extractMetaContent(html, 'pubdate');

  // Site name
  const siteName = extractMetaContent(html, 'og:site_name');

  return { title, description, author, language, imageUrl, publishedAt, siteName };
}

export function resolveGenericUrl(url: string): ResolverResult {
  return {
    ok: true,
    source: {
      kind: 'manual_url',
      feedUrl: null,
      title: url,
      description: null,
      language: null,
      iconUrl: null,
      metadata: { originalUrl: url },
    },
    error: null,
    resolverUsed: 'generic',
  };
}
