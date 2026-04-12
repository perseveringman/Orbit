// ── Processing Depth Policy ─────────────────────────────────
import type { ContentOrigin, ProcessingDepth, ContentMediaType } from '@orbit/domain';

// ── Depth determination ─────────────────────────────────────

export interface ProcessingDepthInput {
  readonly origin: ContentOrigin;
  readonly activeLinkCount: number;
  readonly proposedLinkCount: number;
  readonly sourceEndpointQuality: number;
  readonly mediaType: ContentMediaType;
}

export function determineProcessingDepth(input: ProcessingDepthInput): ProcessingDepth {
  switch (input.origin) {
    case 'user_save':
      return 'deep';
    case 'import':
      return 'standard';
    case 'agent_recommend':
      return input.activeLinkCount >= 3 ? 'deep' : 'standard';
    case 'feed_auto': {
      if (input.activeLinkCount >= 5) return 'deep';
      if (input.activeLinkCount >= 3) return 'standard';
      return 'lightweight';
    }
  }
}

// ── Pipeline step config ────────────────────────────────────

export interface PipelineStepConfig {
  readonly name: string;
  readonly required: boolean;
}

export function buildPipelineSteps(
  depth: ProcessingDepth,
  hasTranscription: boolean,
): readonly PipelineStepConfig[] {
  const steps: PipelineStepConfig[] = [];

  switch (depth) {
    case 'lightweight':
      steps.push(
        { name: 'fetch', required: true },
        { name: 'normalize', required: true },
        { name: 'summarize', required: true },
      );
      break;
    case 'standard':
      steps.push(
        { name: 'fetch', required: true },
        { name: 'normalize', required: true },
        { name: 'extract', required: true },
        { name: 'index_fts', required: true },
      );
      break;
    case 'deep':
      steps.push(
        { name: 'fetch', required: true },
        { name: 'normalize', required: true },
        { name: 'extract', required: true },
        { name: 'index_fts', required: true },
      );
      if (hasTranscription) {
        steps.push(
          { name: 'transcribe', required: false },
          { name: 'translate', required: false },
        );
      }
      steps.push(
        { name: 'index_vector', required: true },
        { name: 'extract_entities', required: true },
        { name: 'suggest_links', required: true },
      );
      break;
  }

  return steps;
}
