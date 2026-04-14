import type { ReactElement } from 'react';
import { Tabs, Card, Chip } from '@heroui/react';
import { MessageSquareText, Info } from 'lucide-react';
import type { PodcastHighlight } from '../../../data/use-podcast-reader';

interface PodcastDetailPanelProps {
  highlights: PodcastHighlight[];
  onHighlightClick?: (highlight: PodcastHighlight) => void;
  showInfo?: {
    title: string;
    description: string | null;
  };
}

function HighlightsTab({
  highlights,
  onHighlightClick,
}: {
  highlights: PodcastHighlight[];
  onHighlightClick?: (highlight: PodcastHighlight) => void;
}): ReactElement {
  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-muted">
        <MessageSquareText size={24} className="mb-2 opacity-50" />
        暂无高亮
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {highlights.map((hl) => (
        <div
          key={hl.id}
          className="text-sm cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onHighlightClick?.(hl)}
        >
          <div
            className="border-l-3 pl-2 py-1"
            style={{ borderColor: hl.color ?? '#fbbf24' }}
          >
            <p className="text-foreground">{hl.quoteText}</p>
          </div>
          {hl.note && <p className="text-muted mt-1 text-xs pl-3">💬 {hl.note}</p>}
          {hl.timestampSeconds !== null && (
            <p className="text-muted text-xs mt-0.5 pl-3">
              @ {Math.floor(hl.timestampSeconds / 60)}:{String(Math.floor(hl.timestampSeconds % 60)).padStart(2, '0')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ShowInfoTab({ showInfo }: { showInfo: PodcastDetailPanelProps['showInfo'] }): ReactElement {
  if (!showInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-muted">
        <Info size={24} className="mb-2 opacity-50" />
        No show info available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Show</h3>
        <p className="text-sm text-foreground">{showInfo.title}</p>
      </div>
      {showInfo.description && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Description</h3>
          <p className="text-sm text-muted leading-relaxed">{showInfo.description}</p>
        </div>
      )}
    </div>
  );
}

export function PodcastDetailPanel({
  highlights,
  onHighlightClick,
  showInfo,
}: PodcastDetailPanelProps): ReactElement {
  return (
    <div role="complementary" aria-label="detail panel" className="h-full flex flex-col">
      <Tabs className="flex-1 flex flex-col overflow-hidden">
        <Tabs.List className="px-2 pt-2 shrink-0">
          <Tabs.Tab id="highlights">
            <MessageSquareText size={14} />
            <span>Highlights</span>
          </Tabs.Tab>
          <Tabs.Tab id="info">
            <Info size={14} />
            <span>Info</span>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="highlights">
          <div className="flex-1 overflow-y-auto p-3">
            <HighlightsTab highlights={highlights} onHighlightClick={onHighlightClick} />
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="info">
          <div className="flex-1 overflow-y-auto p-3">
            <ShowInfoTab showInfo={showInfo} />
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
