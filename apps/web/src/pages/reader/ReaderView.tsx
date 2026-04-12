import { useState, useEffect, useRef, type ReactElement } from 'react';
import { Button, Chip, ProgressBar } from '@heroui/react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Article } from './mock-data';
import { MOCK_ARTICLE_BODY } from './mock-data';
import { ReaderContextPanel } from './ReaderContextPanel';
import { HighlightFloatingMenu } from './HighlightFloatingMenu';
import { ReadingExitBar } from './ReadingExitBar';
import { TranslationToggle } from './TranslationToggle';
import { ContentPipelineStatus } from './ContentPipelineStatus';

interface ReaderViewProps {
  article: Article;
  onBack: () => void;
}

/** Render markdown-like body as simple HTML blocks */
function RenderedBody({ content }: { content: string }): ReactElement {
  const blocks = content.split('\n\n');

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none space-y-4 text-foreground leading-relaxed">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Heading
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const text = headingMatch[2];
          if (level === 1) return <h1 key={i} className="text-2xl font-bold mt-6 mb-2">{text}</h1>;
          if (level === 2) return <h2 key={i} className="text-xl font-semibold mt-5 mb-2">{text}</h2>;
          return <h3 key={i} className="text-lg font-medium mt-4 mb-1">{text}</h3>;
        }

        // Code block
        if (trimmed.startsWith('```')) {
          const lines = trimmed.split('\n');
          const code = lines.slice(1, -1).join('\n');
          return (
            <pre key={i} className="bg-surface-secondary rounded-lg p-4 overflow-x-auto text-sm">
              <code>{code}</code>
            </pre>
          );
        }

        // Blockquote
        if (trimmed.startsWith('>')) {
          const text = trimmed.replace(/^>\s*/, '');
          return (
            <blockquote key={i} className="border-l-3 border-accent pl-4 italic text-muted">
              {text}
            </blockquote>
          );
        }

        // List
        if (trimmed.match(/^-\s/m)) {
          const items = trimmed.split('\n').map((l) => l.replace(/^-\s*/, ''));
          return (
            <ul key={i} className="list-disc pl-6 space-y-1">
              {items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }

        // Paragraph (handle inline code)
        return (
          <p key={i}>
            {trimmed.split(/(`[^`]+`)/).map((part, j) =>
              part.startsWith('`') && part.endsWith('`') ? (
                <code key={j} className="bg-surface-secondary px-1 py-0.5 rounded text-sm text-accent">
                  {part.slice(1, -1)}
                </code>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

export function ReaderView({ article, onBack }: ReaderViewProps): ReactElement {
  const [progress, setProgress] = useState(article.readingProgress);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const pct = scrollHeight <= clientHeight ? 100 : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
      setProgress(pct);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const formattedDate = new Date(article.publishedAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col h-full relative">
      {/* Top reading progress */}
      <ProgressBar aria-label="阅读进度" value={progress} size="sm" color="accent" className="w-full">
        <ProgressBar.Track className="h-1 rounded-none">
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      {/* Floating highlight menu */}
      <HighlightFloatingMenu />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="max-w-prose mx-auto px-6 py-8">
            {/* Back + controls bar */}
            <div className="flex items-center justify-between mb-6">
              <Button variant="ghost" size="sm" onPress={onBack}>
                <ArrowLeft size={16} /> 返回列表
              </Button>
              <div className="flex items-center gap-2">
                <TranslationToggle />
              </div>
            </div>

            {/* Pipeline status */}
            <div className="mb-4">
              <ContentPipelineStatus />
            </div>

            {/* Article header */}
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-3">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                <span>{article.author}</span>
                <span>·</span>
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent hover:underline"
                >
                  {article.source} <ExternalLink size={12} />
                </a>
                <span>·</span>
                <span>{formattedDate}</span>
                <Chip size="sm" variant="soft">
                  {article.sourceType === 'rss' ? 'RSS' : article.sourceType === 'site-watch' ? '网站监测' : '频道'}
                </Chip>
              </div>
            </header>

            {/* Body */}
            <RenderedBody content={MOCK_ARTICLE_BODY} />
          </div>
        </div>

        {/* Right context panel */}
        <aside className="w-72 border-l border-border bg-surface shrink-0 overflow-hidden">
          <ReaderContextPanel articleId={article.id} />
        </aside>
      </div>

      {/* Bottom exit bar */}
      <ReadingExitBar />
    </div>
  );
}
