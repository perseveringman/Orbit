/**
 * Common HTTP fetch helpers for reader-resolvers.
 * All functions accept an optional `fetchFn` parameter so callers can inject
 * a custom fetch (e.g. CORS-proxied) or use the global `fetch` by default.
 */

export type FetchFn = typeof globalThis.fetch;

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export const BOT_UA = 'Orbit/1.0';

export interface FetchPageOptions {
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly fetchFn?: FetchFn;
}

/**
 * Fetch a page's HTML content with sensible defaults.
 */
export async function fetchPageHtml(
  url: string,
  options?: FetchPageOptions,
): Promise<string | null> {
  const doFetch = options?.fetchFn ?? globalThis.fetch;
  try {
    const res = await doFetch(url, {
      headers: {
        'User-Agent': options?.userAgent ?? BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 15_000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

/**
 * Fetch JSON from a URL.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options?: FetchPageOptions,
): Promise<T | null> {
  const doFetch = options?.fetchFn ?? globalThis.fetch;
  try {
    const res = await doFetch(url, {
      headers: {
        'User-Agent': options?.userAgent ?? BOT_UA,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 10_000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── HTML meta extraction helpers ───────────────────────────

export function extractMetaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // property="..." content="..."
  const propMatch = html.match(
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
  );
  if (propMatch) return propMatch[1];

  // name="..." content="..."
  const nameMatch = html.match(
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
  );
  if (nameMatch) return nameMatch[1];

  // content before property (reversed attribute order)
  const revMatch = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      'i',
    ),
  );
  return revMatch?.[1] ?? null;
}

export function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Strip all HTML tags, collapse whitespace.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Truncate text to a maximum length, appending "..." if truncated.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
