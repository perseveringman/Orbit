import type { Block } from './block-schema.js';
import { parseFrontmatter, type OrbitFrontmatter } from './frontmatter.js';
import { parseMarkdown } from './markdown-parser.js';
import { ensureBlockId } from './block-id.js';

export interface EditorDocumentState {
  readonly rawText: string;
  readonly frontmatter: OrbitFrontmatter;
  readonly blocks: readonly Block[];
}

export function createEditorDocumentState(draft: string): EditorDocumentState {
  const { frontmatter, body } = parseFrontmatter(draft);
  const rawBlocks = parseMarkdown(body);
  const blocks = rawBlocks.map(ensureBlockId);

  return {
    rawText: draft,
    frontmatter,
    blocks,
  };
}
