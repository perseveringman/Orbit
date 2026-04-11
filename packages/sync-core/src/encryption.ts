export interface EncryptionConfig {
  readonly algorithm: 'AES-256-GCM';
  readonly keyDerivation: 'argon2id';
  readonly ivLength: 12;
  readonly tagLength: 128;
}

export interface Encryptor {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
  isInitialized(): boolean;
}

export interface MasterKeyManager {
  deriveFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey>;
  exportKey(key: CryptoKey): Promise<Uint8Array>;
  importKey(raw: Uint8Array): Promise<CryptoKey>;
}

/**
 * AES-256-GCM encryptor.
 * Wire format: [12-byte IV || ciphertext+tag]
 */
export function createEncryptor(masterKey: CryptoKey): Encryptor {
  return {
    async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        masterKey,
        plaintext,
      );
      const out = new Uint8Array(12 + ciphertext.byteLength);
      out.set(iv);
      out.set(new Uint8Array(ciphertext), 12);
      return out;
    },

    async decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
      const iv = ciphertext.slice(0, 12);
      const data = ciphertext.slice(12);
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        masterKey,
        data,
      );
      return new Uint8Array(plaintext);
    },

    isInitialized(): boolean {
      return true;
    },
  };
}

/**
 * PBKDF2-based master-key manager (SubtleCrypto fallback for Argon2id).
 */
export function createMasterKeyManager(): MasterKeyManager {
  return {
    async deriveFromPassphrase(
      passphrase: string,
      salt: Uint8Array,
    ): Promise<CryptoKey> {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey'],
      );
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );
    },

    async exportKey(key: CryptoKey): Promise<Uint8Array> {
      const raw = await crypto.subtle.exportKey('raw', key);
      return new Uint8Array(raw);
    },

    async importKey(raw: Uint8Array): Promise<CryptoKey> {
      return crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );
    },
  };
}
