// ---------------------------------------------------------------------------
// @orbit/conversation-ui – normalize.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import type { AgentMessage } from '@orbit/agent-core';
import { normalizeMessages } from '../src/normalize.js';
import type { RenderableMessage } from '../src/types.js';

function msg(overrides: Partial<AgentMessage> & { id: string; role: AgentMessage['role'] }): AgentMessage {
  return {
    content: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('normalizeMessages', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeMessages([])).toEqual([]);
  });

  it('maps user text messages', () => {
    const result = normalizeMessages([msg({ id: 'u1', role: 'user', content: 'Hello' })]);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('user-text');
    expect(result[0]!.content).toBe('Hello');
  });

  it('maps user image messages when imageUrl metadata present', () => {
    const result = normalizeMessages([
      msg({ id: 'u1', role: 'user', content: 'Look', metadata: { imageUrl: 'https://img.png' } }),
    ]);
    expect(result[0]!.type).toBe('user-image');
  });

  it('maps assistant text messages', () => {
    const result = normalizeMessages([msg({ id: 'a1', role: 'assistant', content: 'Hi there' })]);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('assistant-text');
  });

  it('maps system messages', () => {
    const result = normalizeMessages([msg({ id: 's1', role: 'system', content: 'System init' })]);
    expect(result[0]!.type).toBe('system');
  });

  it('maps error messages via metadata.isError', () => {
    const result = normalizeMessages([
      msg({ id: 'e1', role: 'system', content: 'Oops', metadata: { isError: true } }),
    ]);
    expect(result[0]!.type).toBe('error');
  });

  it('maps permission requests via metadata.isPermissionRequest', () => {
    const result = normalizeMessages([
      msg({ id: 'p1', role: 'system', content: 'Allow?', metadata: { isPermissionRequest: true } }),
    ]);
    expect(result[0]!.type).toBe('permission-request');
  });

  // Rule 2: thinking extraction
  it('extracts thinking from assistant metadata into separate message', () => {
    const result = normalizeMessages([
      msg({ id: 'a1', role: 'assistant', content: 'Answer', metadata: { thinking: 'Let me think...' } }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!.type).toBe('assistant-thinking');
    expect(result[0]!.content).toBe('Let me think...');
    expect(result[0]!.isCollapsed).toBe(true);
    expect(result[1]!.type).toBe('assistant-text');
  });

  it('skips thinking extraction when metadata.thinking is empty', () => {
    const result = normalizeMessages([
      msg({ id: 'a1', role: 'assistant', content: 'Answer', metadata: { thinking: '' } }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('assistant-text');
  });

  // Rule 3: tool call pairing
  it('pairs tool calls with results', () => {
    const messages: AgentMessage[] = [
      msg({
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tc1', name: 'Read', arguments: '{"path":"foo.txt"}' }],
      }),
      msg({ id: 't1', role: 'tool', content: 'file content', toolCallId: 'tc1' }),
    ];
    const result = normalizeMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('assistant-tool-use');
    expect(result[0]!.toolCalls).toHaveLength(1);
    expect(result[0]!.toolCalls![0]!.status).toBe('success');
    expect(result[0]!.toolCalls![0]!.result).toBe('file content');
    expect(result[0]!.toolCalls![0]!.arguments).toEqual({ path: 'foo.txt' });
  });

  it('marks unpaired tool calls as pending', () => {
    const messages: AgentMessage[] = [
      msg({
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tc1', name: 'Bash', arguments: '{}' }],
      }),
    ];
    const result = normalizeMessages(messages);
    expect(result[0]!.toolCalls![0]!.status).toBe('pending');
  });

  it('marks failed tool results as error', () => {
    const messages: AgentMessage[] = [
      msg({
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tc1', name: 'Bash', arguments: '{}' }],
      }),
      msg({
        id: 't1',
        role: 'tool',
        content: 'command failed',
        toolCallId: 'tc1',
        metadata: { success: false },
      }),
    ];
    const result = normalizeMessages(messages);
    expect(result[0]!.toolCalls![0]!.status).toBe('error');
    expect(result[0]!.toolCalls![0]!.errorMessage).toBe('command failed');
  });

  it('handles malformed JSON in tool arguments gracefully', () => {
    const messages: AgentMessage[] = [
      msg({
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tc1', name: 'Read', arguments: 'not json' }],
      }),
    ];
    const result = normalizeMessages(messages);
    expect(result[0]!.toolCalls![0]!.arguments).toEqual({ raw: 'not json' });
  });

  // Rule 4: grouping
  it('groups consecutive tool-use messages when count >= threshold', () => {
    const messages: AgentMessage[] = [
      msg({ id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', name: 'Edit', arguments: '{}' }] }),
      msg({ id: 'a2', role: 'assistant', content: '', toolCalls: [{ id: 'tc2', name: 'Bash', arguments: '{}' }] }),
    ];
    const result = normalizeMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('grouped-tool-use');
    expect(result[0]!.children).toHaveLength(2);
    expect(result[0]!.toolCalls).toHaveLength(2);
  });

  it('does not group when below threshold', () => {
    const messages: AgentMessage[] = [
      msg({ id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', name: 'Edit', arguments: '{}' }] }),
    ];
    const result = normalizeMessages(messages, { groupThreshold: 3 });
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('assistant-tool-use');
  });

  it('respects custom groupThreshold', () => {
    const messages: AgentMessage[] = [
      msg({ id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', name: 'Edit', arguments: '{}' }] }),
      msg({ id: 'a2', role: 'assistant', content: '', toolCalls: [{ id: 'tc2', name: 'Bash', arguments: '{}' }] }),
      msg({ id: 'a3', role: 'assistant', content: '', toolCalls: [{ id: 'tc3', name: 'Edit', arguments: '{}' }] }),
    ];
    const result = normalizeMessages(messages, { groupThreshold: 3 });
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('grouped-tool-use');
  });

  // Rule 5: read/search collapse
  it('collapses consecutive Read/Search tool calls', () => {
    const messages: AgentMessage[] = [
      msg({ id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', name: 'Read', arguments: '{}' }] }),
      msg({ id: 'a2', role: 'assistant', content: '', toolCalls: [{ id: 'tc2', name: 'Grep', arguments: '{}' }] }),
      msg({ id: 'a3', role: 'assistant', content: '', toolCalls: [{ id: 'tc3', name: 'View', arguments: '{}' }] }),
    ];
    const result = normalizeMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('collapsed-read-search');
    expect(result[0]!.isCollapsed).toBe(true);
    expect(result[0]!.toolCalls).toHaveLength(3);
  });

  it('does not collapse when collapseReadSearch is false', () => {
    const messages: AgentMessage[] = [
      msg({ id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', name: 'Read', arguments: '{}' }] }),
      msg({ id: 'a2', role: 'assistant', content: '', toolCalls: [{ id: 'tc2', name: 'Glob', arguments: '{}' }] }),
    ];
    const result = normalizeMessages(messages, { collapseReadSearch: false });
    // Falls back to grouping (2 >= threshold of 2)
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('grouped-tool-use');
  });

  // Mixed scenarios
  it('handles mixed conversation flow correctly', () => {
    const messages: AgentMessage[] = [
      msg({ id: 'u1', role: 'user', content: 'Fix the bug' }),
      msg({
        id: 'a1',
        role: 'assistant',
        content: 'Let me check.',
        metadata: { thinking: 'I need to look at the code' },
      }),
      msg({ id: 'a2', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', name: 'Read', arguments: '{"path":"src/bug.ts"}' }] }),
      msg({ id: 't1', role: 'tool', content: 'buggy code', toolCallId: 'tc1' }),
      msg({ id: 'a3', role: 'assistant', content: 'Found and fixed it.' }),
    ];
    const result = normalizeMessages(messages);
    const types = result.map(r => r.type);
    expect(types).toEqual([
      'user-text',
      'assistant-thinking',
      'assistant-text',
      'assistant-tool-use',
      'assistant-text',
    ]);
  });

  it('breaks grouping when non-tool-use message intervenes', () => {
    const messages: AgentMessage[] = [
      msg({ id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', name: 'Edit', arguments: '{}' }] }),
      msg({ id: 'a2', role: 'assistant', content: 'Thinking about next step' }),
      msg({ id: 'a3', role: 'assistant', content: '', toolCalls: [{ id: 'tc2', name: 'Edit', arguments: '{}' }] }),
    ];
    const result = normalizeMessages(messages);
    expect(result).toHaveLength(3);
    expect(result[0]!.type).toBe('assistant-tool-use');
    expect(result[1]!.type).toBe('assistant-text');
    expect(result[2]!.type).toBe('assistant-tool-use');
  });
});
