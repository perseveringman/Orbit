// ---------------------------------------------------------------------------
// AssistantTextMessage – Left-aligned assistant message with avatar + markdown
// ---------------------------------------------------------------------------

import React, { useMemo } from 'react';
import type { RenderableMessage } from '../../types.js';
import { renderMarkdown } from './markdown.js';

export interface AssistantTextMessageProps {
  readonly message: RenderableMessage;
  readonly searchQuery?: string;
}

export const AssistantTextMessage = React.memo<AssistantTextMessageProps>(
  function AssistantTextMessage({ message, searchQuery }) {
    const renderedContent = useMemo(() => renderMarkdown(message.content), [message.content]);

    return (
      <div className="self-start flex items-start gap-3 max-w-[90%]" data-testid={`assistant-text-${message.id}`}>
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-tertiary flex items-center justify-center text-sm select-none mt-0.5"
          aria-hidden="true"
        >
          🤖
        </div>

        {/* Message body */}
        <div className="min-w-0">
          <div className="rounded-2xl rounded-tl-sm bg-surface text-foreground px-4 py-2.5 shadow-sm ring-1 ring-border">
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
