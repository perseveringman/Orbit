import type { ReactElement } from 'react';
import { ProgressBar, Chip } from '@heroui/react';
import { AlertCircle } from 'lucide-react';

interface PodcastSummaryTabProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  summaryText: string | null;
  keyPoints: string[] | null;
}

export function PodcastSummaryTab({
  status,
  progress,
  summaryText,
  keyPoints,
}: PodcastSummaryTabProps): ReactElement {
  if (status === 'pending') {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-sm text-muted text-center">Summary not started</p>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
        <p className="text-sm text-muted text-center">Generating summary...</p>
        <ProgressBar value={progress} size="md" color="accent" className="w-64">
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        <p className="text-xs text-muted">{progress}%</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-2">
        <AlertCircle size={32} className="text-danger opacity-50" />
        <p className="text-sm text-danger text-center">Summary generation failed</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {summaryText && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-sm text-foreground leading-relaxed">{summaryText}</p>
        </div>
      )}

      {keyPoints && keyPoints.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Key Points</h3>
          <div className="space-y-1.5">
            {keyPoints.map((point, i) => (
              <div key={i} className="flex gap-2">
                <Chip size="sm" variant="soft" className="shrink-0">
                  {i + 1}
                </Chip>
                <p className="text-sm text-foreground leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!summaryText && (!keyPoints || keyPoints.length === 0) && (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted text-center">No summary available</p>
        </div>
      )}
    </div>
  );
}
