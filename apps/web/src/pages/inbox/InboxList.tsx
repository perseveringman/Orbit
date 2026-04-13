import { useState, type ReactElement } from 'react';
import { Card, Chip } from '@heroui/react';
import { BookOpen, StickyNote, CheckCircle, Bot, Search } from 'lucide-react';
import type { InboxItem, InboxItemType } from './mock-data';

interface InboxListProps {
  items: InboxItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const TYPE_ICONS: Record<InboxItemType, ReactElement> = {
  reading: <BookOpen size={16} />,
  note: <StickyNote size={16} />,
  todo: <CheckCircle size={16} />,
  'agent-review': <Bot size={16} />,
};

const TODO_STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  in_progress: '进行中',
  done: '已完成',
};

const TODO_STATUS_COLORS: Record<string, 'default' | 'warning' | 'success'> = {
  pending: 'default',
  in_progress: 'warning',
  done: 'success',
};

export function InboxList({ items, selectedId, onSelect }: InboxListProps): ReactElement {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? items.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.preview.toLowerCase().includes(query.toLowerCase()),
      )
    : items;

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 bg-surface-secondary rounded-lg px-3 py-1.5">
          <Search size={14} className="text-muted shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted"
            placeholder="搜索收件箱..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-muted">
            暂无项目
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {filtered.map((item) => (
              <button
                key={item.id}
                className={`w-full text-left rounded-lg p-3 transition-colors ${
                  selectedId === item.id
                    ? 'bg-accent/10'
                    : 'hover:bg-surface-secondary'
                }`}
                onClick={() => onSelect(item.id)}
              >
                <div className="flex items-start gap-2">
                  {/* Unread dot */}
                  <div className="pt-1.5 w-2 shrink-0">
                    {item.unread && (
                      <div className="w-2 h-2 rounded-full bg-accent" />
                    )}
                  </div>

                  {/* Type icon */}
                  <div className="pt-0.5 text-muted shrink-0">
                    {TYPE_ICONS[item.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm truncate ${
                          item.unread
                            ? 'font-semibold text-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">
                      {item.preview}
                    </p>

                    {/* Extra chips */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {item.type === 'todo' && item.todoStatus && (
                        <Chip
                          variant="soft"
                          color={TODO_STATUS_COLORS[item.todoStatus]}
                          size="sm"
                        >
                          {TODO_STATUS_LABELS[item.todoStatus]}
                        </Chip>
                      )}
                      {item.type === 'agent-review' && item.agentName && (
                        <Chip variant="soft" size="sm">
                          <Bot size={10} className="inline mr-0.5" />
                          {item.agentName}
                        </Chip>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-muted whitespace-nowrap shrink-0">
                    {new Date(item.timestamp).toLocaleDateString('zh-CN', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
