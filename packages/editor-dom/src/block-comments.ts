import type { Block } from './block-schema.js';
import { parseMarkdown } from './markdown-parser.js';
import { ensureBlockId } from './block-id.js';

const BLOCK_COMMENT_RE = /<!-- orbit:block id=(\S+) -->/g;
const BLOCK_COMMENT_LINE_RE = /^<!-- orbit:block id=(\S+) -->$/;

export function injectBlockComments(markdown: string, blocks: readonly Block[]): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let blockIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip existing block comments
    if (BLOCK_COMMENT_LINE_RE.test(line.trim())) continue;

    // Skip empty lines — just pass through
    if (line.trim() === '') {
      result.push(line);
      continue;
    }

    // Before a content line, inject comment for the current block
    if (blockIdx < blocks.length && blocks[blockIdx].id) {
      result.push(`<!-- orbit:block id=${blocks[blockIdx].id} -->`);
      blockIdx++;
    }
    result.push(line);

    // For multi-line blocks (code, table, list, etc.), consume lines until the block ends
    if (line.trim().startsWith('```')) {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        result.push(lines[i]);
        i++;
      }
      if (i < lines.length) result.push(lines[i]);
    }
  }

  return result.join('\n');
}

export function extractBlockComments(markdown: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(BLOCK_COMMENT_LINE_RE);
    if (match) {
      map.set(String(i), match[1]);
    }
  }
  BLOCK_COMMENT_RE.lastIndex = 0;
  return map;
}

export function reconcileAfterExternalEdit(
  oldBlocks: readonly Block[],
  newMarkdown: string
): Block[] {
  const comments = extractBlockComments(newMarkdown);
  const newBlocks = parseMarkdown(newMarkdown);
  const oldById = new Map(oldBlocks.map((b) => [b.id, b]));
  const usedIds = new Set(comments.values());

  return newBlocks.map((block, idx) => {
    // Try to match by block comment at a nearby position
    for (const [, id] of comments) {
      if (usedIds.has(id) && oldById.has(id)) {
        const old = oldById.get(id)!;
        if (old.kind === block.kind && old.text === block.text) {
          return { ...block, id };
        }
      }
    }
    // Try to match by content to existing old block
    for (const old of oldBlocks) {
      if (old.kind === block.kind && old.text === block.text && old.id) {
        return { ...block, id: old.id };
      }
    }
    return ensureBlockId(block);
  });
}
