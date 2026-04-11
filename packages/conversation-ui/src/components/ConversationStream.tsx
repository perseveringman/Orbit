// ---------------------------------------------------------------------------
// ConversationStream – Message list container with streaming injection
// ---------------------------------------------------------------------------

import React, { useRef, useEffect, useMemo } from 'react';

import type { RenderableMessage, UIStreamingState } from '../types.js';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, streamingState?.lastUpdate]);

  // Build synthetic streaming message when active
  const syntheticStreamingMsg = useMemo<RenderableMessage | null>(() => {
    if (!streamingState?.isStreaming) return null;
    return {
      id: '__streaming__',
      type: 'streaming',
      timestamp: new Date(streamingState.lastUpdate).toISOString(),
      content: streamingState.content,
      isStreaming: true,
    };
  }, [streamingState?.isStreaming, streamingState?.content, streamingState?.lastUpdate]);

  return (
    <div
      ref={scrollRef}
      className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
    >
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
  );
});
