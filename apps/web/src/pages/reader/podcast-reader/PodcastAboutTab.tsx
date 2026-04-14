import { type ReactElement, useRef, useEffect } from 'react';
import { annotatePodcastTimestampLines } from './podcast-timestamps';

interface PodcastAboutTabProps {
  showNotes: string | null;
  onSeek?: (seconds: number) => void;
}

export function PodcastAboutTab({ showNotes, onSeek }: PodcastAboutTabProps): ReactElement {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current || !onSeek) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const timestampLine = target.closest('.podcast-timestamp-line');
      if (!timestampLine) return;

      const seconds = timestampLine.getAttribute('data-podcast-ts');
      if (seconds) {
        const secondsNum = Number(seconds);
        if (Number.isFinite(secondsNum)) {
          onSeek(secondsNum);
        }
      }
    };

    contentRef.current.addEventListener('click', handleClick);
    return () => {
      contentRef.current?.removeEventListener('click', handleClick);
    };
  }, [onSeek]);

  if (!showNotes) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-sm text-muted text-center">No show notes available</p>
      </div>
    );
  }

  const annotated = annotatePodcastTimestampLines(showNotes);

  return (
    <div className="h-full overflow-y-auto" ref={contentRef}>
      <div
        className="prose prose-sm dark:prose-invert max-w-none p-4"
        dangerouslySetInnerHTML={{ __html: annotated }}
      />
      <style>{`
        .podcast-timestamp-line {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        .podcast-timestamp-line:hover {
          background-color: oklch(var(--color-default-100));
        }
      `}</style>
    </div>
  );
}
