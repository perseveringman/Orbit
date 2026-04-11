import React from 'react';
import { Card, Chip, Spinner } from '@heroui/react';

import type { RenderableMessage, RenderableToolCall } from '../../types.js';
import { getToolCategory, TOOL_COLORS } from '../../types.js';

export interface GroupedToolUseProps {
  readonly message: RenderableMessage;
  readonly onToggleCollapse?: (id: string) => void;
  readonly searchQuery?: string;
}

type ChipColor = 'default' | 'accent' | 'danger' | 'success' | 'warning';

function statusIcon(status: RenderableToolCall['status']): React.ReactNode {
  switch (status) {
    case 'running':
      return <Spinner size="sm" />;
    case 'success':
      return <span className="text-success text-xs">✓</span>;
    case 'error':
      return <span className="text-danger text-xs">✗</span>;
    case 'pending':
      return <span className="text-muted text-xs">⏳</span>;
  }
}

export const GroupedToolUse = React.memo(function GroupedToolUse({
  message,
  onToggleCollapse,
  searchQuery,
}: GroupedToolUseProps) {
  const isCollapsed = message.isCollapsed ?? true;
  const children = message.children ?? [];
  const count = children.length;

  const allToolCalls = children.flatMap((child) => child.toolCalls ?? []);

  const handleToggle = () => {
    onToggleCollapse?.(message.id);
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
    <Card className="bg-surface border-none shadow-sm">
      <Card.Header className="pb-0">
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleToggle}
        >
          <span className="text-muted text-sm">
            {isCollapsed ? '▶' : '▼'}
          </span>
          <span className="text-muted text-sm font-medium">
            {count} 个工具调用
          </span>
        </button>
      </Card.Header>

      {!isCollapsed && (
        <Card.Content className="pt-2">
          <div className="flex flex-col gap-1">
            {allToolCalls.map((tc) => {
              const category = getToolCategory(tc.name);
              const colors = TOOL_COLORS[category];

              return (
                <div
                  key={tc.id}
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-secondary transition-colors"
                >
                  <Chip color={colors.chipColor as ChipColor} size="sm">
                    {highlightMatch(tc.name)}
                  </Chip>

                  {statusIcon(tc.status)}

                  {tc.durationMs != null && (
                    <span className="text-muted text-xs ml-auto">
                      {tc.durationMs}ms
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card.Content>
      )}
    </Card>
  );
});
