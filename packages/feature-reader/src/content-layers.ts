// ── Four-Layer Content Separation ──────────────────────────
import type { IsoDateTimeString } from '@orbit/domain';

// ── Layer 1: Raw ───────────────────────────────────────────

export interface RawLayer {
  readonly content: string;
  readonly mimeType: string;
  readonly hash: string;
  readonly size: number;
  readonly fetchedAt: IsoDateTimeString;
}

// ── Layer 2: Readable ──────────────────────────────────────

export interface ReadableLayer {
  readonly markdown: string;
  readonly cleanedHtml: string | null;
  readonly structuredText: string;
  readonly normalizedAt: IsoDateTimeString;
}

// ── Layer 3: Metadata ──────────────────────────────────────

export interface MetadataLayer {
  readonly title: string;
  readonly author: string | null;
  readonly language: string | null;
  readonly publishedAt: IsoDateTimeString | null;
  readonly wordCount: number;
  readonly readingTimeMinutes: number;
  readonly tags: readonly string[];
  readonly sourceUrl: string | null;
}

export function estimateReadingTime(wordCount: number): number {
  const wordsPerMinute = 238;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

// ── Layer 4: Derived ───────────────────────────────────────

export interface DerivedLayer {
  readonly aiSummary: string | null;
  readonly keyQuotes: readonly string[];
  readonly topics: readonly string[];
  readonly translatedContent: string | null;
  readonly translationLanguage: string | null;
  readonly generatedAt: IsoDateTimeString | null;
}

// ── Content Bundle ─────────────────────────────────────────

export interface ContentBundle {
  readonly id: string;
  readonly raw: RawLayer;
  readonly readable: ReadableLayer;
  readonly metadata: MetadataLayer;
  readonly derived: DerivedLayer | null;
}

export function createContentBundle(
  id: string,
  raw: RawLayer,
  readable: ReadableLayer,
  metadata: MetadataLayer,
): ContentBundle {
  return { id, raw, readable, metadata, derived: null };
}

export function addDerivedContent(bundle: ContentBundle, derived: DerivedLayer): ContentBundle {
  return { ...bundle, derived };
}
