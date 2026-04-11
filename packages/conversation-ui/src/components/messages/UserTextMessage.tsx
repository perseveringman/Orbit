// ---------------------------------------------------------------------------
// UserTextMessage – Right-aligned chat bubble for user text messages
// ---------------------------------------------------------------------------

import React from 'react';
import type { RenderableMessage } from '../../types.js';

export interface UserTextMessageProps {
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
      <mark key={i} className="bg-warning-soft text-inherit rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export const UserTextMessage = React.memo<UserTextMessageProps>(
  function UserTextMessage({ message, searchQuery }) {
    return (
      <div className="flex w-full justify-end" data-testid={`user-text-${message.id}`}>
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent text-accent-foreground px-4 py-2.5 shadow-sm">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {highlightText(message.content, searchQuery)}
          </p>
          <time
            className="block text-[10px] opacity-60 mt-1 text-right"
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
