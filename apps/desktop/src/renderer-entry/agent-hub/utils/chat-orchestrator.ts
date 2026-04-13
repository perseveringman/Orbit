// ---------------------------------------------------------------------------
// chat-orchestrator – Tool-calling LLM chat loop (renderer-side)
//
// Orchestrates multi-turn conversations with function calling:
//   User message → LLM (with tools) → tool_calls → execute → loop → final response
//
// Yields events that map directly to AgentMessage insertions and status updates.
// The ChatPage appends messages to its state; the normalize pipeline renders them.
// ---------------------------------------------------------------------------

import {
  getCatalogEntry,
  toOpenAITools,
  fromOpenAIResponse,
  CORE_TOOLSETS,
  APP_TOOLSETS,
  DOMAIN_TOOLSETS,
  ToolsetRegistry,
  type ProviderCatalogEntry,
  type ToolDefinition,
  type ChatCompletionResponse,
  type AgentMessage,
  type AgentToolCall,
  type TokenUsage,
} from '@orbit/agent-core';
import type { LLMProviderUserConfig } from '../stores/llm-config-store';
import type { McpServerInfo } from '../../../shared/contracts';

// ---- Event types emitted by the orchestrator ----

export type ChatOrchestratorEvent =
  | { readonly type: 'message'; readonly message: AgentMessage }
  | { readonly type: 'thinking'; readonly text: string }
  | { readonly type: 'token-usage'; readonly usage: TokenUsage }
  | { readonly type: 'completed' }
  | { readonly type: 'error'; readonly error: string };

// ---- Configuration ----

export interface OrchestratorConfig {
  /** Max tool-calling iterations before aborting (default: 10). */
  maxIterations?: number;
  /** Enable tool calling (default: true). */
  enableTools?: boolean;
}

// ---- Bridge helper ----

function getDesktopBridge(): any | undefined {
  return (window as any).orbitDesktop;
}

function buildAuthHeaders(
  entry: ProviderCatalogEntry,
  apiKey: string,
): Record<string, string> {
  if (!apiKey) return {};
  if (entry.useBearerAuth) return { Authorization: `Bearer ${apiKey}` };
  if (entry.usesXApiKey || entry.transport === 'anthropic_messages')
    return { 'x-api-key': apiKey };
  return { Authorization: `Bearer ${apiKey}` };
}

// ---- Tool registry (initialized once) ----

let _toolsetRegistry: ToolsetRegistry | null = null;
let _toolDefs: readonly ToolDefinition[] = [];

function getToolsetRegistry(): ToolsetRegistry {
  if (!_toolsetRegistry) {
    _toolsetRegistry = new ToolsetRegistry();
    for (const ts of CORE_TOOLSETS) _toolsetRegistry.register(ts);
    for (const ts of APP_TOOLSETS) _toolsetRegistry.register(ts);
    for (const ts of DOMAIN_TOOLSETS) _toolsetRegistry.register(ts);
    _toolDefs = _toolsetRegistry.toToolDefinitions();
  }
  return _toolsetRegistry;
}

export function getAvailableToolDefinitions(): readonly ToolDefinition[] {
  getToolsetRegistry();
  return _toolDefs;
}

export function getAvailableToolCount(): number {
  return getAvailableToolDefinitions().length;
}

// ---- MCP tool definitions ----

/**
 * Fetch MCP server tools and convert them to ToolDefinition format.
 */
async function getMcpToolDefinitions(bridge: any): Promise<readonly ToolDefinition[]> {
  try {
    const servers: McpServerInfo[] = await bridge.mcpListServers();
    const defs: ToolDefinition[] = [];
    for (const server of servers) {
      if (server.status !== 'connected') continue;
      for (const tool of server.tools) {
        defs.push({
          name: `mcp_${server.id}_${tool.name}`,
          description: `[MCP: ${server.name}] ${tool.description}`,
          inputSchema: tool.inputSchema,
          domain: 'ops',
          riskLevel: 'R2-external-read',
          approvalPolicy: 'A0-auto',
          executionMode: 'sync',
          scopeLimit: 'global',
          dataBoundary: 'can-egress',
        });
      }
    }
    return defs;
  } catch {
    return [];
  }
}

/**
 * Get ALL tool definitions: built-in + MCP.
 */
async function getAllToolDefinitions(bridge: any): Promise<readonly ToolDefinition[]> {
  const builtIn = getAvailableToolDefinitions();
  const mcp = await getMcpToolDefinitions(bridge);
  return [...builtIn, ...mcp];
}

// ---- Anthropic tool format helpers ----

