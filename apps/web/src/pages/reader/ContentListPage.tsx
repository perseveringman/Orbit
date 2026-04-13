import { useState, useMemo, type ReactElement } from 'react';
import { Tabs, Card, Chip, Button, ProgressBar, Input } from '@heroui/react';
import { FileText, Headphones, PlayCircle, BookOpen, Search, ArrowUpDown } from 'lucide-react';
import type { ReaderContentType } from './ReaderRouter';
import { useArticleList, type ReaderArticle } from '../../data/use-reader';

type SortKey = 'updated' | 'progress' | 'published';
type ContentStatus = 'unread' | 'reading' | 'archived';

interface ContentListPageProps {
  contentType: ReaderContentType | 'all';
  onContentTypeChange: (type: ReaderContentType | 'all') => void;
  onSelectItem: (type: ReaderContentType, id: string) => void;
}

const TYPE_TABS: { id: ReaderContentType | 'all'; label: string; icon: ReactElement }[] = [
  { id: 'all', label: '全部', icon: <BookOpen size={14} /> },
  { id: 'article', label: '文章', icon: <FileText size={14} /> },
  { id: 'podcast', label: '播客', icon: <Headphones size={14} /> },
  { id: 'video', label: '视频', icon: <PlayCircle size={14} /> },
  { id: 'book', label: '书籍', icon: <BookOpen size={14} /> },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'updated', label: '最近更新' },
  { key: 'progress', label: '阅读进度' },
  { key: 'published', label: '发布日期' },
];

function mediaTypeToContentType(mediaType: string): ReaderContentType {
  switch (mediaType) {
    case 'podcast': return 'podcast';
    case 'youtube': return 'video';
    case 'book': return 'book';
    default: return 'article';
  }
}

function typeIcon(type: ReaderContentType): ReactElement {
  switch (type) {
    case 'article': return <FileText size={14} className="shrink-0" />;
    case 'podcast': return <Headphones size={14} className="shrink-0" />;
    case 'video': return <PlayCircle size={14} className="shrink-0" />;
    case 'book': return <BookOpen size={14} className="shrink-0" />;
  }
}

function statusLabel(status: ContentStatus): string {
  switch (status) {
    case 'unread': return '未读';
    case 'reading': return '进行中';
    case 'archived': return '已归档';
  }
}

function statusColor(status: ContentStatus) {
  switch (status) {
    case 'unread': return 'accent' as const;
    case 'reading': return 'warning' as const;
    case 'archived': return 'default' as const;
  }
}

function sortArticles(items: ReaderArticle[], key: SortKey): ReaderArticle[] {
  const sorted = [...items];
  switch (key) {
    case 'updated':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'progress':
      return sorted.sort((a, b) => (b.readingProgress ?? 0) - (a.readingProgress ?? 0));
    case 'published':
      return sorted.sort((a, b) => new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime());
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function ContentListPage({
  contentType,
  onContentTypeChange,
  onSelectItem,
}: ContentListPageProps): ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [searchQuery, setSearchQuery] = useState('');
  const { articles } = useArticleList();

  const filtered = useMemo(() => {
    let items = articles;
    if (contentType !== 'all') {
      items = items.filter((a) => mediaTypeToContentType(a.mediaType) === contentType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.author ?? '').toLowerCase().includes(q) ||
          (a.sourceUrl ?? '').toLowerCase().includes(q),
      );
    }
    return sortArticles(items, sortKey);
  }, [articles, contentType, sortKey, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <Tabs
        selectedKey={contentType}
        onSelectionChange={(key) => onContentTypeChange(key as ReaderContentType | 'all')}
      >
        <Tabs.List>
          {TYPE_TABS.map((tab) => (
            <Tabs.Tab key={tab.id} id={tab.id}>
              {tab.icon} {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {/* Search + sort bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <div className="flex items-center gap-1 max-w-xs">
          <Search size={14} className="text-muted shrink-0" />
          <Input
            placeholder="搜索标题、作者或来源..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm"
          />
        </div>

        <div className="flex items-center gap-1 text-xs text-muted ml-auto">
          <ArrowUpDown size={12} />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-foreground"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
          <span className="ml-2">{filtered.length} 项</span>
        </div>
      </div>

      {/* Content list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted text-sm">
            <BookOpen size={32} className="mb-2 opacity-40" />
            暂无内容
          </div>
        )}

        {filtered.map((item) => {
          const cType = mediaTypeToContentType(item.mediaType);
          const progress = (item.readingProgress ?? 0) * 100;

          return (
            <Card
              key={item.id}
              className="cursor-pointer"
              onClick={() => onSelectItem(cType, item.id)}
            >
              <Card.Header>
                <div className="flex items-center gap-2">
                  {typeIcon(cType)}
                  <Chip size="sm" variant="soft" color={statusColor(item.status)}>
                    {statusLabel(item.status)}
                  </Chip>
                </div>
              </Card.Header>
              <Card.Title>{item.title}</Card.Title>
              <Card.Description>
                {item.author ?? '未知'} · {formatDate(item.publishedAt)}
              </Card.Description>
              {progress > 0 && progress < 100 && (
                <Card.Content>
                  <ProgressBar
                    aria-label="进度"
                    value={progress}
                    size="sm"
                    className="w-full"
                  >
                    <ProgressBar.Track className="h-1">
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </Card.Content>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
