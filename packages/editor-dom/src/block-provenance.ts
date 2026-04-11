export type ProvenanceKind =
  | 'verbatim'
  | 'edited'
  | 'ai_rewrite'
  | 'merged'
  | 'summarized';

export interface BlockProvenance {
  readonly blockId: string;
  readonly kind: ProvenanceKind;
  readonly sourceIds: readonly string[];
  readonly createdAt: string;
  readonly editedAt?: string;
}

export function createProvenance(
  blockId: string,
  kind: ProvenanceKind,
  sourceIds: readonly string[] = []
): BlockProvenance {
  return {
    blockId,
    kind,
    sourceIds,
    createdAt: new Date().toISOString(),
  };
}

export function updateProvenance(
  prev: BlockProvenance,
  kind: ProvenanceKind
): BlockProvenance {
  return {
    ...prev,
    kind,
    editedAt: new Date().toISOString(),
  };
}
