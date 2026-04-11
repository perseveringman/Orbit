import type { Block } from './block-schema.js';

let counter = 0;

export function generateBlockId(): string {
  const timestamp = Date.now().toString(36);
  const seq = (counter++).toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `blk-${timestamp}-${seq}-${rand}`;
}

export function ensureBlockId(block: Block): Block {
  const id = block.id || generateBlockId();
  const children = block.children
    ? block.children.map(ensureBlockId)
    : undefined;
  if (id === block.id && children === block.children) return block;
  return children !== undefined
    ? { ...block, id, children }
    : { ...block, id };
}

export function stripBlockIds(blocks: readonly Block[]): Block[] {
  return blocks.map(stripOne);
}

function stripOne(block: Block): Block {
  const children = block.children
    ? block.children.map(stripOne)
    : undefined;
  return children !== undefined
    ? { ...block, id: '', children }
    : { ...block, id: '' };
}
