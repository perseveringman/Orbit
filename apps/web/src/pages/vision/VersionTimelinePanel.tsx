import type { ReactElement } from 'react';
import { Chip } from '@heroui/react';
import { Calendar } from 'lucide-react';
import type { VisionVersion } from './mock-data';

interface VersionTimelinePanelProps {
  versions: VisionVersion[];
}

export function VersionTimelinePanel({ versions }: VersionTimelinePanelProps): ReactElement {
  const sortedVersions = [...versions].sort((a, b) => b.versionNo - a.versionNo);
  const latestVersionNo = sortedVersions[0]?.versionNo;

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold text-foreground">版本历史</h3>
      
      <div className="relative space-y-6">
        {sortedVersions.map((version, index) => {
          const isLatest = version.versionNo === latestVersionNo;
          
          return (
            <div
              key={version.id}
              className={`relative pl-6 pb-6 ${
                index !== sortedVersions.length - 1 ? 'border-l-2 border-border' : ''
              }`}
            >
              <div
                className={`absolute left-0 top-1.5 w-3 h-3 rounded-full -translate-x-[7px] ${
                  isLatest ? 'bg-accent ring-4 ring-accent-soft' : 'bg-surface border-2 border-border'
                }`}
              />
              
              <div className={`space-y-2 ${isLatest ? 'border-2 border-accent rounded-lg p-3 bg-accent-soft' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">版本 {version.versionNo}</span>
                  <Chip
                    variant="soft"
                    color={version.authoredBy === 'user' ? 'success' : 'accent'}
                    size="sm"
                  >
                    {version.authoredBy === 'user' ? '用户' : 'Agent'}
                  </Chip>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Calendar size={14} />
                  <span>{version.createdAt.toLocaleDateString('zh-CN')}</span>
                </div>
                
                {version.changeNote && (
                  <p className="text-sm text-muted italic">{version.changeNote}</p>
                )}
                
                <p className="text-sm text-foreground line-clamp-3">{version.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
