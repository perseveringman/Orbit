import type { Block } from './block-schema.js';

export function serializeBlocks(blocks: readonly Block[]): string {
  return blocks.map(serializeBlock).join('\n\n');
}

function serializeBlock(block: Block): string {
  switch (block.kind) {
    case 'heading': {
      const level = (block.attrs.level as number) ?? 1;
      return '#'.repeat(level) + ' ' + block.text;
    }
    case 'paragraph':
      return block.text;
    case 'list': {
      const ordered = block.attrs.ordered as boolean;
      return (block.children ?? [])
        .map((item, i) => (ordered ? `${i + 1}. ${item.text}` : `- ${item.text}`))
        .join('\n');
    }
    case 'list-item':
      return `- ${block.text}`;
    case 'code': {
      const lang = (block.attrs.language as string) ?? '';
      return '```' + lang + '\n' + block.text + '\n```';
    }
    case 'quote':
      return block.text
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
    case 'callout': {
      const type = (block.attrs.type as string) ?? 'info';
      const lines = block.text.split('\n');
      return `> [!${type}]\n` + lines.map((l) => `> ${l}`).join('\n');
    }
    case 'image': {
      const alt = (block.attrs.alt as string) ?? '';
      const src = (block.attrs.src as string) ?? '';
      return `![${alt}](${src})`;
    }
    case 'table': {
      const rows = block.children ?? [];
      if (rows.length === 0) return '';
      const headerCells = (rows[0].children ?? []).map((c) => c.text);
      const header = '| ' + headerCells.join(' | ') + ' |';
      const separator = '| ' + headerCells.map(() => '---').join(' | ') + ' |';
      const bodyRows = rows.slice(1).map((row) => {
        const cells = (row.children ?? []).map((c) => c.text);
        return '| ' + cells.join(' | ') + ' |';
      });
      return [header, separator, ...bodyRows].join('\n');
    }
    case 'table-row':
    case 'table-cell':
      return block.text;
    case 'divider':
      return '---';
    case 'reference':
    case 'snapshot':
    case 'embed': {
      const sourceId = (block.attrs.sourceId as string) ?? '';
      const sourceType = (block.attrs.sourceType as string) ?? '';
      return `<!-- orbit:${block.kind} sourceId=${sourceId} sourceType=${sourceType} -->\n${block.text}`;
    }
    default:
      return block.text;
  }
}
