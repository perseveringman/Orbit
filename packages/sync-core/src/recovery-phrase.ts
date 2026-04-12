export interface RecoveryPhraseConfig {
  readonly wordCount: 12 | 24;
  readonly language: 'en';
}

// First 128 words of the BIP-39 English wordlist (7-bit index space)
const WORDLIST: readonly string[] = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actual', 'adapt',
  'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance', 'advice',
  'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent', 'agree',
  'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol',
  'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha',
  'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among', 'amount',
  'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry', 'animal',
  'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique', 'anxiety',
  'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch',
  'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army',
  'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact', 'artist',
  'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume', 'asthma',
  'athlete', 'atom', 'attack', 'attend', 'auction', 'audit', 'august', 'aunt',
  'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake', 'aware',
] as const;

const WORD_TO_INDEX = new Map<string, number>(
  WORDLIST.map((w, i) => [w, i]),
);

/**
 * Convert entropy bytes into a list of recovery words.
 *
 * The last word is a checksum word (XOR of all data-word indices mod 128).
 */
export function generateRecoveryPhrase(
  entropy: Uint8Array,
  config?: RecoveryPhraseConfig,
): string[] {
  const wordCount = config?.wordCount ?? 12;
  const dataWordCount = wordCount - 1;

  // Convert entropy bits → 7-bit word indices
  const indices: number[] = [];
  let bitBuffer = 0;
  let bitsInBuffer = 0;
  let byteIndex = 0;

  while (indices.length < dataWordCount) {
    if (byteIndex < entropy.length) {
      bitBuffer = (bitBuffer << 8) | entropy[byteIndex++];
      bitsInBuffer += 8;
    } else {
      // Pad with zero bits
      bitBuffer = bitBuffer << 7;
      bitsInBuffer += 7;
    }
    while (bitsInBuffer >= 7 && indices.length < dataWordCount) {
      bitsInBuffer -= 7;
      indices.push((bitBuffer >> bitsInBuffer) & 0x7f);
    }
  }

  // Checksum word: XOR-fold all data indices
  const checksumIndex = indices.reduce((a, b) => a ^ b, 0) & 0x7f;
  indices.push(checksumIndex);

  return indices.map((i) => WORDLIST[i]);
}

/**
 * Convert a recovery phrase back to the original entropy bytes.
 * The last word (checksum) is stripped.
 */
export function recoveryPhraseToEntropy(words: string[]): Uint8Array {
  const indices = words.map((w) => {
    const idx = WORD_TO_INDEX.get(w);
    if (idx === undefined) throw new Error(`Unknown recovery word: ${w}`);
    return idx;
  });

  // Strip checksum
  const dataIndices = indices.slice(0, -1);

  // Reassemble bytes from 7-bit indices
  let bitBuffer = 0;
  let bitsInBuffer = 0;
  const bytes: number[] = [];

  for (const idx of dataIndices) {
    bitBuffer = (bitBuffer << 7) | idx;
    bitsInBuffer += 7;
    while (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      bytes.push((bitBuffer >> bitsInBuffer) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Validate word-count, vocabulary, and checksum of a recovery phrase.
 */
export function validateRecoveryPhrase(words: string[]): boolean {
  if (words.length !== 12 && words.length !== 24) return false;
  if (!words.every((w) => WORD_TO_INDEX.has(w))) return false;

  const indices = words.map((w) => WORD_TO_INDEX.get(w)!);
  const dataIndices = indices.slice(0, -1);
  const checksumIndex = indices[indices.length - 1];
  const expectedChecksum = dataIndices.reduce((a, b) => a ^ b, 0) & 0x7f;

  return checksumIndex === expectedChecksum;
}

/**
 * Derive an AES-256-GCM CryptoKey from a recovery phrase via PBKDF2.
 */
export async function deriveKeyFromPhrase(words: string[]): Promise<CryptoKey> {
  const entropy = recoveryPhraseToEntropy(words);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    entropy as unknown as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const salt = new TextEncoder().encode('orbit-recovery-phrase');
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}
