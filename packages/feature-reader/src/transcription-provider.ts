// ── Transcription Provider ──────────────────────────────────
import type { IsoDateTimeString } from '@orbit/domain';
import type { Transcript } from './transcription-layer.js';

// ── Provider config ────────────────────────────────────────

export interface TranscriptionProviderConfig {
  readonly providerId: string;
  readonly apiEndpoint: string;
  readonly supportedLanguages: readonly string[];
  readonly maxAudioDurationSeconds: number;
}

// ── Audio source ───────────────────────────────────────────

export interface AudioSource {
  readonly url?: string;
  readonly localPath?: string;
  readonly mimeType: string;
  readonly durationSeconds: number;
  readonly language?: string;
}

// ── Job status ─────────────────────────────────────────────

export type TranscriptionJobState = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface TranscriptionJobStatus {
  readonly jobId: string;
  readonly state: TranscriptionJobState;
  readonly progress: number;
  readonly result?: Transcript;
  readonly error?: string;
}

// ── Transcription result ───────────────────────────────────

export interface TranscriptionResult {
  readonly jobId: string;
  readonly transcript: Transcript;
  readonly providerId: string;
  readonly processedAt: IsoDateTimeString;
}

// ── Provider interface ─────────────────────────────────────

export interface TranscriptionProvider {
  readonly config: TranscriptionProviderConfig;
  readonly transcribe: (audioSource: AudioSource) => Promise<TranscriptionResult>;
  readonly getStatus: (jobId: string) => Promise<TranscriptionJobStatus>;
  readonly cancel: (jobId: string) => Promise<boolean>;
}

// ── Utilities ──────────────────────────────────────────────

let jobCounter = 0;

export function createTranscriptionJobId(): string {
  jobCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `txn-${ts}-${rand}-${jobCounter}`;
}

export function validateAudioSource(
  source: AudioSource,
): { readonly valid: boolean; readonly error?: string } {
  if (!source.url && !source.localPath) {
    return { valid: false, error: 'Either url or localPath must be provided' };
  }
  if (source.durationSeconds <= 0) {
    return { valid: false, error: 'durationSeconds must be positive' };
  }
  if (!source.mimeType || source.mimeType.trim().length === 0) {
    return { valid: false, error: 'mimeType is required' };
  }
  return { valid: true };
}
