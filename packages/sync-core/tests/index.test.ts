import { describe, expect, it } from 'vitest';

import { buildSyncPlan, getNextCheckpoint, shouldRequestAnotherPage } from '../src/index';

// ---------------------------------------------------------------------------
// New Wave 2-D modules
// ---------------------------------------------------------------------------
import {
  getChannelConfig,
  detectChannel,
} from '../src/sync-channels';
import type { SyncChannel } from '../src/sync-channels';

import {
  computeChecksum,
  createSyncChange,
} from '../src/sync-types';
import type { SyncChange, SyncConflict } from '../src/sync-types';

import { lwwMerge, lwwResolve } from '../src/lww-merge';

import { diff, threeWayMerge } from '../src/three-way-merge';

import {
  createEncryptor,
  createMasterKeyManager,
} from '../src/encryption';

import { createBlobStore } from '../src/blob-cas';

import {
  generateRecoveryPhrase,
  recoveryPhraseToEntropy,
  validateRecoveryPhrase,
  deriveKeyFromPhrase,
} from '../src/recovery-phrase';

import { createOutbox } from '../src/outbox';

import {
  NON_SYNC_ITEMS,
  shouldSync,
  getRebuildStrategy,
} from '../src/non-sync-items';

// ===== helpers ==============================================================

const enc = new TextEncoder();

function makeChange(overrides: Partial<SyncChange> & { objectId: string }): SyncChange {
  return {
    id: crypto.randomUUID(),
    objectId: overrides.objectId,
    version: overrides.version ?? 1,
    baseVersion: overrides.baseVersion ?? 0,
    channel: overrides.channel ?? 'object_lww',
    payload: overrides.payload ?? enc.encode('data'),
    checksum: overrides.checksum ?? '00000000',
    deviceId: overrides.deviceId ?? 'dev_a',
    createdAt: overrides.createdAt ?? '2026-06-01T00:00:00.000Z',
  };
}

// ==========================================================================
// 0. Original sync-plan tests (preserved)
// ==========================================================================

describe('sync-core', () => {
  it('基于本地 mutation 与远端响应计算同步计划', () => {
    const plan = buildSyncPlan({
      workspaceId: 'ws_1',
      deviceId: 'dev_1',
      checkpoint: { cursor: null, serverTime: '2026-01-01T00:00:00.000Z' },
      pendingMutations: [
        {
          mutationId: 'mut_1',
          actorId: 'user_1',
          deviceId: 'dev_1',
          type: 'article.updated',
          occurredAt: '2026-01-01T00:10:00.000Z',
          payload: { articleId: 'art_1' },
        },
      ],
      pullLimit: 50,
    });

    expect(plan.pushRequest.mutations).toHaveLength(1);
    expect(plan.pullRequest.limit).toBe(50);
    expect(shouldRequestAnotherPage({ applied: [], checkpoint: { cursor: 'cp_2', serverTime: '2026-01-01T00:20:00.000Z' }, hasMore: true })).toBe(true);
    expect(getNextCheckpoint({ applied: [], checkpoint: { cursor: 'cp_2', serverTime: '2026-01-01T00:20:00.000Z' }, hasMore: false })).toEqual({ cursor: 'cp_2', serverTime: '2026-01-01T00:20:00.000Z' });
  });
});

// ==========================================================================
// 1. Sync Channels
// ==========================================================================

describe('sync-channels', () => {
  it('returns config for every channel type', () => {
    const channels: SyncChannel[] = ['object_lww', 'document_merge', 'blob_cas'];
    for (const ch of channels) {
      const cfg = getChannelConfig(ch);
      expect(cfg.channel).toBe(ch);
      expect(typeof cfg.description).toBe('string');
      expect(typeof cfg.supportsOffline).toBe('boolean');
    }
  });

  it('detects document channels', () => {
    expect(detectChannel('article')).toBe('document_merge');
    expect(detectChannel('note')).toBe('document_merge');
  });

  it('detects blob channels', () => {
    expect(detectChannel('blob')).toBe('blob_cas');
    expect(detectChannel('image')).toBe('blob_cas');
  });

  it('defaults to object_lww for unknown types', () => {
    expect(detectChannel('widget')).toBe('object_lww');
    expect(detectChannel('setting')).toBe('object_lww');
  });
});

// ==========================================================================
// 2. SyncTypes — checksum & createSyncChange
// ==========================================================================

