import type { ReactElement } from 'react';
import { Search, Bell, Plus, User } from 'lucide-react';
import { Button, Input } from '@heroui/react';

export interface TopBarProps {
  onSearch?: (query: string) => void;
}

export function TopBar({ onSearch }: TopBarProps): ReactElement {
  return (
    <header className="flex items-center gap-3 h-12 px-4 border-b border-border shrink-0 bg-background">
      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <div className="flex items-center gap-2 bg-surface-secondary rounded-lg px-3 py-1.5">
          <Search size={14} className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="搜索..."
            onChange={(e) => onSearch?.(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted"
          />
          <kbd className="hidden sm:inline text-[10px] text-muted bg-background px-1.5 py-0.5 rounded">
            ⌘F
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-auto">
        <Button variant="ghost" isIconOnly size="sm">
          <Bell size={16} className="text-muted" />
        </Button>

        {/* User avatar stack */}
        <div className="flex items-center -space-x-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full bg-accent-soft border-2 border-background flex items-center justify-center"
            >
              <User size={12} className="text-accent" />
            </div>
          ))}
          <span className="text-xs text-muted pl-3">+10</span>
        </div>

        <Button variant="secondary" size="sm">
          <Plus size={14} />
          添加成员
        </Button>
      </div>
    </header>
  );
}
