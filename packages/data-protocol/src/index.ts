import type { OrbitObjectKind } from '@orbit/domain';

export type RepositoryCursor = string;

export interface RepositoryQuery<TFilter = Record<string, unknown>> {
  readonly workspaceId: string;
  readonly kind?: OrbitObjectKind;
  readonly filter?: TFilter;
  readonly cursor?: RepositoryCursor | null;
  readonly limit?: number;
}

export interface MutationEnvelope<TType extends string = string, TPayload = Record<string, unknown>> {
  readonly mutationId: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly type: TType;
  readonly occurredAt: string;
  readonly payload: TPayload;
  readonly idempotencyKey: string;
}

export interface RepositoryListResult<TRecord> {
  readonly items: readonly TRecord[];
  readonly nextCursor: RepositoryCursor | null;
}

export interface RepositoryContract<TRecord, TFilter = Record<string, unknown>, TMutation = MutationEnvelope> {
  list(query: RepositoryQuery<TFilter>): Promise<RepositoryListResult<TRecord>>;
  getById(id: string): Promise<TRecord | null>;
  applyMutation(mutation: TMutation): Promise<TRecord>;
}

export function createRepositoryCursor(updatedAt: string, id: string): RepositoryCursor {
  return `${updatedAt}::${id}`;
}

export function createMutationEnvelope<TType extends string, TPayload>(
  input: Omit<MutationEnvelope<TType, TPayload>, 'idempotencyKey'>,
): MutationEnvelope<TType, TPayload> {
  return {
    ...input,
    idempotencyKey: `${input.mutationId}:${input.deviceId}`,
  };
}

export function isDeletionMutation(mutation: Pick<MutationEnvelope, 'type' | 'payload'>): boolean {
  return mutation.type.endsWith('.deleted') || (mutation.payload as { deleted?: boolean }).deleted === true;
}
