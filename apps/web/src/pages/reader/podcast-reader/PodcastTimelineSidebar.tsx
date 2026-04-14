import type { ReactElement } from 'react';
import type { PodcastTimestampOutlineItem } from './podcast-timestamps';

interface PodcastTimelineSidebarProps {
  items: PodcastTimestampOutlineItem[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}

function findActiveIndex(items: PodcastTimestampOutlineItem[], currentTime: number): number {
  let activeIndex = -1;
  for (let i = 0; i < items.length; i++) {
    if (currentTime >= items[i].seconds) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

export function PodcastTimelineSidebar({
  items,
  currentTime,
  onSeek,
}: PodcastTimelineSidebarProps): ReactElement {
  const activeIndex = findActiveIndex(items, currentTime);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted text-center">No timestamps available</p>
      </div>
    );
  }

  return (
    <nav role="navigation" aria-label="timeline" className="h-full overflow-y-auto">
      <div className="p-2 space-y-1">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={item.id}
              onClick={() => onSeek(item.seconds)}
              className={`
                flex gap-2 p-2 rounded-md cursor-pointer transition-colors
                ${isActive ? 'bg-warning/15' : 'hover:bg-surface-secondary'}
              `}
            >
              <span className="text-xs font-mono text-muted shrink-0 pt-0.5 w-12">
                {item.label}
              </span>
              <span className="text-sm text-foreground leading-5 break-words flex-1 min-w-0">
                {item.title}
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
