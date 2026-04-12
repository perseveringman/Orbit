// ── Media Processor ─────────────────────────────────────────

// ── Config ──────────────────────────────────────────────────

export interface MediaProcessorConfig {
  readonly tempDir: string;
  readonly maxFileSizeMb: number;
  readonly supportedFormats: readonly string[];
}

// ── Results / Info ──────────────────────────────────────────

export interface AudioExtractionResult {
  readonly audioPath: string;
  readonly format: string;
  readonly durationSeconds: number;
  readonly sampleRate: number;
  readonly channels: number;
}

export interface MediaInfo {
  readonly duration: number;
  readonly format: string;
  readonly hasAudio: boolean;
  readonly hasVideo: boolean;
  readonly fileSize: number;
}

// ── Processor interface ─────────────────────────────────────

export interface MediaProcessor {
  readonly config: MediaProcessorConfig;
  readonly extractAudio: (videoPath: string) => Promise<AudioExtractionResult>;
  readonly getMediaInfo: (filePath: string) => Promise<MediaInfo>;
  readonly isSupported: (filePath: string) => boolean;
}

// ── FFmpeg helpers ──────────────────────────────────────────

export interface FfmpegOptions {
  readonly codec?: string;
  readonly bitrate?: string;
  readonly sampleRate?: number;
  readonly channels?: number;
}

/**
 * Build ffmpeg command arguments for audio extraction / conversion.
 */
export function buildFfmpegArgs(
  input: string,
  output: string,
  options?: FfmpegOptions,
): readonly string[] {
  const args: string[] = ['-i', input];

  if (options?.codec) {
    args.push('-acodec', options.codec);
  }
  if (options?.bitrate) {
    args.push('-b:a', options.bitrate);
  }
  if (options?.sampleRate) {
    args.push('-ar', String(options.sampleRate));
  }
  if (options?.channels) {
    args.push('-ac', String(options.channels));
  }

  // Overwrite output without asking
  args.push('-y', output);

  return args;
}

/**
 * Estimate output file size in bytes from duration and bitrate.
 */
export function estimateOutputSize(
  durationSeconds: number,
  bitrateKbps: number,
): number {
  return Math.ceil((durationSeconds * bitrateKbps * 1000) / 8);
}
