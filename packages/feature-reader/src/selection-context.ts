import type { AnchorPayload } from '@orbit/domain';
import type { AnchorData, ReadingExitKind, ReadingExit } from './reading-exits.js';
import { createAnchorPayload } from './highlight-engine.js';

// ── Selection types ────────────────────────────────────────

export type SelectionSource = 'article' | 'transcript' | 'book' | 'note';

export interface TextSelection {
  readonly text: string;
  readonly anchorData: AnchorData;
  readonly source: SelectionSource;
  readonly sourceId: string;
}

// ── Selection context ──────────────────────────────────────

export interface SelectionContext {
  readonly selection: TextSelection;
  readonly anchor: AnchorPayload;
  readonly surroundingText: string;
  readonly createdAt: string;
}

/**
 * Create a SelectionContext from a text selection within a document.
 */
export function createSelectionContext(
  selection: TextSelection,
  fullText: string,
  sourceVersion?: string,
): SelectionContext {
  const anchor = createAnchorPayload({
    fullText,
    selectedText: selection.text,
    anchorData: selection.anchorData,
    sourceVersion,
  });

  const contextRadius = 100;
  const paragraphs = fullText.split('\n');
  const pIdx = selection.anchorData.paragraphIndex;
  const startPara = Math.max(0, pIdx - 1);
  const endPara = Math.min(paragraphs.length - 1, pIdx + 1);
  const surroundingText = paragraphs.slice(startPara, endPara + 1).join('\n');

  return {
    selection,
    anchor,
    surroundingText,
    createdAt: new Date().toISOString(),
  };
}

// ── Selection to exit conversion ───────────────────────────

export interface SelectionAction {
  readonly exitKind: ReadingExitKind;
  readonly label: string;
  readonly icon: string;
  readonly shortcut?: string;
}

const BASE_ACTIONS: readonly SelectionAction[] = [
  { exitKind: 'to_highlight', label: 'Highlight', icon: '🖍️', shortcut: 'h' },
  { exitKind: 'to_note', label: 'Note', icon: '📝', shortcut: 'n' },
  { exitKind: 'to_research', label: 'Research', icon: '🔬', shortcut: 'r' },
  { exitKind: 'to_action', label: 'Action', icon: '✅', shortcut: 'a' },
  { exitKind: 'to_writing', label: 'Writing', icon: '✍️', shortcut: 'w' },
];

/**
 * Available actions for a given selection context.
 * All selections can: highlight, note, research, action, writing.
 * Transcript selections additionally support: to_research with speaker context.
 */
export function getAvailableActions(context: SelectionContext): readonly SelectionAction[] {
  if (context.selection.source === 'transcript') {
    return [
      ...BASE_ACTIONS,
      { exitKind: 'to_research', label: 'Research Speaker', icon: '🎙️' },
    ];
  }
  return BASE_ACTIONS;
}

const EXIT_KIND_TO_OBJECT_TYPE: Record<ReadingExitKind, string> = {
  to_highlight: 'highlight',
  to_note: 'note',
  to_research: 'research_question',
  to_action: 'task',
  to_writing: 'draft',
};

/**
 * Convert a selection context + chosen action into a ReadingExit.
 */
export function createExitFromSelection(
  context: SelectionContext,
  exitKind: ReadingExitKind,
): ReadingExit {
  return {
    kind: exitKind,
    sourceArticleId: context.selection.sourceId,
    selectedText: context.selection.text,
    anchorData: context.selection.anchorData,
    targetObjectType: EXIT_KIND_TO_OBJECT_TYPE[exitKind],
  };
}

// ── Selection menu positioning ─────────────────────────────

export interface SelectionMenuPosition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Compute menu position based on selection bounds.
 * Menu appears above the selection, centered horizontally.
 */
export function computeMenuPosition(
  selectionRect: SelectionMenuPosition,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { readonly x: number; readonly y: number } {
  // Center horizontally above the selection
  let x = selectionRect.x + selectionRect.width / 2 - menuWidth / 2;
  let y = selectionRect.y - menuHeight - 8; // 8px gap above selection

  // Clamp to left edge
  if (x < 0) x = 0;
  // Clamp to right edge
  if (x + menuWidth > viewportWidth) x = viewportWidth - menuWidth;

  // If too close to top, show below selection instead
  if (y < 0) {
    y = selectionRect.y + selectionRect.height + 8;
  }

  // If still overflowing bottom, clamp to bottom
  if (y + menuHeight > viewportHeight) {
    y = viewportHeight - menuHeight;
  }

  return { x, y };
}
