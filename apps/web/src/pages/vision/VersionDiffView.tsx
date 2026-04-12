import type { ReactElement } from 'react';
import { useState } from 'react';
import { Button } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import { mockVersions } from './mock-data';
import type { VisionVersion } from './mock-data';

interface VersionDiffViewProps {
  visionId: string;
  onBack: () => void;
}

export function VersionDiffView({ visionId, onBack }: VersionDiffViewProps): ReactElement {
  const versions = mockVersions.filter((v) => v.visionId === visionId);
  const sortedVersions = [...versions].sort((a, b) => b.versionNo - a.versionNo);
  
  const [leftVersionId, setLeftVersionId] = useState(sortedVersions[1]?.id || sortedVersions[0]?.id);
  const [rightVersionId, setRightVersionId] = useState(sortedVersions[0]?.id);

  const leftVersion = versions.find((v) => v.id === leftVersionId);
  const rightVersion = versions.find((v) => v.id === rightVersionId);

  const computeDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    
    return { oldLines, newLines };
  };

  const { oldLines, newLines } = leftVersion && rightVersion 
    ? computeDiff(leftVersion.body, rightVersion.body)
    : { oldLines: [], newLines: [] };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
        <Button variant="ghost" onPress={onBack} isIconOnly>
          <ArrowLeft size={20} />
        </Button>
        <h2 className="text-xl font-semibold text-foreground">版本对比</h2>
      </div>

      <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
        <select
          value={leftVersionId}
          onChange={(e) => setLeftVersionId(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
        >
          {sortedVersions.map((v) => (
            <option key={v.id} value={v.id}>
              版本 {v.versionNo}
            </option>
          ))}
        </select>
        <span className="text-muted">vs</span>
        <select
          value={rightVersionId}
          onChange={(e) => setRightVersionId(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
        >
          {sortedVersions.map((v) => (
            <option key={v.id} value={v.id}>
              版本 {v.versionNo}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 border-r border-border overflow-y-auto">
          <h3 className="text-sm font-semibold text-muted mb-4">
            版本 {leftVersion?.versionNo} (旧)
          </h3>
          <div className="space-y-1">
            {oldLines.map((line, idx) => (
              <div key={idx} className="bg-red-500/10 text-red-700 dark:text-red-400 px-3 py-1 rounded">
                <span className="opacity-50">- </span>
                {line}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <h3 className="text-sm font-semibold text-muted mb-4">
            版本 {rightVersion?.versionNo} (新)
          </h3>
          <div className="space-y-1">
            {newLines.map((line, idx) => (
              <div key={idx} className="bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-1 rounded">
                <span className="opacity-50">+ </span>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
