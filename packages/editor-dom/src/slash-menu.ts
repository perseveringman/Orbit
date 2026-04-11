import type { BlockKind } from './block-schema.js';
import type { EditorMode } from './editor-modes.js';

export type SlashMenuGroup = 'basic' | 'reference' | 'research' | 'writing';

export interface SlashMenuItem {
  readonly id: string;
  readonly label: string;
  readonly kind: BlockKind;
  readonly group: SlashMenuGroup;
}

const allItems: readonly SlashMenuItem[] = [
  { id: 'paragraph', label: 'Paragraph', kind: 'paragraph', group: 'basic' },
  { id: 'heading1', label: 'Heading 1', kind: 'heading', group: 'basic' },
  { id: 'heading2', label: 'Heading 2', kind: 'heading', group: 'basic' },
  { id: 'heading3', label: 'Heading 3', kind: 'heading', group: 'basic' },
  { id: 'list', label: 'Bullet List', kind: 'list', group: 'basic' },
  { id: 'ordered-list', label: 'Numbered List', kind: 'list', group: 'basic' },
  { id: 'quote', label: 'Quote', kind: 'quote', group: 'basic' },
  { id: 'code', label: 'Code Block', kind: 'code', group: 'basic' },
  { id: 'divider', label: 'Divider', kind: 'divider', group: 'basic' },
  { id: 'image', label: 'Image', kind: 'image', group: 'basic' },
  { id: 'table', label: 'Table', kind: 'table', group: 'basic' },
  { id: 'callout', label: 'Callout', kind: 'callout', group: 'basic' },

  { id: 'reference', label: 'Reference', kind: 'reference', group: 'reference' },
  { id: 'snapshot', label: 'Snapshot', kind: 'snapshot', group: 'reference' },

  { id: 'research-callout', label: 'Research Note', kind: 'callout', group: 'research' },

  { id: 'embed', label: 'Embed', kind: 'embed', group: 'writing' },
];

const groupsByMode: Record<EditorMode, readonly SlashMenuGroup[]> = {
  note: ['basic'],
  research: ['basic', 'reference', 'research'],
  writing: ['basic', 'reference', 'research', 'writing'],
};

export function getSlashMenuItems(mode: EditorMode): readonly SlashMenuItem[] {
  const groups = groupsByMode[mode];
  return allItems.filter((item) => groups.includes(item.group));
}
