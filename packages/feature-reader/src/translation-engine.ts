// ── Translation Engine ──────────────────────────────────────
import type { IsoDateTimeString } from '@orbit/domain';
import type { GlossaryEntry } from './translation-layer.js';

// ── Engine identifiers ─────────────────────────────────────

export type TranslationEngineId = 'google' | 'bing' | 'azure' | 'llm' | 'google_free';

// ── Language pair ──────────────────────────────────────────

export interface LanguagePair {
  readonly source: string;
  readonly target: string;
}

// ── Engine config ──────────────────────────────────────────

export interface TranslationEngineConfig {
  readonly engineId: TranslationEngineId;
  readonly apiEndpoint: string;
  readonly supportedPairs: readonly LanguagePair[];
  readonly maxCharsPerRequest: number;
  readonly supportsBatch: boolean;
}

// ── Request / Response ─────────────────────────────────────

export interface TranslationRequest {
  readonly texts: readonly string[];
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly glossary?: readonly GlossaryEntry[];
}

export interface TranslationResponse {
  readonly translations: readonly string[];
  readonly detectedSourceLanguage?: string;
  readonly engineId: TranslationEngineId;
  readonly processedAt: IsoDateTimeString;
}

// ── Engine interface ───────────────────────────────────────

export interface TranslationEngine {
  readonly config: TranslationEngineConfig;
  readonly translate: (request: TranslationRequest) => Promise<TranslationResponse>;
  readonly detectLanguage: (text: string) => Promise<string>;
  readonly getSupportedLanguages: () => readonly string[];
}

// ── Utilities ──────────────────────────────────────────────

/**
 * Split text into chunks that fit within maxChars, preferring
 * paragraph then sentence boundaries.
 */
export function splitTextForTranslation(text: string, maxChars: number): readonly string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  // First try to split on double-newline (paragraphs)
  const paragraphs = text.split(/\n{2,}/);
  let current = '';

  for (const para of paragraphs) {
    const candidate = current.length > 0 ? `${current}\n\n${para}` : para;

    if (candidate.length <= maxChars) {
      current = candidate;
    } else if (current.length > 0) {
      chunks.push(current);
      // If a single paragraph exceeds maxChars, split on sentences
      if (para.length > maxChars) {
        chunks.push(...splitOnSentences(para, maxChars));
        current = '';
      } else {
        current = para;
      }
    } else {
      // Single paragraph exceeds maxChars
      chunks.push(...splitOnSentences(para, maxChars));
      current = '';
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function splitOnSentences(text: string, maxChars: number): readonly string[] {
  const sentences = text.match(/[^.!?]+[.!?]?\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current + sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current.length > 0) chunks.push(current.trimEnd());
      // Hard split if a single sentence exceeds maxChars
      if (sentence.length > maxChars) {
        for (let i = 0; i < sentence.length; i += maxChars) {
          chunks.push(sentence.slice(i, i + maxChars));
        }
        current = '';
      } else {
        current = sentence;
      }
    }
  }

  if (current.length > 0) {
    chunks.push(current.trimEnd());
  }

  return chunks;
}

/**
 * Merge multiple chunked translation responses into a single response.
 */
export function mergeTranslationResults(
  chunks: readonly TranslationResponse[],
): TranslationResponse {
  if (chunks.length === 0) {
    return {
      translations: [],
      engineId: 'google' as TranslationEngineId,
      processedAt: new Date().toISOString() as IsoDateTimeString,
    };
  }

  const allTranslations: string[] = [];
  for (const chunk of chunks) {
    allTranslations.push(...chunk.translations);
  }

  return {
    translations: allTranslations,
    detectedSourceLanguage: chunks[0].detectedSourceLanguage,
    engineId: chunks[0].engineId,
    processedAt: chunks[chunks.length - 1].processedAt,
  };
}

/**
 * Apply glossary substitutions to text. Replaces glossary terms
 * with their preferred translations (case-insensitive matching).
 */
export function applyGlossary(
  text: string,
  glossary: readonly GlossaryEntry[],
): string {
  let result = text;
  for (const entry of glossary) {
    const pattern = new RegExp(escapeRegex(entry.term), 'gi');
    result = result.replace(pattern, entry.preferredTranslation);
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
