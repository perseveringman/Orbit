import type { Block } from './block-schema.js';
import { createBlock } from './block-schema.js';
import { generateBlockId } from './block-id.js';

export type AssemblyKind = 'reference' | 'snapshot' | 'embed';

export interface AssemblyOperation {
  readonly kind: AssemblyKind;
  readonly sourceBlockId: string;
  readonly targetPosition: number;
}

export function createAssemblyBlock(op: AssemblyOperation, sourceBlock: Block): Block {
  return createBlock(op.kind, sourceBlock.text, {
    ...sourceBlock.attrs,
    sourceId: op.sourceBlockId,
    sourceType: sourceBlock.kind,
  });
}
