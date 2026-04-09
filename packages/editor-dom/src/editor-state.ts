export type EditorBlockKind = 'heading' | 'paragraph';

        export interface EditorBlock {
          id: string;
          kind: EditorBlockKind;
          text: string;
        }

        export interface EditorDocumentState {
          rawText: string;
          blocks: EditorBlock[];
        }

        export function createEditorDocumentState(draft: string): EditorDocumentState {
          const lines = draft
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);

          const blocks = lines.map((line, index) => {
            if (line.startsWith('# ')) {
              return {
                id: `block-${index + 1}`,
                kind: 'heading' as const,
                text: line.slice(2)
              };
            }

            return {
              id: `block-${index + 1}`,
              kind: 'paragraph' as const,
              text: line
            };
          });

          return {
            rawText: draft,
            blocks
          };
        }
