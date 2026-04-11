import type { Block } from './block-schema.js';
import { createBlock } from './block-schema.js';

export function parseMarkdown(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip orbit:block comments
    if (line.trim().startsWith('<!-- orbit:block')) {
      i++;
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Divider: --- or *** or ___ (3+ chars, standalone line)
    if (/^-{3,}\s*$/.test(line.trim()) && !isInFrontmatter(lines, i)) {
      blocks.push(createBlock('divider', '', {}));
      i++;
      continue;
    }

    // Heading: # to ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push(createBlock('heading', headingMatch[2], { level: headingMatch[1].length }));
      i++;
      continue;
    }

    // Code block: ```
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push(createBlock('code', codeLines.join('\n'), { language: language || '' }));
      if (i < lines.length) i++; // skip closing ```
      continue;
    }

    // Image: ![alt](src)
    const imageMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      blocks.push(createBlock('image', '', { alt: imageMatch[1], src: imageMatch[2] }));
      i++;
      continue;
    }

    // Table: starts with |
    if (line.trim().startsWith('|')) {
      const tableRows: Block[] = [];
      let isFirstRow = true;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowLine = lines[i].trim();
        // Skip separator row
        if (/^\|[\s\-:|]+\|$/.test(rowLine)) {
          i++;
          continue;
        }
        const cells = rowLine
          .split('|')
          .slice(1, -1) // remove leading/trailing empty from split
          .map((cell) => createBlock('table-cell', cell.trim(), {}));
        tableRows.push(
          createBlock(
            'table-row',
            '',
            isFirstRow ? { header: true } : {},
            cells
          )
        );
        isFirstRow = false;
        i++;
      }
      blocks.push(createBlock('table', '', {}, tableRows));
      continue;
    }

    // Callout: > [!type]
    const calloutMatch = line.match(/^>\s*\[!(\w+)\]\s*(.*)$/);
    if (calloutMatch) {
      const calloutType = calloutMatch[1].toLowerCase();
      const calloutLines: string[] = [];
      if (calloutMatch[2]) calloutLines.push(calloutMatch[2]);
      i++;
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        calloutLines.push(lines[i].startsWith('> ') ? lines[i].slice(2) : '');
        i++;
      }
      blocks.push(createBlock('callout', calloutLines.join('\n'), { type: calloutType }));
      continue;
    }

    // Blockquote: >
    if (line.startsWith('> ') || line === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        quoteLines.push(lines[i].startsWith('> ') ? lines[i].slice(2) : '');
        i++;
      }
      blocks.push(createBlock('quote', quoteLines.join('\n'), {}));
      continue;
    }

    // Unordered list: - or *
    if (/^[-*]\s+/.test(line)) {
      const items: Block[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(createBlock('list-item', lines[i].replace(/^[-*]\s+/, ''), {}));
        i++;
      }
      blocks.push(createBlock('list', '', { ordered: false }, items));
      continue;
    }

    // Ordered list: 1. 2. etc.
    if (/^\d+\.\s+/.test(line)) {
      const items: Block[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(createBlock('list-item', lines[i].replace(/^\d+\.\s+/, ''), {}));
        i++;
      }
      blocks.push(createBlock('list', '', { ordered: true }, items));
      continue;
    }

    // Paragraph: collect lines until a structural element or blank line
    const paragraphLines: string[] = [];
    while (i < lines.length && isParagraphLine(lines[i])) {
      paragraphLines.push(lines[i]);
      i++;
    }
    if (paragraphLines.length > 0) {
      blocks.push(createBlock('paragraph', paragraphLines.join('\n'), {}));
    }
  }

  return blocks;
}

function isParagraphLine(line: string): boolean {
  if (line.trim() === '') return false;
  if (/^#{1,6}\s+/.test(line)) return false;
  if (line.trim().startsWith('```')) return false;
  if (line.startsWith('> ') || line === '>') return false;
  if (/^[-*]\s+/.test(line)) return false;
  if (/^\d+\.\s+/.test(line)) return false;
  if (line.trim().startsWith('|')) return false;
  if (/^-{3,}\s*$/.test(line.trim())) return false;
  if (/^!\[/.test(line.trim())) return false;
  if (line.trim().startsWith('<!-- orbit:block')) return false;
  return true;
}

function isInFrontmatter(lines: string[], idx: number): boolean {
  // Check if this --- is the opening of a frontmatter block at line 0
  if (idx === 0) return true;
  return false;
}
