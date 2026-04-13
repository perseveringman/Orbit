// ---------------------------------------------------------------------------
// @orbit/conversation-ui – Public API
// ---------------------------------------------------------------------------

// Types
export * from './types.js';

// Hooks
export * from './hooks/index.js';

// Error handling utilities
export { classifyError, errorToRenderableMessage, useRetryCountdown } from './errors.js';
export type { ClassifiedError, RetryCountdownState } from './errors.js';

// Normalize pipeline
export { normalizeMessages, type NormalizeOptions } from './normalize.js';

// Streaming scheduler (sentence-split, text-chunk, emit-chain)
export {
  StreamingScheduler,
  SentenceSplitter,
  EmitChain,
  chunkText,
} from './streaming/index.js';
export type {
  StreamingSchedulerOptions,
  SchedulerEmitCallback,
  SentenceSplitterOptions,
  EmitCallback,
  EmitOptions,
  TextChunkerOptions,
  TextChunk,
} from './streaming/index.js';

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

// Panel components
export {
  SessionSidePanel,
  SessionInfo,
  ToolCallTimeline,
  PermissionStatus,
} from './components/panels/index.js';
export type { PermissionMode } from './components/panels/SessionSidePanel.js';

// Input components
export { PromptInput, type PromptInputProps, InputFooter, type InputFooterProps } from './components/input/index.js';