function toAnthropicTools(defs: readonly ToolDefinition[]): readonly Record<string, unknown>[] {
  return defs.map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: d.inputSchema,
  }));
}

function fromAnthropicResponse(json: Record<string, any>): ChatCompletionResponse {
  const content = json.content as any[] | undefined;
  let text = '';
  const toolCalls: AgentToolCall[] = [];

  if (content) {
    for (const block of content) {
      if (block.type === 'text') {
        text += block.text ?? '';
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id ?? `tc_${toolCalls.length}`,
          name: block.name ?? '',
          arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input ?? {}),
        });
      }
    }
  }

  const stopReason = json.stop_reason as string | undefined;
  const hasToolUse = stopReason === 'tool_use' || toolCalls.length > 0;

  const usage: TokenUsage = {
    promptTokens: (json.usage?.input_tokens as number) ?? 0,
    completionTokens: (json.usage?.output_tokens as number) ?? 0,
    totalTokens: ((json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0)) as number,
  };

  return {
    id: (json.id as string) ?? '',
    choices: [
      {
        message: {
          id: (json.id as string) ?? '',
          role: 'assistant',
          content: text,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          timestamp: new Date().toISOString(),
        },
        finishReason: hasToolUse ? 'tool_calls' : 'stop',
      },
    ],
    usage,
  };
}

// ---- Core orchestrator ----

let _msgSeq = 0;
function genMsgId(prefix: string): string {
  return `${prefix}-${++_msgSeq}-${Date.now().toString(36)}`;
}

/**
 * Run a tool-calling chat loop. Yields events as they occur.
 *
 * The loop:
 * 1. Call LLM with full conversation + tool definitions
 * 2. Yield the assistant response as a `message` event
 * 3. If tool_calls → execute each tool, yield tool result `message` events, goto 1
 * 4. If no tool_calls → yield `completed` → done
 *
 * The ChatPage appends each `message` event to its messages array.
 * The normalize pipeline handles grouping tool calls with results.
 */
export async function* runToolCallingChat(
  provider: LLMProviderUserConfig,
  conversationHistory: readonly AgentMessage[],
  config?: OrchestratorConfig,
): AsyncGenerator<ChatOrchestratorEvent> {
  const entry = getCatalogEntry(provider.providerId);
  if (!entry) {
    yield { type: 'error', error: `Unknown provider: ${provider.providerId}` };
    return;
  }

  const bridge = getDesktopBridge();
  if (!bridge) {
    yield { type: 'error', error: 'Desktop bridge not available' };
    return;
  }

  const maxIterations = config?.maxIterations ?? 10;
  const enableTools = config?.enableTools ?? true;
  const isAnthropic = entry.transport === 'anthropic_messages';

  // Get tool definitions for LLM (includes built-in + MCP tools)
  const toolDefs = enableTools ? await getAllToolDefinitions(bridge) : [];

  // Working copy of conversation — tool call/result messages are added during the loop
  const conversation: AgentMessage[] = [...conversationHistory];
  const accUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let iterations = 0;

  yield { type: 'thinking', text: `Calling ${entry.displayName}${toolDefs.length > 0 ? ` with ${toolDefs.length} tools` : ''}...` };

  while (iterations < maxIterations) {
    iterations++;

    let response: ChatCompletionResponse;
    try {
      response = await callLLM(bridge, entry, provider, conversation, toolDefs, isAnthropic);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      yield { type: 'error', error: msg };
      return;
    }

    // Accumulate token usage
    accUsage.promptTokens += response.usage.promptTokens;
    accUsage.completionTokens += response.usage.completionTokens;
    accUsage.totalTokens += response.usage.totalTokens;

    const choice = response.choices[0];
    if (!choice) {
      yield { type: 'error', error: 'Empty response from LLM' };
      return;
    }

    // Add assistant message to working conversation
    conversation.push(choice.message);

    // Yield the assistant message (with or without tool calls) for UI rendering
    yield { type: 'message', message: choice.message };

    // No tool calls → we're done
    if (choice.finishReason !== 'tool_calls' || !choice.message.toolCalls?.length) {
      yield { type: 'token-usage', usage: { ...accUsage } };
      yield { type: 'completed' };
      return;
    }

    // Execute each tool call and yield results as messages
    yield { type: 'thinking', text: `Executing ${choice.message.toolCalls.length} tool(s)...` };

    for (const tc of choice.message.toolCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }

      const toolResult = await executeTool(bridge, tc.name, args);

      const resultMsg: AgentMessage = {
        id: genMsgId('tool'),
        role: 'tool',
        content: toolResult.success ? toolResult.output : (toolResult.error ?? 'Unknown error'),
        toolCallId: tc.id,
        timestamp: new Date().toISOString(),
        metadata: {
          success: toolResult.success,
          durationMs: toolResult.durationMs,
        },
      };

      conversation.push(resultMsg);
      yield { type: 'message', message: resultMsg };
    }

    // Loop continues — LLM will see tool results and decide next action
    yield { type: 'thinking', text: 'Processing tool results...' };
  }

  yield { type: 'error', error: `Reached maximum tool iterations (${maxIterations})` };
}

