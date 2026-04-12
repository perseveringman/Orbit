import type { AnchorPayload, AnchorState } from '@orbit/domain';
import type { AnchorData } from './reading-exits.js';

// ── Text fingerprinting ────────────────────────────────────

/**
 * Create a stable hash for text content (simple djb2 algorithm).
 * Used for detecting content drift in anchors.
 */
export function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Extract context around a selection: prefix (up to 50 chars before)
 * and suffix (up to 50 chars after).
 */
export function extractContext(
  fullText: string,
  startOffset: number,
  endOffset: number,
  contextLength: number = 50,
): { readonly prefix: string; readonly suffix: string } {
  const prefixStart = Math.max(0, startOffset - contextLength);
  const suffixEnd = Math.min(fullText.length, endOffset + contextLength);
  return {
    prefix: fullText.slice(prefixStart, startOffset),
    suffix: fullText.slice(endOffset, suffixEnd),
  };
}

// ── AnchorPayload creation ─────────────────────────────────

export interface CreateAnchorOptions {
  readonly fullText: string;
  readonly selectedText: string;
  readonly anchorData: AnchorData;
  readonly sourceVersion?: string;
}

/**
 * Create an AnchorPayload from a text selection.
 * - Computes textHash from selectedText
 * - Extracts prefix/suffix context
 * - Sets initial state to 'active'
 * - Builds locator from AnchorData
 */
export function createAnchorPayload(options: CreateAnchorOptions): AnchorPayload {
  const { fullText, selectedText, anchorData, sourceVersion } = options;
  const globalStart = computeGlobalOffset(fullText, anchorData);
  const globalEnd = globalStart + (anchorData.endOffset - anchorData.startOffset);
  const ctx = extractContext(fullText, globalStart, globalEnd);

  return {
    sourceVersion,
    locator: {
      paragraphIndex: anchorData.paragraphIndex,
      startOffset: anchorData.startOffset,
      endOffset: anchorData.endOffset,
    },
    quote: selectedText,
    prefix: ctx.prefix,
    suffix: ctx.suffix,
    textHash: hashText(selectedText),
    state: 'active',
  };
}

// ── Anchor resolution (finding anchors in updated text) ────

export interface AnchorResolutionResult {
  readonly found: boolean;
  readonly state: AnchorState;
  readonly resolvedOffset?: { readonly start: number; readonly end: number };
  readonly confidence: number;
  readonly method: 'exact' | 'fuzzy' | 'context' | 'failed';
}

/**
 * Resolve an anchor in a (possibly updated) document.
 * Strategy:
 * 1. Try exact match of quote text
 * 2. Try fuzzy match (Levenshtein-based similarity)
 * 3. Try context-based match (using prefix/suffix)
 * 4. If all fail, return detached
 */
export function resolveAnchor(
  anchor: AnchorPayload,
  currentText: string,
): AnchorResolutionResult {
  // Strategy 1: Exact match
  const exactIdx = currentText.indexOf(anchor.quote);
  if (exactIdx !== -1) {
    return {
      found: true,
      state: 'active',
      resolvedOffset: { start: exactIdx, end: exactIdx + anchor.quote.length },
      confidence: 1.0,
      method: 'exact',
    };
  }

  // Strategy 2: Fuzzy match
  const fuzzy = findBestFuzzyMatch(anchor.quote, currentText, 0.7);
  if (fuzzy) {
    return {
      found: true,
      state: 'fuzzy',
      resolvedOffset: { start: fuzzy.start, end: fuzzy.end },
      confidence: fuzzy.confidence,
      method: 'fuzzy',
    };
  }

  // Strategy 3: Context-based match
  const contextResult = resolveByContext(anchor, currentText);
  if (contextResult) {
    return contextResult;
  }

  // Strategy 4: All failed
  return {
    found: false,
    state: 'detached',
    confidence: 0,
    method: 'failed',
  };
}

// ── Fuzzy matching helpers ─────────────────────────────────

/**
 * Compute similarity between two strings (0.0-1.0).
 * Uses bigram similarity for performance.
 */
