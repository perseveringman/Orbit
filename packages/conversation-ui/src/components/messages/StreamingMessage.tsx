// ---------------------------------------------------------------------------
// StreamingMessage – Renders in-progress assistant content with blinking cursor
// ---------------------------------------------------------------------------
// Enhanced with:
//  - Markdown rendering (shared with AssistantTextMessage)
//  - Thinking block display (collapsible)
//  - Smooth CSS cursor animation
// ---------------------------------------------------------------------------

import React, { useMemo } from 'react';

import type { RenderableMessage } from '../../types.js';
import { renderMarkdown } from './markdown.js';

export interface StreamingMessageProps {
  readonly message: RenderableMessage;
}

/**
 * Displays streaming assistant text with Markdown rendering and an animated
 * block cursor. When a thinking block is present, it's shown above the main
 * content in a muted collapsible area.
 */
export const StreamingMessage = React.memo(function StreamingMessage({
  message,
}: StreamingMessageProps) {
  const thinking = message.metadata?.['thinking'] as string | undefined;
  const renderedContent = useMemo(() => {
    if (!message.content) return null;
    return renderMarkdown(message.content);
  }, [message.content]);

  const hasContent = !!message.content;

  return (
    <div className="self-start flex items-start gap-3 max-w-[90%]">
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-tertiary flex items-center justify-center text-sm select-none mt-0.5"
        aria-hidden="true"
      >
        🤖
      </div>
      <div className="min-w-0 flex flex-col gap-1.5">
        {/* Thinking block */}
        {thinking && (
          <details className="rounded-xl bg-surface-secondary px-3 py-2 text-xs text-muted ring-1 ring-border/50">
            <summary className="cursor-pointer select-none font-medium">
              Thinking…
            </summary>
            <p className="mt-1 whitespace-pre-wrap opacity-70">{thinking}</p>
          </details>
        )}

        {/* Waiting indicator — shown before any content arrives */}
        {!hasContent && !thinking && (
          <div className="rounded-2xl rounded-tl-sm bg-surface text-muted px-4 py-2.5 shadow-sm ring-1 ring-border">
            <div className="flex items-center gap-2 text-sm">
              <span className="streaming-dots flex gap-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted animate-[pulse_1.4s_ease-in-out_infinite]" />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
              </span>
              <span className="text-xs">思考中…</span>
            </div>
          </div>
        )}

        {/* Main content + cursor */}
        {hasContent && (
          <div className="rounded-2xl rounded-tl-sm bg-surface text-foreground px-4 py-2.5 shadow-sm ring-1 ring-border">
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {renderedContent}
              <span
                className="ml-0.5 inline-block w-[0.55em] h-[1.1em] align-text-bottom bg-accent streaming-cursor"
                aria-label="Streaming"
                role="status"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