// ---- LLM call helper ----

async function callLLM(
  bridge: any,
  entry: ProviderCatalogEntry,
  provider: LLMProviderUserConfig,
  conversation: readonly AgentMessage[],
  toolDefs: readonly ToolDefinition[],
  isAnthropic: boolean,
): Promise<ChatCompletionResponse> {
  const baseUrl = (provider.baseUrl || entry.defaultBaseUrl).replace(/\/+$/, '');
  const model = provider.defaultModel || entry.defaultModel;

  const url = isAnthropic
    ? baseUrl.endsWith('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`
    : `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...buildAuthHeaders(entry, provider.apiKey),
  };
  if (isAnthropic) {
    headers['anthropic-version'] = '2023-06-01';
  }

  const body = isAnthropic
    ? buildAnthropicBody(conversation, model, toolDefs)
    : buildOpenAIBody(conversation, model, toolDefs);

  const response = await bridge.llmProxy({
    url,
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  });

  if (!response.ok) {
    let errorDetail = response.body;
    try {
      const errJson = JSON.parse(response.body) as Record<string, any>;
      errorDetail = errJson.error?.message ?? errJson.message ?? response.body;
    } catch { /* use raw body */ }
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${String(errorDetail).slice(0, 300)}`);
  }

  const json = JSON.parse(response.body) as Record<string, unknown>;
  return isAnthropic ? fromAnthropicResponse(json as any) : fromOpenAIResponse(json);
}

// ---- Request body builders ----

function buildOpenAIBody(
  conversation: readonly AgentMessage[],
  model: string,
  toolDefs: readonly ToolDefinition[],
): Record<string, unknown> {
  const messages = conversation.map((m) => {
    const obj: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.toolCalls?.length) {
      obj['tool_calls'] = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      }));
    }
    if (m.toolCallId) {
      obj['tool_call_id'] = m.toolCallId;
    }
    return obj;
  });

  const body: Record<string, unknown> = { model, messages };
  if (toolDefs.length > 0) {
    body['tools'] = toOpenAITools(toolDefs);
  }
  return body;
}

function buildAnthropicBody(
  conversation: readonly AgentMessage[],
  model: string,
  toolDefs: readonly ToolDefinition[],
): Record<string, unknown> {
  const systemMsgs = conversation.filter((m) => m.role === 'system');
  const nonSystemMsgs = conversation.filter((m) => m.role !== 'system');

  // Convert messages to Anthropic format
  const messages: Record<string, unknown>[] = [];
  for (const m of nonSystemMsgs) {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      // Assistant message with tool calls → content blocks
      const content: any[] = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls) {
        let input: unknown;
        try { input = JSON.parse(tc.arguments); } catch { input = {}; }
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
      }
      messages.push({ role: 'assistant', content });
    } else if (m.role === 'tool') {
      // Tool result → user message with tool_result content block
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
      });
    } else {
      messages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      });
    }
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages,
  };

  if (systemMsgs.length > 0) {
    body['system'] = systemMsgs.map((m) => m.content).join('\n\n');
  }
  if (toolDefs.length > 0) {
    body['tools'] = toAnthropicTools(toolDefs);
  }

  return body;
}

// ---- Tool execution (via IPC to main process) ----

interface ToolExecResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

async function executeTool(
  bridge: any,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolExecResult> {
  try {
    // MCP tools have names like "mcp_{serverId}_{toolName}"
    if (name.startsWith('mcp_')) {
      const parts = name.split('_');
      // Format: mcp_{serverId}_{toolName} — serverId and toolName may contain underscores
      const serverId = parts[1];
      const toolName = parts.slice(2).join('_');
      const result = await bridge.mcpExecuteTool({ serverId, toolName, args });
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        durationMs: result.durationMs,
      };
    }

    // Built-in tools — route through IPC to main process
    const result = await bridge.toolExecute({ toolName: name, args });
    return {
      success: result.success,
      output: result.output,
      error: result.error,
      durationMs: result.durationMs,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      output: '',
      error: `Tool execution error: ${message}`,
      durationMs: 0,
    };
  }
}
