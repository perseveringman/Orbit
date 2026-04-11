import React, { useState } from 'react';
import { Card, Chip, Spinner } from '@heroui/react';

import type { RenderableMessage } from '../../types.js';
import { getToolCategory, TOOL_COLORS } from '../../types.js';

export interface AssistantToolUseMessageProps {
  readonly message: RenderableMessage;
  readonly searchQuery?: string;
}

type ChipColor = 'default' | 'accent' | 'danger' | 'success' | 'warning';

export const AssistantToolUseMessage = React.memo(function AssistantToolUseMessage({
  message,
  searchQuery,
}: AssistantToolUseMessageProps) {
  const [expandedArgs, setExpandedArgs] = useState<Set<string>>(new Set());

  const toolCalls = message.toolCalls ?? [];

  if (toolCalls.length === 0) {
    return null;
  }

  const toggleArgs = (toolCallId: string) => {
    setExpandedArgs((prev) => {
      const next = new Set(prev);
      if (next.has(toolCallId)) {
        next.delete(toolCallId);
      } else {
        next.add(toolCallId);
      }
      return next;
    });
  };

  const highlightMatch = (text: string): React.ReactNode => {
    if (!searchQuery) return text;
    const idx = text.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-warning-soft rounded-sm">{text.slice(idx, idx + searchQuery.length)}</mark>
        {text.slice(idx + searchQuery.length)}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {toolCalls.map((tc) => {
        const category = getToolCategory(tc.name);
        const colors = TOOL_COLORS[category];
        const isExpanded = expandedArgs.has(tc.id);

        return (
          <Card key={tc.id} className={`${colors.bg} border-none shadow-sm`}>
            <Card.Header className="flex items-center gap-2 pb-1">
              <Chip color={colors.chipColor as ChipColor} size="sm">
                {highlightMatch(tc.name)}
              </Chip>

              {tc.status === 'running' && <Spinner size="sm" />}

              {tc.status === 'error' && (
                <span className="text-danger text-xs font-medium">✗ 错误</span>
              )}

              {tc.status === 'success' && (
                <span className="text-success text-xs font-medium">✓</span>
              )}

              {tc.durationMs != null && (
                <span className="text-muted text-xs ml-auto">
                  {tc.durationMs}ms
                </span>
              )}
            </Card.Header>

            <Card.Content className="pt-0">
              {/* Collapsible arguments */}
              <button
                type="button"
                className="text-muted text-xs hover:text-foreground transition-colors cursor-pointer"
                onClick={() => toggleArgs(tc.id)}
              >
                {isExpanded ? '▼' : '▶'} 参数
              </button>

              {isExpanded && (
                <pre className="mt-1 text-xs text-muted bg-surface-secondary rounded-md p-2 overflow-x-auto max-h-48">
                  {JSON.stringify(tc.arguments, null, 2)}
                </pre>
              )}

              {/* Error message */}
              {tc.status === 'error' && tc.errorMessage && (
                <div className="mt-2 text-danger text-xs bg-danger-soft rounded-md p-2">
                  {tc.errorMessage}
                </div>
              )}

              {/* Result */}
              {tc.result != null && (
                <pre className="mt-2 text-xs text-foreground bg-surface rounded-md p-2 overflow-x-auto max-h-64 whitespace-pre-wrap">
                  {highlightMatch(tc.result)}
                </pre>
              )}
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );
});