describe('sync-types', () => {
  it('computeChecksum is deterministic', () => {
    const data = enc.encode('hello');
    expect(computeChecksum(data)).toBe(computeChecksum(data));
  });

  it('computeChecksum differs for different data', () => {
    expect(computeChecksum(enc.encode('a'))).not.toBe(computeChecksum(enc.encode('b')));
  });

  it('createSyncChange builds a valid change', () => {
    const payload = enc.encode('test');
    const change = createSyncChange('obj_1', 2, 1, payload, 'object_lww', 'dev_1');
    expect(change.objectId).toBe('obj_1');
    expect(change.version).toBe(2);
    expect(change.baseVersion).toBe(1);
    expect(change.channel).toBe('object_lww');
    expect(change.deviceId).toBe('dev_1');
    expect(change.checksum).toBe(computeChecksum(payload));
    expect(change.id).toBeTruthy();
    expect(change.createdAt).toBeTruthy();
  });
});

// ==========================================================================
// 3. LWW Merge
// ==========================================================================

describe('lww-merge', () => {
  it('picks the later timestamp', () => {
    const local = makeChange({ objectId: 'o1', createdAt: '2026-06-01T00:02:00.000Z' });
    const remote = makeChange({ objectId: 'o1', createdAt: '2026-06-01T00:01:00.000Z' });
    const result = lwwMerge(local, remote);
    expect(result.winner).toBe('local');
    expect(result.merged).toBe(local);
  });

  it('picks remote when it is later', () => {
    const local = makeChange({ objectId: 'o1', createdAt: '2026-06-01T00:01:00.000Z' });
    const remote = makeChange({ objectId: 'o1', createdAt: '2026-06-01T00:02:00.000Z' });
    expect(lwwMerge(local, remote).winner).toBe('remote');
  });

  it('uses deviceId as tiebreaker when timestamps equal', () => {
    const local = makeChange({ objectId: 'o1', deviceId: 'aaa', createdAt: '2026-06-01T00:00:00.000Z' });
    const remote = makeChange({ objectId: 'o1', deviceId: 'zzz', createdAt: '2026-06-01T00:00:00.000Z' });
    expect(lwwMerge(local, remote).winner).toBe('local');
    expect(lwwMerge(remote, local).winner).toBe('remote');
  });

  it('detects conflicts from differing checksums', () => {
    const local = makeChange({ objectId: 'o1', checksum: 'aaaa' });
    const remote = makeChange({ objectId: 'o1', checksum: 'bbbb' });
    expect(lwwMerge(local, remote).conflictDetected).toBe(true);
  });

  it('lwwResolve works on SyncConflict', () => {
    const local = makeChange({ objectId: 'o1', createdAt: '2026-06-01T00:02:00.000Z' });
    const remote = makeChange({ objectId: 'o1', createdAt: '2026-06-01T00:01:00.000Z' });
    const conflict: SyncConflict = {
      objectId: 'o1',
      localVersion: 2,
      remoteVersion: 3,
      localChange: local,
      remoteChange: remote,
    };
    expect(lwwResolve(conflict).winner).toBe('local');
  });
});

// ==========================================================================
// 4. Three-Way Merge
// ==========================================================================

describe('three-way-merge', () => {
  describe('diff', () => {
    it('returns equal hunks for identical strings', () => {
      const hunks = diff('abc', 'abc');
      expect(hunks.every((h) => h.type === 'equal')).toBe(true);
    });

    it('detects insertion', () => {
      const hunks = diff('A\nC', 'A\nB\nC');
      expect(hunks.some((h) => h.type === 'insert' && h.content === 'B')).toBe(true);
    });

    it('detects deletion', () => {
      const hunks = diff('A\nB\nC', 'A\nC');
      expect(hunks.some((h) => h.type === 'delete' && h.content === 'B')).toBe(true);
    });

    it('handles empty inputs', () => {
      expect(diff('', '')).toHaveLength(0);
      const h = diff('', 'hello');
      expect(h.some((x) => x.type === 'insert')).toBe(true);
    });
  });

  describe('threeWayMerge', () => {
    it('returns local when local === remote', () => {
      const r = threeWayMerge('A', 'B', 'B');
      expect(r.success).toBe(true);
      expect(r.merged).toBe('B');
    });

    it('returns remote when ancestor === local', () => {
      const r = threeWayMerge('A', 'A', 'B');
      expect(r.success).toBe(true);
      expect(r.merged).toBe('B');
    });

    it('returns local when ancestor === remote', () => {
      const r = threeWayMerge('A', 'B', 'A');
      expect(r.success).toBe(true);
      expect(r.merged).toBe('B');
    });

    it('merges non-overlapping changes', () => {
      const ancestor = 'A\nB\nC\nD';
      const local = 'A\nX\nC\nD';
      const remote = 'A\nB\nY\nD';
      const r = threeWayMerge(ancestor, local, remote);
      expect(r.success).toBe(true);
      expect(r.merged).toBe('A\nX\nY\nD');
      expect(r.hasConflicts).toBe(false);
    });

    it('detects overlapping changes as conflict', () => {
      const ancestor = 'A\nB\nC';
      const local = 'A\nX\nC';
      const remote = 'A\nY\nC';
      const r = threeWayMerge(ancestor, local, remote);
      expect(r.hasConflicts).toBe(true);
      expect(r.conflicts).toHaveLength(1);
      expect(r.conflicts[0].localContent).toBe('X');
      expect(r.conflicts[0].remoteContent).toBe('Y');
    });

    it('identical changes from both sides are not a conflict', () => {
      const ancestor = 'A\nB\nC';
      const local = 'A\nX\nC';
      const remote = 'A\nX\nC';
      const r = threeWayMerge(ancestor, local, remote);
      expect(r.success).toBe(true);
      expect(r.merged).toBe('A\nX\nC');
    });
  });
});

