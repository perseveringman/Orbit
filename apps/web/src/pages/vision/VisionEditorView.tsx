import type { ReactElement } from 'react';
import { useState } from 'react';
import { Button, Chip, Input } from '@heroui/react';
import { ArrowLeft, Save, Lock } from 'lucide-react';
import { VersionTimelinePanel } from './VersionTimelinePanel';
import { DirectivePanel } from './DirectivePanel';
import { PrivacyPopover } from './PrivacyPopover';
import { mockVersions } from './mock-data';
import type { Vision, VisionVersion, PrivacyLevel } from './mock-data';

interface VisionEditorViewProps {
  vision: Vision;
  onBack: () => void;
}

const privacyLabels: Record<PrivacyLevel, string> = {
  'local-only': '仅本地',
  'cloud-summary': '云端摘要',
  'full-sync': '完全同步',
};

export function VisionEditorView({ vision, onBack }: VisionEditorViewProps): ReactElement {
  const versions = mockVersions.filter((v) => v.visionId === vision.id);
  const latestVersion = versions.sort((a, b) => b.versionNo - a.versionNo)[0];
  
  const [body, setBody] = useState(latestVersion?.body || '');
  const [changeNote, setChangeNote] = useState('');
  const [showTimeline, setShowTimeline] = useState(true);
  const [showDirectives, setShowDirectives] = useState(false);

  const handleSaveVersion = () => {
    console.log('Saving new version:', { body, changeNote });
    setChangeNote('');
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <Button variant="ghost" onPress={onBack} isIconOnly>
            <ArrowLeft size={20} />
          </Button>
          <h2 className="text-xl font-semibold text-foreground flex-1">{vision.title}</h2>
          <div className="flex gap-2">
            <Button
              variant={showDirectives ? 'primary' : 'secondary'}
              onPress={() => {
                setShowDirectives(!showDirectives);
                setShowTimeline(false);
              }}
            >
              Directives
            </Button>
            <Button
              variant={showTimeline ? 'primary' : 'secondary'}
              onPress={() => {
                setShowTimeline(!showTimeline);
                setShowDirectives(false);
              }}
            >
              版本历史
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-4">
          <div className="flex gap-4 items-start">
            <Input
              placeholder="版本变更说明（可选）"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              className="flex-1"
            />
            <Button variant="primary" onPress={handleSaveVersion}>
              <Save size={18} />
              保存新版本
            </Button>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="在此书写你的愿景..."
            className="flex-1 w-full p-4 bg-surface border border-border rounded-lg text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent"
          />

          <div className="flex items-center gap-3">
            <Chip variant="soft" size="sm">
              版本 {latestVersion?.versionNo || 1}
            </Chip>
            <Chip
              variant="soft"
              color={latestVersion?.authoredBy === 'user' ? 'success' : 'accent'}
              size="sm"
            >
              {latestVersion?.authoredBy === 'user' ? '用户' : 'Agent 草稿'}
            </Chip>
            <PrivacyPopover currentLevel={vision.privacyLevel}>
              <Chip variant="soft" size="sm" className="cursor-pointer">
                <Lock size={14} className="mr-1" />
                {privacyLabels[vision.privacyLevel]}
              </Chip>
            </PrivacyPopover>
          </div>
        </div>
      </div>

      {showTimeline && (
        <div className="w-80 border-l border-border overflow-y-auto">
          <VersionTimelinePanel versions={versions} />
        </div>
      )}

      {showDirectives && (
        <div className="w-96 border-l border-border overflow-y-auto">
          <DirectivePanel visionId={vision.id} />
        </div>
      )}
    </div>
  );
}
