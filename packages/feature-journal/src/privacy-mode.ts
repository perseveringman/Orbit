import type { IsoDateTimeString } from '@orbit/domain';

// ── Recording mode ─────────────────────────────────────────

export type RecordingMode = 'normal' | 'protected' | 'manual';

// ── Protected session ──────────────────────────────────────

export interface ProtectedSession {
  readonly id: string;
  readonly startedAt: IsoDateTimeString;
  readonly endedAt: IsoDateTimeString | null;
  readonly reason: string | null;
}

// ── Sealed object access ───────────────────────────────────

export interface SealedObjectAccess {
  readonly objectId: string;
  readonly requestedBy: string;
  readonly grantedAt: IsoDateTimeString;
  readonly expiresAt: IsoDateTimeString;
  readonly reason: string;
}

// ── Helpers ────────────────────────────────────────────────

let _counter = 0;

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  _counter += 1;
  return `${prefix}_${ts}_${_counter.toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Protected session management ───────────────────────────

export function startProtectedSession(reason?: string): ProtectedSession {
  return {
    id: generateId('psess'),
    startedAt: nowIso(),
    endedAt: null,
    reason: reason ?? null,
  };
}

export function endProtectedSession(session: ProtectedSession): ProtectedSession {
  return {
    ...session,
    endedAt: nowIso(),
  };
}

export function isInProtectedMode(sessions: readonly ProtectedSession[]): boolean {
  return sessions.some((s) => s.endedAt === null);
}

// ── Sealed access ──────────────────────────────────────────

const SEALED_ACCESS_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function requestSealedAccess(
  objectId: string,
  reason: string,
): SealedObjectAccess {
  const now = nowIso();
  const expiresMs = new Date(now).getTime() + SEALED_ACCESS_DURATION_MS;

  return {
    objectId,
    requestedBy: 'user',
    grantedAt: now,
    expiresAt: new Date(expiresMs).toISOString(),
    reason,
  };
}

export function isSealedAccessValid(
  access: SealedObjectAccess,
  now: IsoDateTimeString,
): boolean {
  return new Date(now).getTime() < new Date(access.expiresAt).getTime();
}
