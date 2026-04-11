import type { SyncCheckpointDto, SyncPullRequestDto, SyncPullResponseDto, SyncPushRequestDto } from '@orbit/api-types';
import type { MutationEnvelope } from '@orbit/data-protocol';

export interface SyncPlanInput {
  readonly workspaceId: string;
  readonly deviceId: string;
  readonly checkpoint: SyncCheckpointDto;
  readonly pendingMutations: readonly MutationEnvelope[];
  readonly pullLimit: number;
}

export interface SyncPlan {
  readonly pullRequest: SyncPullRequestDto;
  readonly pushRequest: SyncPushRequestDto<MutationEnvelope>;
}

export function buildSyncPlan(input: SyncPlanInput): SyncPlan {
  return {
    pullRequest: {
      workspaceId: input.workspaceId,
      deviceId: input.deviceId,
      cursor: input.checkpoint.cursor,
      limit: input.pullLimit,
    },
    pushRequest: {
      workspaceId: input.workspaceId,
      deviceId: input.deviceId,
      baseCursor: input.checkpoint.cursor,
      mutations: [...input.pendingMutations],
    },
  };
}

export function shouldRequestAnotherPage(response: SyncPullResponseDto): boolean {
  return response.hasMore;
}

export function getNextCheckpoint(response: Pick<SyncPullResponseDto, 'checkpoint'>): SyncCheckpointDto {
  return response.checkpoint;
}

// ── Wave 2-D re-exports ────────────────────────────────────────────
export * from './sync-channels.js';
export * from './sync-types.js';
export * from './lww-merge.js';
export * from './three-way-merge.js';
export * from './encryption.js';
export * from './blob-cas.js';
export * from './recovery-phrase.js';
export * from './outbox.js';
export * from './non-sync-items.js';
