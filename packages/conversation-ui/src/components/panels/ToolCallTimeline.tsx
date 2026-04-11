// ---------------------------------------------------------------------------
// ToolCallTimeline – Chronological tool call list with status icons & chips
// ---------------------------------------------------------------------------

import React from 'react';
import { Chip, Spinner } from '@heroui/react';

import type { RenderableToolCall } from '../../types.js';
import { getToolCategory, TOOL_COLORS } from '../../types.js';

export interface ToolCallTimelineProps {
  readonly toolCalls: readonly RenderableToolCall[];
}

type ChipColor = 'default' | 'accent' | 'danger' | 'success' | 'warning';

function StatusIcon({ status }: { status: RenderableToolCall['status'] }) {
  switch (status) {
    case 'success':
      return <span className="text-success text-xs">✓</span>;
    case 'error':
      return <span className="text-danger text-xs">✗</span>;
    case 'running':
      return <Spinner size="sm" />;
    case 'pending':
    default:
      return <span className="text-muted text-xs">⏳</span>;
  }
}

export const ToolCallTimeline = React.memo(function ToolCallTimeline({
  toolCalls,
}: ToolCallTimelineProps) {
  if (toolCalls.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
          工具调用
        </h3>
        <p className="text-xs text-muted">暂无工具调用</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
        工具调用
      </h3>

      <ul className="flex flex-col gap-1.5">
        {toolCalls.map((tc) => {
          const category = getToolCategory(tc.name);
          const colors = TOOL_COLORS[category];

          return (
            <li key={tc.id} className="flex items-center gap-2 text-sm">
              <StatusIcon status={tc.status} />

              <Chip color={colors.chipColor as ChipColor} size="sm">
                {tc.name}
              </Chip>

              {tc.durationMs != null && (
                <span className="text-muted text-xs ml-auto">
                  {tc.durationMs}ms
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
});
