// ---------------------------------------------------------------------------
// SessionSidePanel – Collapsible right-side panel (240px)
// ---------------------------------------------------------------------------

import React from 'react';
import { Button, Card } from '@heroui/react';

import type { SessionStats, RenderableToolCall } from '../../types.js';
import { SessionInfo } from './SessionInfo.js';
import { ToolCallTimeline } from './ToolCallTimeline.js';
import { PermissionStatus } from './PermissionStatus.js';

// ---- Local types ----

export interface PermissionMode {
  readonly name: string;
  readonly allowed: boolean;
  readonly requiresApproval: boolean;
}

export interface SessionSidePanelProps {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly stats?: SessionStats;
  readonly toolCalls?: readonly RenderableToolCall[];
  readonly permissions?: PermissionMode[];
}

export const SessionSidePanel = React.memo(function SessionSidePanel({
  isOpen,
  onToggle,
  stats,
  toolCalls,
  permissions,
}: SessionSidePanelProps) {
  return (
    <>
      {/* Toggle button (always visible) */}
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label={isOpen ? '收起侧栏' : '展开侧栏'}
        aria-expanded={isOpen}
        onPress={onToggle}
        className="fixed right-2 top-2 z-50 text-muted"
      >
        {isOpen ? '▶' : '◀'}
      </Button>

      {/* Panel */}
      {isOpen && (
        <aside
          className="flex w-[240px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-surface p-3"
          aria-label="会话侧栏"
        >
          {/* Session stats */}
          {stats && (
            <Card className="border-none shadow-sm">
              <Card.Content>
                <SessionInfo stats={stats} />
              </Card.Content>
            </Card>
          )}

          {/* Tool call timeline */}
          {toolCalls && (
            <Card className="border-none shadow-sm">
              <Card.Content>
                <ToolCallTimeline toolCalls={toolCalls} />
              </Card.Content>
            </Card>
          )}

          {/* Permission status */}
          {permissions && (
            <Card className="border-none shadow-sm">
              <Card.Content>
                <PermissionStatus permissions={permissions} />
              </Card.Content>
            </Card>
          )}
        </aside>
      )}
    </>
  );
});
