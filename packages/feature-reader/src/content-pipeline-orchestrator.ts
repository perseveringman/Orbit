// ── Content Pipeline Orchestrator ────────────────────────────
import type { IsoDateTimeString } from '@orbit/domain';
import type {
  ContentFetcher,
  ContentExtractor,
  FetchResult,
  ExtractionResult,
  PipelineResult,
  ContentPipeline,
  RetryPolicy,
  PipelineStep,
} from './content-pipeline.js';
import {
  createPipelineStep,
  markStepRunning,
  markStepSuccess,
  markStepFailed,
  DEFAULT_RETRY_POLICY,
  computeRetryDelay,
  shouldRetry,
} from './content-pipeline.js';
import type { RawLayer, ReadableLayer, MetadataLayer, ContentBundle } from './content-layers.js';
import { estimateReadingTime, createContentBundle } from './content-layers.js';
import { transition } from './content-state-machine.js';
import type { AnyContentState } from './content-state-machine.js';
import { normalizeHtml, extractStructuredText } from './content-normalizer.js';

// ── Helpers ─────────────────────────────────────────────────

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function nowIso(): IsoDateTimeString {
  return new Date().toISOString() as IsoDateTimeString;
}

function buildRawLayer(fetchResult: FetchResult): RawLayer {
  return {
    content: fetchResult.rawHtml,
    mimeType: fetchResult.headers['content-type'] ?? 'text/html',
    hash: simpleHash(fetchResult.rawHtml),
    size: fetchResult.rawHtml.length,
    fetchedAt: fetchResult.fetchedAt,
  };
}

function buildReadableLayer(extraction: ExtractionResult): ReadableLayer {
  return {
    markdown: extraction.contentMarkdown,
    cleanedHtml: null,
    structuredText: extractStructuredText(extraction.contentMarkdown).join('\n\n'),
    normalizedAt: nowIso(),
  };
}

function buildMetadataLayer(extraction: ExtractionResult, url: string): MetadataLayer {
  return {
    title: extraction.title,
    author: extraction.author,
    language: extraction.language,
    publishedAt: extraction.publishedAt,
    wordCount: extraction.wordCount,
    readingTimeMinutes: estimateReadingTime(extraction.wordCount),
    tags: [],
    sourceUrl: url,
  };
}

// ── Sleep helper (for retry delays) ─────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Default implementation ──────────────────────────────────

class DefaultContentPipeline implements ContentPipeline {
  readonly retryPolicy: RetryPolicy;

  private readonly fetcher: ContentFetcher;
  private readonly extractor: ContentExtractor;

  constructor(
    fetcher: ContentFetcher,
    extractor: ContentExtractor,
    retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
  ) {
    this.fetcher = fetcher;
    this.extractor = extractor;
    this.retryPolicy = retryPolicy;
  }

  readonly process = async (url: string): Promise<PipelineResult> => {
    let fetchStep: PipelineStep = createPipelineStep('fetch');
    let extractStep: PipelineStep = createPipelineStep('extract');
    let normalizeStep: PipelineStep = createPipelineStep('normalize');
    let storeStep: PipelineStep = createPipelineStep('store');

    let fetchResult: FetchResult | null = null;
    let extractionResult: ExtractionResult | null = null;
    let contentState: AnyContentState = 'queued';

    // ── Step 1: Fetch (with retry) ──────────────────────────
    fetchStep = markStepRunning(fetchStep);
    contentState = transition(contentState, 'fetching', 'pipeline.fetch').newStatus;

    let attempt = 0;
    let lastError: Error | null = null;

    while (true) {
      try {
        fetchResult = await this.fetcher.fetch(url);
        fetchStep = markStepSuccess(fetchStep);
        contentState = transition(contentState, 'fetched', 'pipeline.fetch.success').newStatus;
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (shouldRetry(attempt, this.retryPolicy)) {
          const delay = computeRetryDelay(attempt, this.retryPolicy);
          await sleep(delay);
          attempt++;
        } else {
          fetchStep = markStepFailed(fetchStep, lastError.message);
          contentState = transition(contentState, 'fetch_failed', 'pipeline.fetch.failed').newStatus;
          return {
            steps: [fetchStep, extractStep, normalizeStep, storeStep],
            fetchResult: null,
            extractionResult: null,
            success: false,
          };
        }
      }
    }

    // ── Step 2: Normalize ───────────────────────────────────
    normalizeStep = markStepRunning(normalizeStep);
    contentState = transition(contentState, 'normalizing', 'pipeline.normalize').newStatus;
    try {
      normalizeHtml(fetchResult.rawHtml);
      normalizeStep = markStepSuccess(normalizeStep);
      contentState = transition(contentState, 'normalized', 'pipeline.normalize.success').newStatus;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      normalizeStep = markStepFailed(normalizeStep, msg);
      contentState = transition(contentState, 'extract_failed', 'pipeline.normalize.failed').newStatus;
      return {
        steps: [fetchStep, extractStep, normalizeStep, storeStep],
        fetchResult,
        extractionResult: null,
        success: false,
      };
    }

    // ── Step 3: Extract ─────────────────────────────────────
    extractStep = markStepRunning(extractStep);
    contentState = transition(contentState === 'extract_failed' ? 'fetched' : contentState, 'extracting', 'pipeline.extract').newStatus;
    try {
      extractionResult = this.extractor.extract(fetchResult.rawHtml, url);
      extractStep = markStepSuccess(extractStep);
      contentState = transition(contentState, 'extracted', 'pipeline.extract.success').newStatus;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      extractStep = markStepFailed(extractStep, msg);
      return {
        steps: [fetchStep, extractStep, normalizeStep, storeStep],
        fetchResult,
        extractionResult: null,
        success: false,
      };
    }

    // ── Step 4: Store (build content bundle) ────────────────
    storeStep = markStepRunning(storeStep);
    try {
      const raw = buildRawLayer(fetchResult);
      const readable = buildReadableLayer(extractionResult);
      const metadata = buildMetadataLayer(extractionResult, url);
      // Build the bundle (side-effect free — just validation)
      createContentBundle(`bundle-${simpleHash(url)}`, raw, readable, metadata);
      storeStep = markStepSuccess(storeStep);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      storeStep = markStepFailed(storeStep, msg);
      return {
        steps: [fetchStep, extractStep, normalizeStep, storeStep],
        fetchResult,
        extractionResult,
        success: false,
      };
    }

    return {
      steps: [fetchStep, extractStep, normalizeStep, storeStep],
      fetchResult,
      extractionResult,
      success: true,
    };
  };
}

// ── Factory ─────────────────────────────────────────────────

export function createContentPipeline(
  fetcher: ContentFetcher,
  extractor: ContentExtractor,
  retryPolicy?: RetryPolicy,
): ContentPipeline {
  return new DefaultContentPipeline(fetcher, extractor, retryPolicy);
}
