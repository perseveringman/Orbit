import type { ReactElement } from 'react';
import { annotatePodcastTimestampLines } from './podcast-timestamps';

interface PodcastAboutTabProps {
  showNotes: string | null;
}

export function PodcastAboutTab({ showNotes }: PodcastAboutTabProps): ReactElement {
  if (!showNotes) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-sm text-muted text-center">No show notes available</p>
      </div>
    );
  }

  const annotated = annotatePodcastTimestampLines(showNotes);

  return (
    <div className="h-full overflow-y-auto">
      <div
        className="prose prose-sm dark:prose-invert max-w-none p-4"
        dangerouslySetInnerHTML={{ __html: annotated }}
      />
    </div>
  );
}
