// ---------------------------------------------------------------------------
// ConversationStream – Message list container with streaming injection
// ---------------------------------------------------------------------------
// Uses smart scroll management: keep-bottom during streaming, direction
// detection to disengage when user scrolls up, and throttled scroll events.
// ---------------------------------------------------------------------------

import React, { useEffect, useMemo, useRef } from 'react';

import type { RenderableMessage, UIStreamingState } from '../types.js';
import { useSmoothScroll } from '../hooks/useSmoothScroll.js';
import { useContainerResize } from '../hooks/useContainerResize.js';
import { MessageRow } from './MessageRow.js';

export interface ConversationStreamProps {
  readonly messages: readonly RenderableMessage[];
  readonly streamingState?: UIStreamingState;
  readonly searchQuery?: string;
  readonly onToggleCollapse?: (messageId: string) => void;
  readonly onApprove?: (approvalId: string) => void;
  readonly onReject?: (approvalId: string) => void;
}

export const ConversationStream = React.memo(function ConversationStream({
  messages,
  streamingState,
  searchQuery,
  onToggleCollapse,
  onApprove,
  onReject,
}: ConversationStreamProps) {
  const { scrollRef, isKeepBottom, hasNewContent, scrollToBottom, onStreamingUpdate } = useSmoothScroll();
  const { resizeRef } = useContainerResize();

  // Notify smart scroll on streaming updates
  useEffect(() => {
    if (streamingState?.isStreaming) {
      onStreamingUpdate();
    }
  }, [streamingState?.lastUpdate, streamingState?.isStreaming, onStreamingUpdate]);

  // Scroll to bottom when new messages arrive (non-streaming)
  const prevMsgCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCount.current && isKeepBottom) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages.length, isKeepBottom, scrollRef]);

  // Build synthetic streaming message when active
  const syntheticStreamingMsg = useMemo<RenderableMessage | null>(() => {
    if (!streamingState?.isStreaming) return null;
    return {
      id: '__streaming__',
      type: 'streaming',
      timestamp: new Date(streamingState.lastUpdate).toISOString(),
      content: streamingState.content,
      isStreaming: true,
      metadata: streamingState.thinking ? { thinking: streamingState.thinking } : undefined,
    };
  }, [streamingState?.isStreaming, streamingState?.content, streamingState?.lastUpdate, streamingState?.thinking]);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col overflow-y-auto"
      >
        <div ref={resizeRef} className="flex flex-col gap-4 p-4">
          {messages.map((msg) => (
            <MessageRow
              key={msg.id}
              message={msg}
              searchQuery={searchQuery}
              onToggleCollapse={onToggleCollapse}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
          {syntheticStreamingMsg && (
            <MessageRow
              key="__streaming__"
              message={syntheticStreamingMsg}
            />
          )}
        </div>
      </div>

      {/* Scroll-to-bottom FAB – shown when user has scrolled up and there's new content */}
      {hasNewContent && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-md transition-transform hover:scale-110 active:scale-95"
          aria-label="Scroll to bottom"
        >
          ↓
        </button>
      )}
    </div>
  );
});
