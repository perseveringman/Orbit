// ---------------------------------------------------------------------------
// @orbit/agent-core – Message Formatter (M11)
// Formats raw agent output into structured, display-ready messages.
// ---------------------------------------------------------------------------

import type { ProgressState } from './progress-tracker.js';

// ---- Formatted message ----

export interface FormattedMessage {
  readonly type: 'text' | 'code' | 'tool-result' | 'error' | 'system' | 'progress';
  readonly content: string;
  readonly language?: string;
  readonly metadata?: Record<string, unknown>;
}

// ---- Tool display metadata ----

export interface ToolDisplayInfo {
  readonly icon: string;
  readonly displayName: string;
  readonly category: string;
}

export const TOOL_DISPLAY: Record<string, ToolDisplayInfo> = {
  shell_exec: { icon: '🖥️', displayName: '终端命令', category: '终端' },
  file_read: { icon: '📄', displayName: '读取文件', category: '文件' },
  file_write: { icon: '✏️', displayName: '写入文件', category: '文件' },
  file_list: { icon: '📁', displayName: '列出目录', category: '文件' },
  file_search: { icon: '🔍', displayName: '搜索文件', category: '文件' },
  grep: { icon: '🔎', displayName: '文本搜索', category: '文件' },
  web_fetch: { icon: '🌐', displayName: '获取网页', category: '网络' },
  web_search: { icon: '🔍', displayName: '网络搜索', category: '网络' },
  ask_user: { icon: '💬', displayName: '询问用户', category: '交互' },
  datetime: { icon: '🕐', displayName: '日期时间', category: '工具' },
  calculate: { icon: '🔢', displayName: '计算', category: '工具' },
  json_parse: { icon: '📋', displayName: '解析JSON', category: '工具' },
  text_transform: { icon: '📝', displayName: '文本处理', category: '工具' },
};

// ---- MessageFormatter ----

export class MessageFormatter {
  /** Format assistant response, splitting out code blocks. */
  formatAssistantMessage(content: string): readonly FormattedMessage[] {
    if (!content) return [];
    return this.extractCodeBlocks(content);
  }

  /** Format a tool execution result. */
  formatToolResult(
    toolName: string,
    result: string,
    success: boolean,
    durationMs: number,
  ): FormattedMessage {
    const display = TOOL_DISPLAY[toolName];
    const icon = display?.icon ?? '🔧';
    const name = display?.displayName ?? toolName;
    const durationStr = formatDuration(durationMs);
    const statusIcon = success ? '✅' : '❌';

    const header = `${icon} ${name} ${statusIcon}  (${durationStr})`;
    const body = result.length > 0 ? `\n${result}` : '';

    return {
      type: 'tool-result',
      content: `${header}${body}`,
      metadata: { toolName, success, durationMs },
    };
  }

  /** Format an error for display. */
  formatError(error: string, category?: string, suggestion?: string): FormattedMessage {
    const parts: string[] = [];
    if (category) {
      parts.push(`[${category}] `);
    }
    parts.push(error);
    if (suggestion) {
      parts.push(`\n💡 建议: ${suggestion}`);
    }

    return {
      type: 'error',
      content: parts.join(''),
      metadata: { category, suggestion },
    };
  }

  /** Format a system message. */
  formatSystem(message: string): FormattedMessage {
    return {
      type: 'system',
      content: `ℹ️ ${message}`,
    };
  }

  /** Format a progress indicator. */
  formatProgress(state: ProgressState): FormattedMessage {
    const parts: string[] = [`${state.icon} ${state.message}`];

    if (state.detail) {
      parts.push(` — ${state.detail}`);
    }
    if (state.iterationInfo) {
      parts.push(` (${state.iterationInfo.current}/${state.iterationInfo.max})`);
    }

    const pct = Math.round(state.progress * 100);
    parts.push(` [${pct}%]`);

    return {
      type: 'progress',
      content: parts.join(''),
      metadata: {
        phase: state.phase,
        progress: state.progress,
        elapsed: state.elapsed,
      },
    };
  }

  /** Extract interleaved text and fenced code blocks from markdown content. */
  private extractCodeBlocks(content: string): readonly FormattedMessage[] {
    const messages: FormattedMessage[] = [];
    // Match ```lang\n...\n``` blocks
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Text before this code block
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore.trim().length > 0) {
        messages.push({ type: 'text', content: textBefore.trim() });
      }

      const language = match[1] || undefined;
      const code = match[2];
      messages.push({
        type: 'code',
        content: code,
        language,
      });

      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last code block
    const remaining = content.slice(lastIndex);
    if (remaining.trim().length > 0) {
      messages.push({ type: 'text', content: remaining.trim() });
    }

    // No code blocks found — return entire content as text
    if (messages.length === 0) {
      messages.push({ type: 'text', content });
    }

    return messages;
  }
}

// ---- Helpers ----

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}
