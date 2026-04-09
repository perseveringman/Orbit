import type { OrbitObjectKind } from '@orbit/domain';

export const API_VERSION = '2026-01-01';

export interface AuthSessionDto {
  readonly userId: string;
  readonly workspaceId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
}

export interface DeviceRegistrationDto {
  readonly deviceId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly platform: 'desktop' | 'ios' | 'web' | 'server';
  readonly appVersion: string;
  readonly capabilityIds: readonly string[];
}

export interface SyncCheckpointDto {
  readonly cursor: string | null;
  readonly serverTime: string;
}

export interface SyncRecordDto {
  readonly kind: OrbitObjectKind;
  readonly id: string;
  readonly version: string;
  readonly deleted: boolean;
  readonly payload: Record<string, unknown>;
}

export interface SyncPullRequestDto {
  readonly workspaceId: string;
  readonly deviceId: string;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface SyncPushRequestDto<TMutation = Record<string, unknown>> {
  readonly workspaceId: string;
  readonly deviceId: string;
  readonly baseCursor: string | null;
  readonly mutations: readonly TMutation[];
}

export interface SyncPullResponseDto {
  readonly applied: readonly SyncRecordDto[];
  readonly checkpoint: SyncCheckpointDto;
  readonly hasMore: boolean;
}

export interface BlobDescriptorDto {
  readonly blobId: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly uploadedAt?: string | null;
}

export interface AdminWorkspaceSummaryDto {
  readonly workspaceId: string;
  readonly ownerUserId: string;
  readonly memberCount: number;
  readonly deviceCount: number;
  readonly storageBytes: number;
  readonly lastSyncAt: string | null;
}

export function createBearerAuthHeader(accessToken: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export function isServerCheckpoint(value: unknown): value is SyncCheckpointDto {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SyncCheckpointDto>;
  return typeof candidate.serverTime === 'string' && ('cursor' in candidate);
}
