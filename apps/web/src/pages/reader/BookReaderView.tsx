import { useState, useEffect, useRef, type ReactElement } from 'react';
import { Button, Chip, ProgressBar } from '@heroui/react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { BookItem, BookChapter } from './mock-data';
import { MOCK_BOOK_TOC, MOCK_BOOK_CHAPTER_BODY } from './mock-data';
import { ReaderContextPanel } from './ReaderContextPanel';
import { ReadingExitBar } from './ReadingExitBar';

interface BookReaderViewProps {
  book: BookItem;
  onBack: () => void;
}

/** Simple markdown-to-JSX renderer (mirrors ReaderView's RenderedBody) */
function RenderedBody({ content }: { content: string }): ReactElement {
  const blocks = content.split('\n\n');

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none space-y-4 text-foreground leading-relaxed">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const text = headingMatch[2];
          if (level === 1) return <h1 key={i} className="text-2xl font-bold mt-6 mb-2">{text}</h1>;
          if (level === 2) return <h2 key={i} className="text-xl font-semibold mt-5 mb-2">{text}</h2>;
          return <h3 key={i} className="text-lg font-medium mt-4 mb-1">{text}</h3>;
        }

        if (trimmed.startsWith('```')) {
          const lines = trimmed.split('\n');
          const code = lines.slice(1, -1).join('\n');
          return (
            <pre key={i} className="bg-surface-secondary rounded-lg p-4 overflow-x-auto text-sm">
              <code>{code}</code>
            </pre>
          );
        }

        if (trimmed.startsWith('>')) {
          const text = trimmed.replace(/^>\s*/, '');
          return (
            <blockquote key={i} className="border-l-3 border-accent pl-4 italic text-muted">
              {text}
            </blockquote>
          );
        }

        if (trimmed.match(/^[-\d].\s/m)) {
          const isOrdered = /^\d/.test(trimmed);
          const items = trimmed.split('\n').map((l) => l.replace(/^[-\d]+\.\s*/, ''));
          if (isOrdered) {
            return (
              <ol key={i} className="list-decimal pl-6 space-y-1">
                {items.map((item, j) => <li key={j}>{item}</li>)}
              </ol>
            );
          }
          return (
            <ul key={i} className="list-disc pl-6 space-y-1">
              {items.map((item, j) => <li key={j}>{item}</li>)}
            </ul>
          );
        }

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

export function BookReaderView({ book, onBack }: BookReaderViewProps): ReactElement {
  const [currentChapter, setCurrentChapter] = useState(book.currentChapter);
  const [chapterProgress, setChapterProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const toc: BookChapter[] = MOCK_BOOK_TOC;

  const overallProgress = Math.round(((currentChapter - 1) / book.totalChapters) * 100 + chapterProgress / book.totalChapters);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const pct = scrollHeight <= clientHeight ? 100 : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
      setChapterProgress(pct);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [currentChapter]);

  // Reset scroll on chapter change
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    setChapterProgress(0);
  }, [currentChapter]);

  const goToChapter = (num: number) => {
    if (num >= 1 && num <= book.totalChapters) {
      setCurrentChapter(num);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top progress */}
      <ProgressBar aria-label="阅读进度" value={overallProgress} size="sm" color="accent" className="w-full">
        <ProgressBar.Track className="h-1 rounded-none">
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
        <Button variant="ghost" size="sm" onPress={onBack}>
          <ArrowLeft size={16} /> 返回
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{book.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={currentChapter}
            onChange={(e) => goToChapter(Number(e.target.value))}
            className="bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
          >
            {toc.map((ch) => (
              <option key={ch.id} value={ch.number}>
                第{ch.number}章 {ch.title}
              </option>
            ))}
          </select>
          <Chip size="sm" variant="soft">
            {overallProgress}%
          </Chip>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar – TOC */}
        <aside className="w-56 border-r border-border bg-surface shrink-0 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-xs font-semibold text-muted uppercase mb-2">目录</h3>
            <nav className="space-y-0.5">
              {toc.map((ch) => (
                <button
                  key={ch.id}
                  className={`block w-full text-left text-sm rounded px-2 py-1.5 transition-colors ${
                    ch.number === currentChapter
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-muted hover:bg-surface-secondary hover:text-foreground'
                  }`}
                  onClick={() => goToChapter(ch.number)}
                >
                  <span className="text-xs text-muted mr-1.5">{ch.number}.</span>
                  {ch.title}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="max-w-prose mx-auto px-6 py-8">
            {/* Chapter nav */}
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="ghost"
                size="sm"
                isDisabled={currentChapter <= 1}
                onPress={() => goToChapter(currentChapter - 1)}
              >
                <ChevronLeft size={14} /> 上一章
              </Button>
              <span className="text-xs text-muted">
                第 {currentChapter} / {book.totalChapters} 章
              </span>
              <Button
                variant="ghost"
                size="sm"
                isDisabled={currentChapter >= book.totalChapters}
                onPress={() => goToChapter(currentChapter + 1)}
              >
                下一章 <ChevronRight size={14} />
              </Button>
            </div>

            <RenderedBody content={MOCK_BOOK_CHAPTER_BODY} />

            {/* Bottom chapter nav */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                isDisabled={currentChapter <= 1}
                onPress={() => goToChapter(currentChapter - 1)}
              >
                <ChevronLeft size={14} /> 上一章
              </Button>
              <Button
                variant="secondary"
                size="sm"
                isDisabled={currentChapter >= book.totalChapters}
                onPress={() => goToChapter(currentChapter + 1)}
              >
                下一章 <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* Right context panel */}
        <aside className="w-72 border-l border-border bg-surface shrink-0 overflow-hidden">
          <ReaderContextPanel articleId={book.id} />
        </aside>
      </div>

      {/* Bottom exit bar */}
      <ReadingExitBar />
    </div>
  );
}
