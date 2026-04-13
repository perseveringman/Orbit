// ---------------------------------------------------------------------------
// markdown.tsx – Shared lightweight Markdown → React renderer
// ---------------------------------------------------------------------------
// Extracted from AssistantTextMessage for reuse across streaming and static
// message components. Handles fenced code blocks, inline code, bold, italic.
// ---------------------------------------------------------------------------

import React from 'react';

/** Lightweight markdown → React nodes. Handles code blocks, inline code, bold, italic. */
export function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderInline(text.slice(lastIndex, match.index), nodes.length));
    }
    nodes.push(
      <pre key={`cb-${nodes.length}`} className="my-2 overflow-x-auto rounded-md bg-surface-tertiary p-3 text-xs">
        <code>{match[2]}</code>
      </pre>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderInline(text.slice(lastIndex), nodes.length));
  }

  return nodes;
}

/** Render inline markdown: bold, italic, inline code. */
function renderInline(text: string, keyOffset: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = inlineRegex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index));
    }
    const raw = m[0];
    const k = `il-${keyOffset}-${parts.length}`;
    if (raw.startsWith('`')) {
      parts.push(<code key={k} className="rounded bg-surface-tertiary px-1 py-0.5 text-xs">{raw.slice(1, -1)}</code>);
    } else if (raw.startsWith('**')) {
      parts.push(<strong key={k}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith('*')) {
      parts.push(<em key={k}>{raw.slice(1, -1)}</em>);
    }
    lastIdx = m.index + raw.length;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}
