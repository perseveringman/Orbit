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
    <div className="flex w-full justify-start px-4 py-2">
      <div className="max-w-[85%] rounded-lg px-3 py-2 text-foreground">
        <span className="whitespace-pre-wrap">{message.content}</span>
        <span
          className="ml-0.5 inline-block animate-pulse text-primary"
          aria-hidden="true"
        >
          ▊
        </span>
      </div>
    </div>
  );
});
