// ---------------------------------------------------------------------------
// AssistantTextMessage – Left-aligned assistant message with avatar
// ---------------------------------------------------------------------------

import React from 'react';
import type { RenderableMessage } from '../../types.js';

export interface AssistantTextMessageProps {
  readonly message: RenderableMessage;
  readonly searchQuery?: string;
}

/** Wrap occurrences of `query` in `<mark>` tags for visual highlighting. */
function highlightText(text: string, query: string | undefined): React.ReactNode {
  if (!query || query.length === 0) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-warning/40 text-inherit rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export const AssistantTextMessage = React.memo<AssistantTextMessageProps>(
  function AssistantTextMessage({ message, searchQuery }) {
    return (
      <div className="flex w-full items-start gap-3" data-testid={`assistant-text-${message.id}`}>
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full bg-default-100 flex items-center justify-center text-base select-none"
          aria-hidden="true"
        >
          🤖
        </div>

        {/* Message body */}
        <div className="max-w-[85%] min-w-0">
          <div className="rounded-2xl rounded-tl-sm bg-default-100 text-foreground px-4 py-2.5 shadow-sm">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {highlightText(message.content, searchQuery)}
            </p>
          </div>
          <time
            className="block text-[10px] text-default-400 mt-1 ml-1"
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
