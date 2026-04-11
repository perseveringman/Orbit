import type { SyncChange, SyncConflict } from './sync-types.js';

export interface LwwMergeResult {
  readonly winner: 'local' | 'remote';
  readonly merged: SyncChange;
  readonly conflictDetected: boolean;
}

export function lwwMerge(local: SyncChange, remote: SyncChange): LwwMergeResult {
  const localTime = new Date(local.createdAt).getTime();
  const remoteTime = new Date(remote.createdAt).getTime();

  let winner: 'local' | 'remote';
  if (localTime !== remoteTime) {
    winner = localTime > remoteTime ? 'local' : 'remote';
  } else {
    // Deterministic tiebreaker: lexicographic deviceId comparison
    winner = local.deviceId <= remote.deviceId ? 'local' : 'remote';
  }

  const conflictDetected =
    local.objectId === remote.objectId && local.checksum !== remote.checksum;

  return {
    winner,
    merged: winner === 'local' ? local : remote,
    conflictDetected,
  };
}

export function lwwResolve(conflict: SyncConflict): LwwMergeResult {
  return lwwMerge(conflict.localChange, conflict.remoteChange);
}
