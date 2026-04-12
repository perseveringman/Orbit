import { useState, type ReactElement } from 'react';
import { Tabs, Card, Chip, Button, ProgressBar, Separator } from '@heroui/react';
import { Clock, BookOpen, Archive, Inbox } from 'lucide-react';
import type { Article, ArticleStatus } from './mock-data';
import { MOCK_ARTICLES } from './mock-data';

type TabKey = 'inbox' | 'all' | 'later' | 'archived';
type SortKey = 'newest' | 'oldest' | 'unread-first';

interface LibraryListViewProps {
  onSelectArticle: (article: Article) => void;
}

function statusColor(status: ArticleStatus) {
  switch (status) {
    case 'unread':
      return 'accent' as const;
    case 'reading':
      return 'warning' as const;
    case 'archived':
      return 'default' as const;
  }
}

function statusLabel(status: ArticleStatus) {
  switch (status) {
    case 'unread':
      return '未读';
    case 'reading':
      return '阅读中';
    case 'archived':
      return '已归档';
  }
}

function filterByTab(articles: Article[], tab: TabKey): Article[] {
  switch (tab) {
    case 'inbox':
      return articles.filter((a) => a.status === 'unread');
    case 'later':
      return articles.filter((a) => a.status === 'reading');
    case 'archived':
      return articles.filter((a) => a.status === 'archived');
    default:
      return articles;
  }
}

function sortArticles(articles: Article[], sortKey: SortKey): Article[] {
  const sorted = [...articles];
  switch (sortKey) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    case 'unread-first':
      return sorted.sort((a, b) => {
        if (a.status === 'unread' && b.status !== 'unread') return -1;
        if (a.status !== 'unread' && b.status === 'unread') return 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
  }
}

function filterBySourceType(articles: Article[], sourceType: string): Article[] {
  if (sourceType === 'all') return articles;
  return articles.filter((a) => a.sourceType === sourceType);
}

export function LibraryListView({ onSelectArticle }: LibraryListViewProps): ReactElement {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [sourceType, setSourceType] = useState('all');
  const [visibleCount, setVisibleCount] = useState(20);

  let displayed = filterByTab(MOCK_ARTICLES, activeTab);
  displayed = filterBySourceType(displayed, sourceType);
  displayed = sortArticles(displayed, sortKey);
  const hasMore = displayed.length > visibleCount;
  const visible = displayed.slice(0, visibleCount);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => {
          setActiveTab(key as TabKey);
          setVisibleCount(20);
        }}
      >
        <Tabs.List>
          <Tabs.Tab id="inbox"><Inbox size={14} className="inline" /> 收件箱</Tabs.Tab>
          <Tabs.Tab id="all"><BookOpen size={14} className="inline" /> 全部</Tabs.Tab>
          <Tabs.Tab id="later"><Clock size={14} className="inline" /> 稍后</Tabs.Tab>
          <Tabs.Tab id="archived"><Archive size={14} className="inline" /> 已归档</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <div className="flex items-center gap-1 text-xs text-muted">
          <span>来源：</span>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-foreground"
          >
            <option value="all">全部</option>
            <option value="rss">RSS</option>
            <option value="site-watch">网站监测</option>
            <option value="channel">频道</option>
            <option value="manual">手动</option>
          </select>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted">
          <span>排序：</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-foreground"
          >
            <option value="newest">最新优先</option>
            <option value="oldest">最早优先</option>
            <option value="unread-first">未读优先</option>
          </select>
        </div>
        <span className="ml-auto text-xs text-muted">{displayed.length} 篇文章</span>
      </div>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted text-sm">
            <BookOpen size={32} className="mb-2 opacity-40" />
            暂无文章
          </div>
        )}

        {visible.map((article) => (
          <Card
            key={article.id}
            className="cursor-pointer"
            onClick={() => onSelectArticle(article)}
          >
            <Card.Header>
              <div className="flex items-center gap-2">
                <Chip size="sm" variant="soft" color={statusColor(article.status)}>
                  {statusLabel(article.status)}
                </Chip>
                <Chip size="sm" variant="soft">
                  {article.sourceType === 'rss' ? 'RSS' : article.sourceType === 'site-watch' ? '网站监测' : article.sourceType === 'channel' ? '频道' : '手动'}
                </Chip>
              </div>
            </Card.Header>
            <Card.Title>{article.title}</Card.Title>
            <Card.Description>
              {article.author} · {article.source} · {formatDate(article.publishedAt)}
            </Card.Description>
            {article.readingProgress > 0 && article.readingProgress < 100 && (
              <Card.Content>
                <ProgressBar
                  aria-label="阅读进度"
                  value={article.readingProgress}
                  size="sm"
                  className="w-full"
                >
                  <ProgressBar.Track className="h-1">
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </Card.Content>
            )}
            <Card.Footer>
              <div className="flex flex-wrap gap-1">
                {article.tags.map((tag) => (
                  <Chip key={tag} size="sm" variant="soft">{tag}</Chip>
                ))}
              </div>
            </Card.Footer>
          </Card>
        ))}

        {hasMore && (
          <>
            <Separator />
            <div className="flex justify-center py-2">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setVisibleCount((prev) => prev + 20)}
              >
                加载更多
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
