import { useState, type ReactElement } from 'react';
import { Inbox } from 'lucide-react';
import { MOCK_INBOX_ITEMS, type InboxItem, type InboxItemType } from './mock-data';
import { InboxList } from './InboxList';
import { InboxDetailReading } from './InboxDetailReading';
import { InboxDetailNote } from './InboxDetailNote';
import { InboxDetailTodo } from './InboxDetailTodo';
import { InboxDetailAgent } from './InboxDetailAgent';

interface InboxPageProps {
  subPage: string;
}

const SUBPAGE_TYPE_MAP: Record<string, InboxItemType | null> = {
  all: null,
  reading: 'reading',
  notes: 'note',
  todos: 'todo',
  'agent-review': 'agent-review',
};

function DetailView({ item }: { item: InboxItem }): ReactElement {
  switch (item.type) {
    case 'reading':
      return <InboxDetailReading item={item} />;
    case 'note':
      return <InboxDetailNote item={item} />;
    case 'todo':
      return <InboxDetailTodo item={item} />;
    case 'agent-review':
      return <InboxDetailAgent item={item} />;
  }
}

export function InboxPage({ subPage }: InboxPageProps): ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const typeFilter = SUBPAGE_TYPE_MAP[subPage] ?? null;
  const filteredItems = typeFilter
    ? MOCK_INBOX_ITEMS.filter((item) => item.type === typeFilter)
    : MOCK_INBOX_ITEMS;

  const selectedItem = selectedId
    ? MOCK_INBOX_ITEMS.find((item) => item.id === selectedId) ?? null
    : null;

  return (
    <div className="flex h-full">
      {/* Left column – list */}
      <div className="w-96 border-r border-border shrink-0">
        <InboxList
          items={filteredItems}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Right column – detail */}
      <div className="flex-1 min-w-0">
        {selectedItem ? (
          <DetailView item={selectedItem} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <Inbox size={40} className="opacity-30 mb-3" />
            <p className="text-sm">选择一个项目查看详情</p>
          </div>
        )}
      </div>
    </div>
  );
}
