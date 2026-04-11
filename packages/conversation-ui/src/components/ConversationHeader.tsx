// ---------------------------------------------------------------------------
// ConversationHeader – Model name, search toggle, settings icon
// ---------------------------------------------------------------------------

import React from 'react';
import { Button } from '@heroui/react';

export interface ConversationHeaderProps {
  readonly modelName?: string;
  readonly onToggleSearch?: () => void;
  readonly isSearchOpen?: boolean;
}

export const ConversationHeader = React.memo(function ConversationHeader({
  modelName,
  onToggleSearch,
  isSearchOpen,
}: ConversationHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      {/* Model label */}
      <span className="text-sm text-muted">
        {modelName ?? 'Model'}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Search toggle */}
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Toggle search"
          aria-pressed={isSearchOpen}
          onPress={onToggleSearch}
          className={isSearchOpen ? 'text-accent' : 'text-muted'}
        >
          🔍
        </Button>

        {/* Settings (placeholder – no handler yet) */}
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Settings"
          className="text-muted"
        >
          ⚙️
        </Button>
      </div>
    </header>
  );
});
