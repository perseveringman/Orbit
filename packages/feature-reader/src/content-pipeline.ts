// ── Content Fetching & Extraction Pipeline ─────────────────
import type { IsoDateTimeString } from '@orbit/domain';

// ── Fetch result ───────────────────────────────────────────

export interface FetchResult {
  readonly rawHtml: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly statusCode: number;
  readonly fetchedAt: IsoDateTimeString;
}

export interface ContentFetcher {
  readonly fetch: (url: string) => Promise<FetchResult>;
}

// ── Extraction result ──────────────────────────────────────

export interface ExtractionResult {
  readonly title: string;
  readonly author: string | null;
  readonly contentMarkdown: string;
  readonly language: string | null;
  readonly publishedAt: IsoDateTimeString | null;
  readonly wordCount: number;
  readonly excerpt: string | null;
}

export interface ContentExtractor {
  readonly extract: (rawHtml: string, url: string) => ExtractionResult;
}

// ── Pipeline step tracking ─────────────────────────────────

export type PipelineStepName = 'fetch' | 'extract' | 'normalize' | 'store';

export type PipelineStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface PipelineStep {
  readonly name: PipelineStepName;
  readonly status: PipelineStepStatus;
  readonly startedAt: IsoDateTimeString | null;
  readonly completedAt: IsoDateTimeString | null;
  readonly error: string | null;
}

export function createPipelineStep(name: PipelineStepName): PipelineStep {
  return {
    name,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
  };
}

export function markStepRunning(step: PipelineStep): PipelineStep {
  return {
    ...step,
    status: 'running',
    startedAt: new Date().toISOString() as IsoDateTimeString,
  };
}

export function markStepSuccess(step: PipelineStep): PipelineStep {
  return {
    ...step,
    status: 'success',
    completedAt: new Date().toISOString() as IsoDateTimeString,
  };
}

export function markStepFailed(step: PipelineStep, error: string): PipelineStep {
  return {
    ...step,
    status: 'failed',
    completedAt: new Date().toISOString() as IsoDateTimeString,
    error,
  };
}

// ── Retry logic types ──────────────────────────────────────

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
};

export function computeRetryDelay(attempt: number, policy: RetryPolicy): number {
  const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt);
  return Math.min(delay, policy.maxDelayMs);
}

export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
  return attempt < policy.maxRetries;
}

// ── Content pipeline interface ─────────────────────────────

export interface PipelineResult {
  readonly steps: readonly PipelineStep[];
  readonly fetchResult: FetchResult | null;
  readonly extractionResult: ExtractionResult | null;
  readonly success: boolean;
}

export interface ContentPipeline {
  readonly process: (url: string) => Promise<PipelineResult>;
  readonly retryPolicy: RetryPolicy;
}
