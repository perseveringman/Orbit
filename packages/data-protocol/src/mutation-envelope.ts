import type { ActorType, IsoDateTimeString, ObjectUid } from './common.js';

// ── Mutation Envelope (Wave 1 spec) ────────────────────────────────

/**
 * Every write operation is wrapped in a MutationEnvelope that carries
 * full provenance, idempotency, and optimistic-concurrency metadata.
 */
export interface MutationEnvelope {
  readonly mutationId: string;
  readonly objectUid: ObjectUid;
  readonly objectType: string;
  readonly actorType: ActorType;
  readonly actorId: string;
  readonly deviceId: string;
  /** version_token of the object before mutation (optimistic concurrency) */
  readonly baseVersion: string;
  /** Mutation type, e.g. `task.status_changed` */
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: IsoDateTimeString;
  readonly idempotencyKey: string;
}

// ── Input type for creating an envelope ────────────────────────────

export type CreateMutationEnvelopeInput = Omit<MutationEnvelope, 'idempotencyKey'>;

// ── Helper functions ───────────────────────────────────────────────

/**
 * Creates a MutationEnvelope with a derived idempotency key.
 * Key format: `{mutationId}:{deviceId}`.
 */
export function createMutationEnvelope(input: CreateMutationEnvelopeInput): MutationEnvelope {
  return {
    ...input,
    idempotencyKey: `${input.mutationId}:${input.deviceId}`,
  };
}

/**
 * Returns `true` when the mutation represents a deletion.
 * Detected by `.deleted` type suffix or explicit `deleted` payload flag.
 */
export function isDeletionMutation(
  mutation: Pick<MutationEnvelope, 'type' | 'payload'>,
): boolean {
  return (
    mutation.type.endsWith('.deleted') ||
    (mutation.payload as { deleted?: boolean }).deleted === true
  );
}

/**
 * Returns `true` when the mutation represents creation of a new object.
 * Detected by `.created` type suffix or explicit `created` payload flag.
 */
export function isCreationMutation(
  mutation: Pick<MutationEnvelope, 'type' | 'payload'>,
): boolean {
  return (
    mutation.type.endsWith('.created') ||
    (mutation.payload as { created?: boolean }).created === true
  );
}
