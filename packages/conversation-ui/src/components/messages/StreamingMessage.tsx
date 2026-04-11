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
    <div className="flex w-full items-start gap-3">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center text-base select-none"
        aria-hidden="true"
      >
        🤖
      </div>
      <div className="max-w-[85%] min-w-0">
        <div className="rounded-2xl rounded-tl-sm bg-surface-secondary text-foreground px-4 py-2.5 shadow-sm">
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
