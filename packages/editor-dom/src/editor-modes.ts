import type { BlockKind } from './block-schema.js';
import type { SlashMenuGroup } from './slash-menu.js';

export type EditorMode = 'note' | 'research' | 'writing';

export interface EditorModeConfig {
  readonly mode: EditorMode;
  readonly blockIdPolicy: 'lazy' | 'required' | 'required-with-provenance';
  readonly provenanceRequired: boolean;
  readonly allowedBlockKinds: readonly BlockKind[];
  readonly slashMenuGroups: readonly SlashMenuGroup[];
}

const BASIC_KINDS: readonly BlockKind[] = [
  'paragraph', 'heading', 'list', 'list-item',
  'quote', 'code', 'image', 'divider', 'table',
  'table-row', 'table-cell',
];

const RESEARCH_KINDS: readonly BlockKind[] = [
  ...BASIC_KINDS, 'callout', 'reference', 'snapshot',
];

const WRITING_KINDS: readonly BlockKind[] = [
  ...RESEARCH_KINDS, 'embed',
];

const configs: Record<EditorMode, EditorModeConfig> = {
  note: {
    mode: 'note',
    blockIdPolicy: 'lazy',
    provenanceRequired: false,
    allowedBlockKinds: BASIC_KINDS,
    slashMenuGroups: ['basic'],
  },
  research: {
    mode: 'research',
    blockIdPolicy: 'required',
    provenanceRequired: false,
    allowedBlockKinds: RESEARCH_KINDS,
    slashMenuGroups: ['basic', 'reference', 'research'],
  },
  writing: {
    mode: 'writing',
    blockIdPolicy: 'required-with-provenance',
    provenanceRequired: true,
    allowedBlockKinds: WRITING_KINDS,
    slashMenuGroups: ['basic', 'reference', 'research', 'writing'],
  },
};

export function getEditorModeConfig(mode: EditorMode): EditorModeConfig {
  return configs[mode];
}
