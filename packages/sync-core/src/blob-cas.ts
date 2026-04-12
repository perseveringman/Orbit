import type { Encryptor } from './encryption.js';

export interface BlobDescriptor {
  readonly hash: string;
  readonly encryptedHash: string;
  readonly size: number;
  readonly encryptedSize: number;
  readonly mimeType?: string;
  readonly createdAt: string;
}

export interface BlobStore {
  put(plaintext: Uint8Array, mimeType?: string): Promise<BlobDescriptor>;
  get(hash: string): Promise<Uint8Array | null>;
  has(hash: string): boolean;
  delete(hash: string): boolean;
  list(): readonly BlobDescriptor[];
  getDescriptor(hash: string): BlobDescriptor | null;
  gc(referencedHashes: ReadonlySet<string>): number;
}

async function sha256hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function createBlobStore(encryptor: Encryptor): BlobStore {
  const blobs = new Map<string, Uint8Array>();
  const descriptors = new Map<string, BlobDescriptor>();

  return {
    async put(plaintext: Uint8Array, mimeType?: string): Promise<BlobDescriptor> {
      const hash = await sha256hex(plaintext);

      if (descriptors.has(hash)) {
        return descriptors.get(hash)!;
      }

      const encrypted = await encryptor.encrypt(plaintext);
      const encryptedHash = await sha256hex(encrypted);

      const descriptor: BlobDescriptor = {
        hash,
        encryptedHash,
        size: plaintext.length,
        encryptedSize: encrypted.length,
        ...(mimeType !== undefined ? { mimeType } : {}),
        createdAt: new Date().toISOString(),
      };

      blobs.set(hash, encrypted);
      descriptors.set(hash, descriptor);

      return descriptor;
    },

    async get(hash: string): Promise<Uint8Array | null> {
      const encrypted = blobs.get(hash);
      if (!encrypted) return null;
      return encryptor.decrypt(encrypted);
    },

    has(hash: string): boolean {
      return blobs.has(hash);
    },

    delete(hash: string): boolean {
      const existed = blobs.has(hash);
      blobs.delete(hash);
      descriptors.delete(hash);
      return existed;
    },

    list(): readonly BlobDescriptor[] {
      return [...descriptors.values()];
    },

    getDescriptor(hash: string): BlobDescriptor | null {
      return descriptors.get(hash) ?? null;
    },

    gc(referencedHashes: ReadonlySet<string>): number {
      let deleted = 0;
      for (const hash of [...blobs.keys()]) {
        if (!referencedHashes.has(hash)) {
          blobs.delete(hash);
          descriptors.delete(hash);
          deleted++;
        }
      }
      return deleted;
    },
  };
}
