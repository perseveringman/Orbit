import React from 'react';
import { Card } from '@heroui/react';

import type { RenderableMessage } from '../../types.js';

export interface ThinkingBlockProps {
  readonly message: RenderableMessage;
  readonly onToggleCollapse?: (id: string) => void;
}

export const ThinkingBlock = React.memo(function ThinkingBlock({
  message,
  onToggleCollapse,
}: ThinkingBlockProps) {
  const isCollapsed = message.isCollapsed ?? true;

  const durationMs = message.metadata?.['durationMs'] as number | undefined;

  const durationLabel = durationMs != null
    ? ` (${(durationMs / 1000).toFixed(1)}s)`
    : '';

  const handleToggle = () => {
    onToggleCollapse?.(message.id);
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
            思考中…{durationLabel}
          </span>
        </button>
      </Card.Header>

      {!isCollapsed && (
        <Card.Content className="pt-2">
          <p className="text-muted text-sm italic whitespace-pre-wrap">
            {message.content}
          </p>
        </Card.Content>
      )}
    </Card>
  );
});