// ==========================================================================
// 5. Encryption
// ==========================================================================

describe('encryption', () => {
  it('round-trips encrypt → decrypt', async () => {
    const mgr = createMasterKeyManager();
    const key = await mgr.deriveFromPassphrase('test-pass', enc.encode('salt'));
    const e = createEncryptor(key);

    expect(e.isInitialized()).toBe(true);

    const plain = enc.encode('hello orbit');
    const ct = await e.encrypt(plain);
    expect(ct.length).toBeGreaterThan(plain.length);
    const decrypted = await e.decrypt(ct);
    expect(decrypted).toEqual(plain);
  });

  it('export / import key round-trip', async () => {
    const mgr = createMasterKeyManager();
    const key = await mgr.deriveFromPassphrase('pw', enc.encode('s'));
    const raw = await mgr.exportKey(key);
    expect(raw.length).toBe(32);

    const imported = await mgr.importKey(raw);
    const e = createEncryptor(imported);
    const ct = await e.encrypt(enc.encode('data'));
    const pt = await e.decrypt(ct);
    expect(pt).toEqual(enc.encode('data'));
  });

  it('ciphertext varies per encrypt call (random IV)', async () => {
    const mgr = createMasterKeyManager();
    const key = await mgr.deriveFromPassphrase('p', enc.encode('s'));
    const e = createEncryptor(key);
    const plain = enc.encode('same');
    const ct1 = await e.encrypt(plain);
    const ct2 = await e.encrypt(plain);
    expect(ct1).not.toEqual(ct2);
  });
});

// ==========================================================================
// 6. Blob CAS
// ==========================================================================

describe('blob-cas', () => {
  it('put / get / has / delete round-trip', async () => {
    const mgr = createMasterKeyManager();
    const key = await mgr.deriveFromPassphrase('k', enc.encode('s'));
    const store = createBlobStore(createEncryptor(key));

    const data = enc.encode('binary content');
    const desc = await store.put(data, 'text/plain');

    expect(desc.hash).toBeTruthy();
    expect(desc.encryptedHash).toBeTruthy();
    expect(desc.size).toBe(data.length);
    expect(desc.encryptedSize).toBeGreaterThan(data.length);
    expect(desc.mimeType).toBe('text/plain');
    expect(store.has(desc.hash)).toBe(true);

    const retrieved = await store.get(desc.hash);
    expect(retrieved).toEqual(data);

    expect(store.delete(desc.hash)).toBe(true);
    expect(store.has(desc.hash)).toBe(false);
  });

  it('deduplicates identical blobs', async () => {
    const mgr = createMasterKeyManager();
    const key = await mgr.deriveFromPassphrase('k', enc.encode('s'));
    const store = createBlobStore(createEncryptor(key));

    const data = enc.encode('dup');
    const d1 = await store.put(data);
    const d2 = await store.put(data);
    expect(d1.hash).toBe(d2.hash);
    expect(store.list()).toHaveLength(1);
  });

  it('gc removes unreferenced blobs', async () => {
    const mgr = createMasterKeyManager();
    const key = await mgr.deriveFromPassphrase('k', enc.encode('s'));
    const store = createBlobStore(createEncryptor(key));

    const d1 = await store.put(enc.encode('keep'));
    await store.put(enc.encode('discard'));
    expect(store.list()).toHaveLength(2);

    const removed = store.gc(new Set([d1.hash]));
    expect(removed).toBe(1);
    expect(store.list()).toHaveLength(1);
  });
});

// ==========================================================================
// 7. Recovery Phrase
// ==========================================================================

