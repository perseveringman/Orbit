// ── Content Normalizer ──────────────────────────────────────

/**
 * Strip scripts, styles, nav, and ad-like elements from raw HTML.
 * Regex-based — no DOM dependency.
 */
export function normalizeHtml(rawHtml: string): string {
  let html = rawHtml;
  // Remove script tags and content
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Remove style tags and content
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Remove noscript tags and content
  html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  // Remove nav elements
  html = html.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  // Remove common ad-related elements
  html = html.replace(/<(div|aside|section)[^>]*class\s*=\s*"[^"]*\b(ad|ads|advert|advertisement|sponsor|promo)\b[^"]*"[\s\S]*?<\/\1>/gi, '');
  // Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  // Remove iframe tags
  html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<iframe[^>]*\/>/gi, '');
  // Collapse whitespace
  html = html.replace(/\n{3,}/g, '\n\n').trim();
  return html;
}

/**
 * Split markdown into non-empty paragraphs.
 */
export function extractStructuredText(markdown: string): readonly string[] {
  return markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// CJK Unicode ranges
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f]/;
const HANGUL_REGEX = /[\uac00-\ud7af\u1100-\u11ff]/;
const KANA_REGEX = /[\u3040-\u309f\u30a0-\u30ff]/;
const CYRILLIC_REGEX = /[\u0400-\u04ff]/;
const ARABIC_REGEX = /[\u0600-\u06ff]/;

/**
 * Basic heuristic language detection.
 * Returns an ISO 639-1 code or null if not detected.
 */
export function detectLanguage(text: string): string | null {
  if (!text || text.trim().length === 0) return null;

  // Count character class occurrences
  const sample = text.slice(0, 1000);

  if (CJK_REGEX.test(sample)) {
    // Distinguish Chinese / Japanese by presence of kana
    if (KANA_REGEX.test(sample)) return 'ja';
    return 'zh';
  }
  if (HANGUL_REGEX.test(sample)) return 'ko';
  if (KANA_REGEX.test(sample)) return 'ja';
  if (CYRILLIC_REGEX.test(sample)) return 'ru';
  if (ARABIC_REGEX.test(sample)) return 'ar';

  // Default: Latin script → English (simple heuristic)
  if (/[a-zA-Z]/.test(sample)) return 'en';

  return null;
}
