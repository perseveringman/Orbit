import { type ReactElement } from 'react';
import { Separator } from '@heroui/react';
import { StickyNote } from 'lucide-react';
import type { InboxItem } from './mock-data';

interface InboxDetailNoteProps {
  item: InboxItem;
}

export function InboxDetailNote({ item }: InboxDetailNoteProps): ReactElement {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="flex items-start gap-2">
          <StickyNote size={20} className="text-muted mt-1 shrink-0" />
          <h1
            className="text-2xl font-bold text-foreground leading-tight outline-none w-full"
            contentEditable
            suppressContentEditableWarning
          >
            {item.title}
          </h1>
        </div>

        <p className="text-xs text-muted mt-2">
          {new Date(item.timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        <Separator className="my-6" />

        {/* Note content editor area */}
        <textarea
          className="w-full min-h-[400px] bg-transparent text-sm text-foreground leading-relaxed outline-none resize-none placeholder:text-muted"
          defaultValue={item.noteContent ?? ''}
          placeholder="开始写笔记..."
        />
      </div>
    </div>
  );
}
