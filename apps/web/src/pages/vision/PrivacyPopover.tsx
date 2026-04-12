import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';
import { Card } from '@heroui/react';
import { Shield } from 'lucide-react';
import type { PrivacyLevel } from './mock-data';

interface PrivacyPopoverProps {
  currentLevel: PrivacyLevel;
  children: ReactNode;
}

const privacyOptions: Array<{ value: PrivacyLevel; label: string; description: string }> = [
  {
    value: 'local-only',
    label: '仅本地',
    description: '愿景仅存储在本地设备，不上传到云端',
  },
  {
    value: 'cloud-summary',
    label: '云端摘要',
    description: '仅上传愿景摘要，用于跨设备提醒',
  },
  {
    value: 'full-sync',
    label: '完全同步',
    description: '完整内容同步到云端，支持所有设备访问',
  },
];

export function PrivacyPopover({ currentLevel, children }: PrivacyPopoverProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<PrivacyLevel>(currentLevel);

  const handleSelect = (level: PrivacyLevel) => {
    setSelectedLevel(level);
    console.log('Privacy level changed to:', level);
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div className="relative">
      <div onClick={() => setIsOpen(!isOpen)}>{children}</div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 right-0 z-50 w-80">
            <Card className="border border-border shadow-lg">
              <Card.Header>
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-accent" />
                  <Card.Title className="text-sm">隐私设置</Card.Title>
                </div>
              </Card.Header>
              <Card.Content className="space-y-2">
                {privacyOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedLevel === option.value
                        ? 'bg-accent-soft border-2 border-accent'
                        : 'bg-surface hover:bg-surface-secondary border border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedLevel === option.value
                            ? 'border-accent bg-accent'
                            : 'border-border'
                        }`}
                      >
                        {selectedLevel === option.value && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-foreground">{option.label}</div>
                        <div className="text-xs text-muted mt-1">{option.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </Card.Content>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
