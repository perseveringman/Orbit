import type { Block } from './block-schema.js';
import { parseMarkdown } from './markdown-parser.js';
import { serializeBlocks } from './markdown-serializer.js';
import { ensureBlockId } from './block-id.js';

export interface ReconcileResult {
  readonly blocks: readonly Block[];
  readonly detachedIds: readonly string[];
  readonly reattachedIds: readonly string[];
}

export function reconcileExternalEdit(
  previousBlocks: readonly Block[],
  previousMarkdown: string,
  currentMarkdown: string
): ReconcileResult {
  const newRawBlocks = parseMarkdown(currentMarkdown);
  const oldById = new Map<string, Block>();
  for (const b of previousBlocks) {
    if (b.id) oldById.set(b.id, b);
  }

  const matchedIds = new Set<string>();
  const reattachedIds: string[] = [];

  // Match new blocks to old blocks by content similarity
  const blocks = newRawBlocks.map((newBlock) => {
    // Exact content match
    for (const [id, old] of oldById) {
      if (!matchedIds.has(id) && old.kind === newBlock.kind && old.text === newBlock.text) {
        matchedIds.add(id);
        return { ...newBlock, id };
      }
    }
    // Fuzzy match: same kind, similar text
    for (const [id, old] of oldById) {
      if (!matchedIds.has(id) && old.kind === newBlock.kind && isSimilar(old.text, newBlock.text)) {
        matchedIds.add(id);
        reattachedIds.push(id);
        return { ...newBlock, id };
      }
    }
    return ensureBlockId(newBlock);
  });

  const detachedIds = [...oldById.keys()].filter((id) => !matchedIds.has(id));

  return { blocks, detachedIds, reattachedIds };
}

function isSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 0 || b.length === 0) return false;
  // Simple similarity: one is a substring of the other, or they share >60% of characters
  if (a.includes(b) || b.includes(a)) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  let matches = 0;
  for (const ch of shorter) {
    if (longer.includes(ch)) matches++;
  }
  return matches / shorter.length > 0.6;
}