describe('recovery-phrase', () => {
  it('generates 12-word phrase by default', () => {
    const entropy = crypto.getRandomValues(new Uint8Array(16));
    const words = generateRecoveryPhrase(entropy);
    expect(words).toHaveLength(12);
  });

  it('generates 24-word phrase', () => {
    const entropy = crypto.getRandomValues(new Uint8Array(32));
    const words = generateRecoveryPhrase(entropy, { wordCount: 24, language: 'en' });
    expect(words).toHaveLength(24);
  });

  it('round-trips entropy through phrase', () => {
    const entropy = crypto.getRandomValues(new Uint8Array(16));
    const words = generateRecoveryPhrase(entropy);
    const recovered = recoveryPhraseToEntropy(words);
    for (let i = 0; i < recovered.length; i++) {
      expect(recovered[i]).toBe(entropy[i]);
    }
  });

  it('validates correct phrases', () => {
    const entropy = crypto.getRandomValues(new Uint8Array(16));
    const words = generateRecoveryPhrase(entropy);
    expect(validateRecoveryPhrase(words)).toBe(true);
  });

  it('rejects tampered phrases', () => {
    const words = generateRecoveryPhrase(new Uint8Array(16));
    const tampered = [...words];
    tampered[0] = tampered[0] === 'abandon' ? 'ability' : 'abandon';
    expect(validateRecoveryPhrase(tampered)).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(validateRecoveryPhrase(['abandon'])).toBe(false);
  });

  it('deriveKeyFromPhrase returns a CryptoKey', async () => {
    const words = generateRecoveryPhrase(crypto.getRandomValues(new Uint8Array(16)));
    const key = await deriveKeyFromPhrase(words);
    expect((key.algorithm as AesKeyAlgorithm).name).toBe('AES-GCM');
  });
});

// ==========================================================================
// 8. Outbox
// ==========================================================================

describe('outbox', () => {
  it('enqueue / peek / markUploading / markUploaded lifecycle', () => {
    const outbox = createOutbox();
    const change = makeChange({ objectId: 'o1' });

    const entry = outbox.enqueue(change);
    expect(entry.status).toBe('pending');
    expect(outbox.getPendingCount()).toBe(1);

    const peeked = outbox.peek(10);
    expect(peeked).toHaveLength(1);
    expect(peeked[0].id).toBe(entry.id);

    expect(outbox.markUploading(entry.id)).toBe(true);
    expect(outbox.getPendingCount()).toBe(0);

    expect(outbox.markUploaded(entry.id)).toBe(true);
  });

  it('markFailed + retry', () => {
    const outbox = createOutbox();
    const entry = outbox.enqueue(makeChange({ objectId: 'o1' }));
    outbox.markUploading(entry.id);
    outbox.markFailed(entry.id, 'network error');

    expect(outbox.getFailedCount()).toBe(1);
    expect(outbox.retry(entry.id)).toBe(true);
    expect(outbox.getPendingCount()).toBe(1);
    expect(outbox.getFailedCount()).toBe(0);
  });

  it('drain marks all pending as uploading', () => {
    const outbox = createOutbox();
    outbox.enqueue(makeChange({ objectId: 'o1' }));
    outbox.enqueue(makeChange({ objectId: 'o2' }));
    const drained = outbox.drain();
    expect(drained).toHaveLength(2);
    expect(drained.every((e) => e.status === 'uploading')).toBe(true);
    expect(outbox.getPendingCount()).toBe(0);
  });

  it('clear removes everything', () => {
    const outbox = createOutbox();
    outbox.enqueue(makeChange({ objectId: 'o1' }));
    outbox.clear();
    expect(outbox.getPendingCount()).toBe(0);
  });

  it('remove deletes a single entry', () => {
    const outbox = createOutbox();
    const e = outbox.enqueue(makeChange({ objectId: 'o1' }));
    expect(outbox.remove(e.id)).toBe(true);
    expect(outbox.remove(e.id)).toBe(false);
  });
});

// ==========================================================================
// 9. Non-Sync Items
// ==========================================================================

describe('non-sync-items', () => {
  it('NON_SYNC_ITEMS has expected categories', () => {
    const categories = NON_SYNC_ITEMS.map((i) => i.category);
    expect(categories).toContain('fts_index');
    expect(categories).toContain('vector_index');
    expect(categories).toContain('thumbnail');
    expect(categories).toContain('cache');
    expect(categories).toContain('temp');
  });

  it('shouldSync returns false for non-sync paths', () => {
    expect(shouldSync('data.fts')).toBe(false);
    expect(shouldSync('embeddings.vec')).toBe(false);
    expect(shouldSync('thumbnails/img.png')).toBe(false);
    expect(shouldSync('.cache/data.json')).toBe(false);
    expect(shouldSync('.tmp/scratch')).toBe(false);
  });

  it('shouldSync returns true for regular paths', () => {
    expect(shouldSync('notes/hello.md')).toBe(true);
    expect(shouldSync('article.json')).toBe(true);
  });

  it('getRebuildStrategy returns strategy or null', () => {
    expect(getRebuildStrategy('fts_index')).toBe('reindex_all_objects');
    expect(getRebuildStrategy('temp')).toBeNull();
  });
});
