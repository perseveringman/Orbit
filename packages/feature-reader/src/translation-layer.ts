// ── Translation Layer ──────────────────────────────────────
// Translation NEVER overwrites original text.

export type TranslationMode = 'paragraph_bilingual' | 'multilingual' | 'glossary_priority' | 'off';

// ── Translation pair ───────────────────────────────────────

export interface TranslationPair {
  readonly originalText: string;
  readonly translatedText: string;
  readonly paragraphIndex: number;
  readonly language: string;
}

// ── Glossary ───────────────────────────────────────────────

export interface GlossaryEntry {
  readonly term: string;
  readonly preferredTranslation: string;
  readonly context: string | null;
}

// ── Translation config ─────────────────────────────────────

export interface TranslationConfig {
  readonly sourceLanguage: string;
  readonly targetLanguages: readonly string[];
  readonly mode: TranslationMode;
  readonly glossary: readonly GlossaryEntry[];
}

// ── Bilingual paragraph ────────────────────────────────────

export interface BilingualParagraph {
  readonly index: number;
  readonly original: string;
  readonly translated: string;
  readonly language: string;
}

/**
 * Combine original paragraphs with their translation pairs into a
 * bilingual view. Translation never replaces the original.
 */
export function buildBilingualView(
  paragraphs: readonly string[],
  translations: readonly TranslationPair[],
): readonly BilingualParagraph[] {
  const translationMap = new Map<number, TranslationPair>();
  for (const tp of translations) {
    translationMap.set(tp.paragraphIndex, tp);
  }

  return paragraphs.map((text, index) => {
    const tp = translationMap.get(index);
    return {
      index,
      original: text,
      translated: tp?.translatedText ?? '',
      language: tp?.language ?? '',
    };
  });
}
