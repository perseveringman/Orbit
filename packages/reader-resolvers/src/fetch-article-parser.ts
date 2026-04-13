/**
 * Article content parsing — lightweight Readability-style extraction.
 * In production, consider using @postlight/parser or mozilla/readability.
 * This module provides a self-contained parser that works in any JS runtime.
 */

import type { FetchPageOptions } from './fetch-helpers.js';
import { fetchPageHtml, stripHtml, extractMetaContent, extractHtmlTitle } from './fetch-helpers.js';

// ── Types ──────────────────────────────────────────────────

export interface ParsedArticle {
  readonly title: string | null;
  readonly content: string | null;
  readonly contentText: string | null;
  readonly author: string | null;
  readonly domain: string | null;
  readonly wordCount: number;
  readonly readingTimeMinutes: number;
  readonly excerpt: string | null;
  readonly leadImageUrl: string | null;
  readonly language: string | null;
  readonly publishedAt: string | null;
}

// ── Main parser ────────────────────────────────────────────

/**
 * Fetch and parse article content from a URL.
 * Extracts metadata from og: tags and attempts to identify the main content block.
 */
export async function parseArticleContent(
  url: string,
  options?: FetchPageOptions,
): Promise<ParsedArticle | null> {
  const html = await fetchPageHtml(url, options);
  if (!html) return null;

  return parseArticleFromHtml(html, url);
}

/**
 * Parse article content from pre-fetched HTML (no network call).
 */
export function parseArticleFromHtml(html: string, url: string): ParsedArticle {
  // Title
  const title =
    extractMetaContent(html, 'og:title') ??
    extractMetaContent(html, 'twitter:title') ??
    extractHtmlTitle(html);

  // Author
  const author =
    extractMetaContent(html, 'author') ??
    extractMetaContent(html, 'article:author') ??
    extractMetaContent(html, 'og:site_name');

  // Language
  const langMatch = html.match(/<html[^>]*\slang\s*=\s*["']([^"']*)["']/i);
  const language = langMatch ? langMatch[1].trim() || null : null;

  // Image
  const leadImageUrl =
    extractMetaContent(html, 'og:image') ?? extractMetaContent(html, 'twitter:image');

  // Description / excerpt
  const excerpt =
    extractMetaContent(html, 'og:description') ?? extractMetaContent(html, 'description');

  // Published date
  const publishedAt =
    extractMetaContent(html, 'article:published_time') ??
    extractMetaContent(html, 'date') ??
    extractMetaContent(html, 'pubdate');

  // Content extraction: try to find <article> or main content block
  const content = extractMainContent(html);
  const contentText = content ? stripHtml(content) : null;

  // Word count & reading time
  const wordCount = estimateWordCount(contentText);
  const readingTimeMinutes = Math.ceil(wordCount / 200);

  // Domain
  let domain: string | null = null;
  try {
    domain = new URL(url).hostname;
  } catch {
    // invalid URL
  }

  return {
    title,
    content: content ? normalizeImageUrls(content, url) : null,
    contentText,
    author,
    domain,
    wordCount,
    readingTimeMinutes,
    excerpt,
    leadImageUrl: leadImageUrl ? toAbsoluteUrl(leadImageUrl, url) : null,
    language,
    publishedAt,
  };
}

// ── Content extraction ─────────────────────────────────────

function extractMainContent(html: string): string | null {
  // Strategy: try <article>, then <main>, then <div class="content">, etc.
  const strategies = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*(?:content|article|post-body|entry-content|post-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*(?:content|article|post-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const re of strategies) {
    const match = html.match(re);
    if (match && match[1] && stripHtml(match[1]).length > 200) {
      return match[1];
    }
  }

  // Fallback: extract body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : null;
}

// ── URL normalization ──────────────────────────────────────

function toAbsoluteUrl(rawUrl: string, baseUrl: string): string {
  const value = rawUrl.trim();
  if (!value) return rawUrl;
  if (/^(#|data:|javascript:|mailto:|tel:)/i.test(value)) return rawUrl;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

function normalizeImageUrls(html: string, baseUrl: string): string {
  return html.replace(/<(img|source)\b[^>]*>/gi, (tag) => {
    return tag.replace(
      /(\s(?:src|data-src|poster)=['"])([^'"]+)(['"])/gi,
      (_, p1: string, p2: string, p3: string) => `${p1}${toAbsoluteUrl(p2, baseUrl)}${p3}`,
    );
  });
}

// ── Text stats ─────────────────────────────────────────────

function estimateWordCount(text: string | null): number {
  if (!text) return 0;

  // Count CJK characters (each ≈ 1 word)
  const cjkChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
  const cjkCount = cjkChars?.length ?? 0;

  // Count Latin words
  const withoutCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ');
  const latinWords = withoutCjk.split(/\s+/).filter((w) => w.length > 0);

  return cjkCount + latinWords.length;
}
