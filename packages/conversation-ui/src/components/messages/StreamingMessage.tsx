// ---------------------------------------------------------------------------
// StreamingMessage – Renders in-progress assistant content with blinking cursor
// ---------------------------------------------------------------------------

import React from 'react';

import type { RenderableMessage } from '../../types.js';

export interface StreamingMessageProps {
  readonly message: RenderableMessage;
}

/**
 * Displays streaming assistant text with a blinking block cursor appended.
 * Same left-aligned layout as AssistantTextMessage.
 */
export const StreamingMessage = React.memo(function StreamingMessage({
  message,
}: StreamingMessageProps) {
  return (
    <div className="self-start flex items-start gap-3 max-w-[90%]">
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-tertiary flex items-center justify-center text-sm select-none mt-0.5"
        aria-hidden="true"
      >
        🤖
      </div>
      <div className="min-w-0">
        <div className="rounded-2xl rounded-tl-sm bg-surface text-foreground px-4 py-2.5 shadow-sm ring-1 ring-border">
          <span className="whitespace-pre-wrap text-sm">{message.content}</span>
          <span
            className="ml-0.5 inline-block animate-pulse text-accent"
            aria-hidden="true"
          >
            ▊
          </span>
        </div>
      </div>
    </div>
  );
});
