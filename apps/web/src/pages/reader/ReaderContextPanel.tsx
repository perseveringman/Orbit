import { type ReactElement } from 'react';
import { Tabs, Card, Chip, Separator } from '@heroui/react';
import { MessageSquareText, Link2, List } from 'lucide-react';
import type { OutlineHeading } from './mock-data';
import { MOCK_OUTLINE } from './mock-data';
import { useHighlightsForArticle, type ReaderHighlight } from '../../data/use-reader';

interface ReaderContextPanelProps {
  articleId: string;
}

function AnnotationsTab({ articleId }: { articleId: string }): ReactElement {
  const highlights = useHighlightsForArticle(articleId);

  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-muted">
        <MessageSquareText size={24} className="mb-2 opacity-50" />
        暂无批注
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {highlights.map((hl) => (
        <div key={hl.id} className="text-sm">
          <div
            className="border-l-3 pl-2 py-1"
            style={{ borderColor: hl.color ?? '#fbbf24' }}
          >
            <p className="text-foreground">{hl.quoteText}</p>
          </div>
          {hl.note && (
            <p className="text-muted mt-1 text-xs pl-3">💬 {hl.note}</p>
          )}
          <p className="text-muted text-xs mt-0.5 pl-3">
            {new Date(hl.createdAt).toLocaleString('zh-CN')}
          </p>
        </div>
      ))}
    </div>
  );
}

function RelatedTab(): ReactElement {
  const relatedItems = [
    { id: 'rel-1', title: 'Distributed Systems Design Patterns', type: '文章' as const },
    { id: 'rel-2', title: '分布式系统学习笔记', type: '笔记' as const },
    { id: 'rel-3', title: 'Rust 并发编程实践', type: '文章' as const },
  ];

  return (
    <div className="space-y-2">
      {relatedItems.map((item) => (
        <Card key={item.id} className="cursor-pointer">
          <Card.Header>
            <Chip size="sm" variant="soft">
              {item.type}
            </Chip>
          </Card.Header>
          <Card.Title className="text-sm">{item.title}</Card.Title>
        </Card>
      ))}
    </div>
  );
}

function OutlineTab({ headings }: { headings: OutlineHeading[] }): ReactElement {
  const handleScrollTo = (headingId: string) => {
    console.log(`[Outline] scroll to: ${headingId}`);
  };

  return (
    <nav className="space-y-0.5">
      {headings.map((h) => (
        <button
          key={h.id}
          className="block w-full text-left text-sm rounded px-2 py-1 hover:bg-surface-secondary transition-colors text-muted hover:text-foreground"
          style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
          onClick={() => handleScrollTo(h.id)}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}

export function ReaderContextPanel({ articleId }: ReaderContextPanelProps): ReactElement {
  return (
    <div className="flex flex-col h-full">
      <Tabs>
        <Tabs.List>
          <Tabs.Tab id="annotations">
            <MessageSquareText size={14} className="inline" /> 批注
          </Tabs.Tab>
          <Tabs.Tab id="related">
            <Link2 size={14} className="inline" /> 相关
          </Tabs.Tab>
          <Tabs.Tab id="outline">
            <List size={14} className="inline" /> 大纲
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel id="annotations">
          <div className="p-3 overflow-y-auto">
            <AnnotationsTab articleId={articleId} />
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="related">
          <div className="p-3 overflow-y-auto">
            <RelatedTab />
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="outline">
          <div className="p-3 overflow-y-auto">
            <OutlineTab headings={MOCK_OUTLINE} />
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
