import type { SyncCheckpointDto, SyncPullRequestDto, SyncPullResponseDto, SyncPushRequestDto } from '@orbit/api-types';
import type { MutationEnvelope } from '@orbit/data-protocol';

export interface SyncPlanInput<TPayload = Record<string, unknown>> {
  readonly workspaceId: string;
  readonly deviceId: string;
  readonly checkpoint: SyncCheckpointDto;
  readonly pendingMutations: readonly MutationEnvelope<string, TPayload>[];
  readonly pullLimit: number;
}

export interface SyncPlan<TPayload = Record<string, unknown>> {
  readonly pullRequest: SyncPullRequestDto;
  readonly pushRequest: SyncPushRequestDto<MutationEnvelope<string, TPayload>>;
}

export function buildSyncPlan<TPayload>(input: SyncPlanInput<TPayload>): SyncPlan<TPayload> {
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
