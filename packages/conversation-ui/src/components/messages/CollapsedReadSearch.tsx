import React from 'react';
import { Chip } from '@heroui/react';

import type { RenderableMessage } from '../../types.js';

export interface CollapsedReadSearchProps {
  readonly message: RenderableMessage;
  readonly onToggleCollapse?: (id: string) => void;
}

function extractFilePaths(message: RenderableMessage): string[] {
  const paths: string[] = [];

  const toolCalls = message.toolCalls ?? [];
  for (const tc of toolCalls) {
    const filePath = tc.arguments['file_path'] ?? tc.arguments['path'] ?? tc.arguments['pattern'];
    if (typeof filePath === 'string') {
      paths.push(filePath);
    }
  }

  const children = message.children ?? [];
  for (const child of children) {
    const childToolCalls = child.toolCalls ?? [];
    for (const tc of childToolCalls) {
      const filePath = tc.arguments['file_path'] ?? tc.arguments['path'] ?? tc.arguments['pattern'];
      if (typeof filePath === 'string') {
        paths.push(filePath);
      }
    }
  }

  return paths;
}

export const CollapsedReadSearch = React.memo(function CollapsedReadSearch({
  message,
  onToggleCollapse,
}: CollapsedReadSearchProps) {
  const isCollapsed = message.isCollapsed ?? true;
  const filePaths = extractFilePaths(message);
  const count = filePaths.length || 1;

  const handleToggle = () => {
    onToggleCollapse?.(message.id);
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="inline-flex cursor-pointer"
        onClick={handleToggle}
      >
        <Chip color="success" size="sm">
          📖 读取了 {count} 个文件
        </Chip>
      </button>

      {!isCollapsed && filePaths.length > 0 && (
        <div className="ml-2 mt-1 flex flex-col gap-0.5">
          {filePaths.map((fp, idx) => (
            <span key={idx} className="text-xs text-muted font-mono truncate">
              {fp}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
