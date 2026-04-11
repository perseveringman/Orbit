import type { SelectionMode } from '@orbit/app-viewmodels';
import { createEditorDocumentState, type EditorDocumentState } from './editor-state';

export interface EditorDomModuleInput {
  draft: string;
  selectionMode: SelectionMode;
  placeholder?: string;
}

export interface EditorDomModule {
  kind: 'dom-editor';
  rootRole: 'textbox';
  placeholder: string;
  selectionMode: SelectionMode;
  document: EditorDocumentState;
  commands: string[];
}

export function createEditorDomModule(input: EditorDomModuleInput): EditorDomModule {
  return {
    kind: 'dom-editor',
    rootRole: 'textbox',
    placeholder: input.placeholder ?? '开始记录今天的想法',
    selectionMode: input.selectionMode,
    document: createEditorDocumentState(input.draft),
    commands: ['insertHeading', 'insertParagraph', 'toggleQuote']
  };
}
