import type { ReactElement } from 'react';
import { useState } from 'react';
import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';
import { VisionListView } from './VisionListView';
import { VisionEditorView } from './VisionEditorView';
import { OnboardingWizard } from './OnboardingWizard';
import { mockVisions } from './mock-data';
import type { Vision } from './mock-data';

export function VisionPage(): ReactElement {
  const [visions] = useState<Vision[]>(mockVisions);
  const [selectedVisionId, setSelectedVisionId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const selectedVision = visions.find((v) => v.id === selectedVisionId);
  const hasVisions = visions.length > 0;

  const handleCreateVision = () => {
    setShowOnboarding(true);
  };

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <OnboardingWizard onComplete={handleCompleteOnboarding} />;
  }

  if (!hasVisions) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-semibold text-foreground">开始你的愿景之旅</h2>
          <p className="text-muted">
            愿景是你对未来的描绘，它帮助你在日常决策中保持方向感。
          </p>
          <Button variant="primary" onPress={handleCreateVision}>
            <Plus size={20} />
            创建第一个愿景
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold text-foreground">愿景</h1>
        <Button variant="primary" onPress={handleCreateVision}>
          <Plus size={20} />
          新愿景
        </Button>
      </header>
      <div className="flex-1 overflow-hidden">
        {selectedVision ? (
          <VisionEditorView
            vision={selectedVision}
            onBack={() => setSelectedVisionId(null)}
          />
        ) : (
          <VisionListView
            visions={visions}
            onSelectVision={(visionId) => setSelectedVisionId(visionId)}
          />
        )}
      </div>
    </div>
  );
}
