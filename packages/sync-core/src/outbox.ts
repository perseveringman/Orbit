import type { SyncChange } from './sync-types.js';

export type OutboxEntryStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface OutboxEntry {
  readonly id: string;
  readonly change: SyncChange;
  readonly status: OutboxEntryStatus;
  readonly attempts: number;
  readonly lastAttemptAt?: string;
  readonly error?: string;
  readonly createdAt: string;
}

export interface Outbox {
  enqueue(change: SyncChange): OutboxEntry;
  peek(limit: number): readonly OutboxEntry[];
  markUploading(id: string): boolean;
  markUploaded(id: string): boolean;
  markFailed(id: string, error: string): boolean;
  retry(id: string): boolean;
  remove(id: string): boolean;
  getPendingCount(): number;
  getFailedCount(): number;
  clear(): void;
  drain(): readonly OutboxEntry[];
}

export function createOutbox(): Outbox {
  const entries = new Map<string, OutboxEntry>();

  function updateEntry(id: string, patch: Partial<OutboxEntry>): boolean {
    const existing = entries.get(id);
    if (!existing) return false;
    entries.set(id, { ...existing, ...patch } as OutboxEntry);
    return true;
  }

  return {
    enqueue(change: SyncChange): OutboxEntry {
      const entry: OutboxEntry = {
        id: crypto.randomUUID(),
        change,
        status: 'pending',
        attempts: 0,
        createdAt: new Date().toISOString(),
      };
      entries.set(entry.id, entry);
      return entry;
    },

    peek(limit: number): readonly OutboxEntry[] {
      const result: OutboxEntry[] = [];
      for (const entry of entries.values()) {
        if (entry.status === 'pending') {
          result.push(entry);
          if (result.length >= limit) break;
        }
      }
      return result;
    },

    markUploading(id: string): boolean {
      return updateEntry(id, {
        status: 'uploading',
        attempts: (entries.get(id)?.attempts ?? 0) + 1,
        lastAttemptAt: new Date().toISOString(),
      });
    },

    markUploaded(id: string): boolean {
      return updateEntry(id, { status: 'uploaded' });
    },

    markFailed(id: string, error: string): boolean {
      return updateEntry(id, { status: 'failed', error });
    },

    retry(id: string): boolean {
      const entry = entries.get(id);
      if (!entry || entry.status !== 'failed') return false;
      return updateEntry(id, { status: 'pending', error: undefined });
    },

    remove(id: string): boolean {
      return entries.delete(id);
    },

    getPendingCount(): number {
      let count = 0;
      for (const e of entries.values()) if (e.status === 'pending') count++;
      return count;
    },

    getFailedCount(): number {
      let count = 0;
      for (const e of entries.values()) if (e.status === 'failed') count++;
      return count;
    },

    clear(): void {
      entries.clear();
    },

    drain(): readonly OutboxEntry[] {
      const result: OutboxEntry[] = [];
      for (const entry of entries.values()) {
        if (entry.status === 'pending') {
          const updated: OutboxEntry = {
            ...entry,
            status: 'uploading',
            attempts: entry.attempts + 1,
            lastAttemptAt: new Date().toISOString(),
          };
          entries.set(entry.id, updated);
          result.push(updated);
        }
      }
      return result;
    },
  };
}
