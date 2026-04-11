// ---------------------------------------------------------------------------
// @orbit/conversation-ui – Public API
// ---------------------------------------------------------------------------

// Types
export * from './types.js';

// Normalize pipeline
export { normalizeMessages, type NormalizeOptions } from './normalize.js';

// Message components
export {
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
} from './components/messages/index.js';

// Layout components
export { MessageRow, type MessageRowProps } from './components/MessageRow.js';
export { ConversationStream, type ConversationStreamProps } from './components/ConversationStream.js';
export { ConversationHeader, type ConversationHeaderProps } from './components/ConversationHeader.js';
