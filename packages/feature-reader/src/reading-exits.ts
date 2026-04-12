// ── Reading-to-Flow Exit Points ────────────────────────────

export type ReadingExitKind =
  | 'to_highlight'
  | 'to_note'
  | 'to_research'
  | 'to_action'
  | 'to_writing';

export interface AnchorData {
  readonly paragraphIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface ReadingExit {
  readonly kind: ReadingExitKind;
  readonly sourceArticleId: string;
  readonly selectedText: string;
  readonly anchorData: AnchorData | null;
  readonly targetObjectType: string;
}

export function createHighlightExit(
  articleId: string,
  selectedText: string,
  anchorData?: AnchorData,
): ReadingExit {
  return {
    kind: 'to_highlight',
    sourceArticleId: articleId,
    selectedText,
    anchorData: anchorData ?? null,
    targetObjectType: 'highlight',
  };
}

export function createNoteExit(
  articleId: string,
  selectedText: string,
  anchorData?: AnchorData,
): ReadingExit {
  return {
    kind: 'to_note',
    sourceArticleId: articleId,
    selectedText,
    anchorData: anchorData ?? null,
    targetObjectType: 'note',
  };
}

export function createResearchExit(
  articleId: string,
  selectedText: string,
  anchorData?: AnchorData,
): ReadingExit {
  return {
    kind: 'to_research',
    sourceArticleId: articleId,
    selectedText,
    anchorData: anchorData ?? null,
    targetObjectType: 'research_question',
  };
}

export function createActionExit(
  articleId: string,
  selectedText: string,
  anchorData?: AnchorData,
): ReadingExit {
  return {
    kind: 'to_action',
    sourceArticleId: articleId,
    selectedText,
    anchorData: anchorData ?? null,
    targetObjectType: 'task',
  };
}

export function createWritingExit(
  articleId: string,
  selectedText: string,
  anchorData?: AnchorData,
): ReadingExit {
  return {
    kind: 'to_writing',
    sourceArticleId: articleId,
    selectedText,
    anchorData: anchorData ?? null,
    targetObjectType: 'draft',
  };
}
