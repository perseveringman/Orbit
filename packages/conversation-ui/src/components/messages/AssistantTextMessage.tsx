// ---------------------------------------------------------------------------
// AssistantTextMessage – Left-aligned assistant message with avatar + markdown
// ---------------------------------------------------------------------------

import React, { useMemo } from 'react';
import type { RenderableMessage } from '../../types.js';

export interface AssistantTextMessageProps {
  readonly message: RenderableMessage;
  readonly searchQuery?: string;
}

/** Lightweight markdown → React nodes. Handles code blocks, inline code, bold, italic. */
function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split by fenced code blocks first
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

export const AssistantTextMessage = React.memo<AssistantTextMessageProps>(
  function AssistantTextMessage({ message, searchQuery }) {
    const renderedContent = useMemo(() => renderMarkdown(message.content), [message.content]);

    return (
      <div className="flex w-full items-start gap-3" data-testid={`assistant-text-${message.id}`}>
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center text-base select-none"
          aria-hidden="true"
        >
          🤖
        </div>

        {/* Message body */}
        <div className="max-w-[85%] min-w-0">
          <div className="rounded-2xl rounded-tl-sm bg-surface-secondary text-foreground px-4 py-2.5 shadow-sm">
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {renderedContent}
            </div>
          </div>
          <time
            className="block text-[10px] text-muted mt-1 ml-1"
            dateTime={message.timestamp}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
      </div>
    );
  },
);
