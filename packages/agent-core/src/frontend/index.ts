// ---------------------------------------------------------------------------
// @orbit/agent-core – Frontend Integration Layer (M10)
// ---------------------------------------------------------------------------

export { EventBus, type EventListener, type Unsubscribe } from './event-bus.js';

export {
  AgentSessionState,
  type UIMessage,
  type UIToolCall,
  type SessionUIState,
  type StateChangeListener,
} from './agent-session-state.js';

export {
  InMemoryTransport,
  type MessageTransport,
  type FrontendMessage,
  type BackendMessage,
} from './ipc-protocol.js';

export { AgentBridge, type AgentBridgeOptions } from './agent-bridge.js';
