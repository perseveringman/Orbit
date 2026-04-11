import type { SyncChannel } from './sync-channels.js';

export interface SyncMeta {
  readonly objectId: string;
  readonly version: number;
  readonly updatedAt: string;
  readonly checksum: string;
  readonly deviceId: string;
  readonly channel: SyncChannel;
}

export interface SyncChange {
  readonly id: string;
  readonly objectId: string;
  readonly version: number;
  readonly baseVersion: number;
  readonly channel: SyncChannel;
  readonly payload: Uint8Array;
  readonly checksum: string;
  readonly deviceId: string;
  readonly createdAt: string;
}

export interface SyncConflict {
  readonly objectId: string;
  readonly localVersion: number;
  readonly remoteVersion: number;
  readonly localChange: SyncChange;
  readonly remoteChange: SyncChange;
  readonly resolvedBy?: 'local' | 'remote' | 'merged';
}

function fnv1a(data: Uint8Array): string {
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computeChecksum(data: Uint8Array): string {
  return fnv1a(data);
}

export function createSyncChange(
  objectId: string,
  version: number,
  baseVersion: number,
  payload: Uint8Array,
  channel: SyncChannel,
  deviceId: string,
): SyncChange {
  return {
    id: crypto.randomUUID(),
    objectId,
    version,
    baseVersion,
    channel,
    payload,
    checksum: computeChecksum(payload),
    deviceId,
    createdAt: new Date().toISOString(),
  };
}
