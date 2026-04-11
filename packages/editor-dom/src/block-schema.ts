export type BlockKind =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'list-item'
  | 'callout'
  | 'quote'
  | 'code'
  | 'table'
  | 'table-row'
  | 'table-cell'
  | 'image'
  | 'divider'
  | 'reference'
  | 'snapshot'
  | 'embed';

export interface Block {
  readonly id: string;
  readonly kind: BlockKind;
  readonly text: string;
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly children?: readonly Block[];
}

export function createBlock(
  kind: BlockKind,
  text: string,
  attrs: Readonly<Record<string, unknown>> = {},
  children?: readonly Block[]
): Block {
  const block: Block = { id: '', kind, text, attrs };
  if (children !== undefined) {
    return { ...block, children };
  }
  return block;
}
