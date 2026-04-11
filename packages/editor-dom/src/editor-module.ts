import type { SelectionMode } from '@orbit/app-viewmodels';
import { createEditorDocumentState, type EditorDocumentState } from './editor-state.js';
import { type EditorMode, getEditorModeConfig, type EditorModeConfig } from './editor-modes.js';
import { getSlashMenuItems, type SlashMenuItem } from './slash-menu.js';

export interface EditorDomModuleInput {
  readonly draft: string;
  readonly selectionMode: SelectionMode;
  readonly placeholder?: string;
  readonly mode?: EditorMode;
}

export interface EditorDomModule {
  readonly kind: 'dom-editor';
  readonly rootRole: 'textbox';
  readonly placeholder: string;
  readonly selectionMode: SelectionMode;
  readonly document: EditorDocumentState;
  readonly commands: readonly string[];
  readonly modeConfig: EditorModeConfig;
  readonly slashMenuItems: readonly SlashMenuItem[];
}

export function createEditorDomModule(input: EditorDomModuleInput): EditorDomModule {
  const mode = input.mode ?? 'note';
  const modeConfig = getEditorModeConfig(mode);
  return {
    kind: 'dom-editor',
    rootRole: 'textbox',
    placeholder: input.placeholder ?? '开始记录今天的想法',
    selectionMode: input.selectionMode,
    document: createEditorDocumentState(input.draft),
    commands: ['insertHeading', 'insertParagraph', 'toggleQuote'],
    modeConfig,
    slashMenuItems: getSlashMenuItems(mode),
  };
}