export function computeSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0.0;
  if (a === b) return 1.0;
  if (a.length === 1 && b.length === 1) return a === b ? 1.0 : 0.0;

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  if (bigramsA.size === 0 && bigramsB.size === 0) return a === b ? 1.0 : 0.0;

  let intersectionSize = 0;
  for (const [bigram, countA] of bigramsA) {
    const countB = bigramsB.get(bigram) ?? 0;
    intersectionSize += Math.min(countA, countB);
  }

  let totalA = 0;
  for (const c of bigramsA.values()) totalA += c;
  let totalB = 0;
  for (const c of bigramsB.values()) totalB += c;

  return (2 * intersectionSize) / (totalA + totalB);
}

/**
 * Find the best fuzzy match for a query string within a text.
 * Returns the position and confidence score.
 * Threshold is the minimum similarity to consider a match (default 0.7).
 */
export function findBestFuzzyMatch(
  query: string,
  text: string,
  threshold: number = 0.7,
): { readonly start: number; readonly end: number; readonly confidence: number } | null {
  if (query.length === 0 || text.length === 0) return null;

  const windowSize = query.length;
  const minWindow = Math.max(1, Math.floor(windowSize * 0.8));
  const maxWindow = Math.ceil(windowSize * 1.2);

  let bestMatch: { start: number; end: number; confidence: number } | null = null;

  for (let winLen = minWindow; winLen <= maxWindow; winLen++) {
    if (winLen > text.length) continue;
    for (let i = 0; i <= text.length - winLen; i++) {
      const candidate = text.slice(i, i + winLen);
      const similarity = computeSimilarity(query, candidate);
      if (similarity >= threshold && (bestMatch === null || similarity > bestMatch.confidence)) {
        bestMatch = { start: i, end: i + winLen, confidence: similarity };
      }
    }
  }

  return bestMatch;
}

// ── Anchor state management ────────────────────────────────

/**
 * Update an anchor's state based on resolution result.
 */
export function updateAnchorState(
  anchor: AnchorPayload,
  resolution: AnchorResolutionResult,
): AnchorPayload {
  return {
    ...anchor,
    state: resolution.state,
  };
}

/**
 * Batch-resolve multiple anchors against a document.
 */
export function resolveAnchors(
  anchors: readonly AnchorPayload[],
  currentText: string,
): readonly AnchorResolutionResult[] {
  return anchors.map((a) => resolveAnchor(a, currentText));
}

// ── Internal helpers ───────────────────────────────────────

function getBigrams(str: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < str.length - 1; i++) {
    const bigram = str.slice(i, i + 2);
    map.set(bigram, (map.get(bigram) ?? 0) + 1);
  }
  return map;
}

function computeGlobalOffset(fullText: string, anchorData: AnchorData): number {
  const paragraphs = fullText.split('\n');
  let offset = 0;
  for (let i = 0; i < anchorData.paragraphIndex && i < paragraphs.length; i++) {
    offset += paragraphs[i].length + 1; // +1 for the newline
  }
  return offset + anchorData.startOffset;
}

function resolveByContext(
  anchor: AnchorPayload,
  currentText: string,
): AnchorResolutionResult | null {
  const prefix = anchor.prefix ?? '';
  const suffix = anchor.suffix ?? '';
  if (prefix.length === 0 && suffix.length === 0) return null;

  // Try to find prefix+suffix pattern in text
  const searchPattern = prefix + suffix;
  if (searchPattern.length === 0) return null;

  const prefixIdx = prefix.length > 0 ? currentText.indexOf(prefix) : -1;

  if (prefixIdx !== -1 && prefix.length > 0) {
    const potentialStart = prefixIdx + prefix.length;
    const quoteLen = anchor.quote.length;
    const potentialEnd = Math.min(potentialStart + quoteLen, currentText.length);
    const candidate = currentText.slice(potentialStart, potentialEnd);
    const similarity = computeSimilarity(anchor.quote, candidate);

    if (similarity >= 0.5) {
      return {
        found: true,
        state: 'fuzzy',
        resolvedOffset: { start: potentialStart, end: potentialEnd },
        confidence: similarity * 0.8, // lower confidence for context-based
        method: 'context',
      };
    }
  }

  return null;
}
