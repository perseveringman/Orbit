import { type ReactElement } from 'react';
import { Separator } from '@heroui/react';
import { BookOpen, ExternalLink } from 'lucide-react';
import type { InboxItem } from './mock-data';

interface InboxDetailReadingProps {
  item: InboxItem;
}

export function InboxDetailReading({ item }: InboxDetailReadingProps): ReactElement {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          {item.title}
        </h1>

        <div className="flex items-center gap-3 mt-3 text-sm text-muted">
          <div className="flex items-center gap-1">
            <BookOpen size={14} />
            <span>{item.source}</span>
          </div>
          <span>·</span>
          <span>
            {new Date(item.timestamp).toLocaleString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {item.url && (
            <>
              <span>·</span>
              <a
                href={item.url}
                className="flex items-center gap-1 text-accent hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                原文 <ExternalLink size={12} />
              </a>
            </>
          )}
        </div>

        <Separator className="my-6" />

        {/* Article content */}
        <div className="prose prose-sm text-foreground space-y-4">
          {item.articleContent?.split('\n\n').map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
