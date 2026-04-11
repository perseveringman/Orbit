// ---------------------------------------------------------------------------
// MessageRow – Type dispatcher that renders the correct message component
// ---------------------------------------------------------------------------

import React from 'react';

import type { RenderableMessage } from '../types.js';
import {
  UserTextMessage,
  UserImageMessage,
  AssistantTextMessage,
  AssistantToolUseMessage,
  AssistantThinkingMessage,
  GroupedToolUseMessage,
  CollapsedReadSearchMessage,
  SystemMessage,
  ErrorMessage,
  PermissionRequestMessage,
  StreamingMessage,
} from './messages/index.js';

export interface MessageRowProps {
  readonly message: RenderableMessage;
  readonly searchQuery?: string;
  readonly onToggleCollapse?: (messageId: string) => void;
  readonly onApprove?: (approvalId: string) => void;
  readonly onReject?: (approvalId: string) => void;
  readonly onRetry?: () => void;
}

export const MessageRow = React.memo(function MessageRow({
  message,
  searchQuery,
  onToggleCollapse,
  onApprove,
  onReject,
  onRetry,
}: MessageRowProps) {
  switch (message.type) {
    case 'user-text':
      return <UserTextMessage message={message} searchQuery={searchQuery} />;
    case 'user-image':
      return <UserImageMessage message={message} searchQuery={searchQuery} />;
    case 'assistant-text':
      return <AssistantTextMessage message={message} searchQuery={searchQuery} />;
    case 'assistant-tool-use':
      return <AssistantToolUseMessage message={message} searchQuery={searchQuery} />;
    case 'assistant-thinking':
      return (
        <AssistantThinkingMessage
          message={message}
          onToggleCollapse={onToggleCollapse}
        />
      );
    case 'grouped-tool-use':
      return (
        <GroupedToolUseMessage
          message={message}
          onToggleCollapse={onToggleCollapse}
          searchQuery={searchQuery}
        />
      );
    case 'collapsed-read-search':
      return (
        <CollapsedReadSearchMessage
          message={message}
          onToggleCollapse={onToggleCollapse}
        />
      );
    case 'system':
      return <SystemMessage message={message} />;
    case 'error':
      return <ErrorMessage message={message} onRetry={onRetry} />;
    case 'permission-request':
      return (
        <PermissionRequestMessage
          message={message}
          onApprove={onApprove}
          onReject={onReject}
        />
      );
    case 'streaming':
      return <StreamingMessage message={message} />;
    default:
      return null;
  }
});
