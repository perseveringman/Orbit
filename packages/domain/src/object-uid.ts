import type { OrbitObjectType } from './object-types.js';
import { isOrbitObjectType } from './object-types.js';

// ── ObjectUid branded type ─────────────────────────────────

declare const __objectUidBrand: unique symbol;

/**
 * Format: `{type}:{ulid}` — e.g. `task:01JXYZ...`
 * Branded string for compile-time safety.
 */
export type ObjectUid = string & { readonly [__objectUidBrand]: never };

// ── ULID generation ────────────────────────────────────────

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number): string {
  let mod: number;
  let result = '';
  let remaining = now;
  for (let i = TIME_LEN; i > 0; i--) {
    mod = remaining % 32;
    result = ENCODING[mod]! + result;
    remaining = (remaining - mod) / 32;
  }
  return result;
}

function encodeRandom(): string {
  const buffer = new Uint8Array(RANDOM_LEN);
  (globalThis as any).crypto.getRandomValues(buffer);
  let result = '';
  for (let i = 0; i < RANDOM_LEN; i++) {
    result += ENCODING[buffer[i]! % 32];
  }
  return result;
}

let lastTime = 0;
let lastRandom: Uint8Array | null = null;

/**
 * Generates a monotonic ULID.
 * Same-millisecond calls increment the random component.
 */
export function generateUlid(seedTime?: number): string {
  const now = seedTime ?? Date.now();

  if (now === lastTime && lastRandom) {
    // Monotonic: increment the random part
    for (let i = lastRandom.length - 1; i >= 0; i--) {
      if (lastRandom[i]! < 255) {
        lastRandom[i]!++;
        break;
      }
      lastRandom[i] = 0;
    }
  } else {
    lastTime = Math.max(now, lastTime);
    lastRandom = new Uint8Array(RANDOM_LEN);
    (globalThis as any).crypto.getRandomValues(lastRandom);
  }

  const time = encodeTime(lastTime);
  let random = '';
  for (let i = 0; i < RANDOM_LEN; i++) {
    random += ENCODING[lastRandom[i]! % 32];
  }
  return time + random;
}

// ── ObjectUid API ──────────────────────────────────────────

/** Creates an ObjectUid from a type and an existing ULID */
export function createObjectUid(type: OrbitObjectType, id: string): ObjectUid {
  return `${type}:${id}` as ObjectUid;
}

/** Creates an ObjectUid with an auto-generated ULID */
export function newObjectUid(type: OrbitObjectType): ObjectUid {
  return `${type}:${generateUlid()}` as ObjectUid;
}

/** Parses an ObjectUid into its components */
export function parseObjectUid(uid: string): { type: OrbitObjectType; id: string } | null {
  const idx = uid.indexOf(':');
  if (idx < 1) return null;
  const type = uid.slice(0, idx);
  const id = uid.slice(idx + 1);
  if (!isOrbitObjectType(type) || id.length === 0) return null;
  return { type: type as OrbitObjectType, id };
}

/** Type guard that validates ObjectUid format */
export function isValidObjectUid(value: unknown): value is ObjectUid {
  if (typeof value !== 'string') return false;
  return parseObjectUid(value) !== null;
}
