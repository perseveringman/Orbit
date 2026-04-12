import type { ReactElement } from 'react';
import { useState } from 'react';
import { Card, Chip, Tabs } from '@heroui/react';
import { Calendar } from 'lucide-react';
import type { Vision, VisionStatus } from './mock-data';

interface VisionListViewProps {
  visions: Vision[];
  onSelectVision: (visionId: string) => void;
}

const scopeConfig = {
  life: { label: '生活', color: 'accent' as const },
  career: { label: '职业', color: 'success' as const },
  theme: { label: '主题', color: 'default' as const },
};

const reminderModeLabels = {
  gentle: '温和提醒',
  persistent: '持续提醒',
  none: '无提醒',
};

export function VisionListView({ visions, onSelectVision }: VisionListViewProps): ReactElement {
  const [activeTab, setActiveTab] = useState<VisionStatus>('active');

  const filteredVisions = visions.filter((v) => v.status === activeTab);

  return (
    <div className="flex flex-col h-full">
      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as VisionStatus)}>
        <Tabs.List className="px-6 pt-4">
          <Tabs.Tab key="active">活跃</Tabs.Tab>
          <Tabs.Tab key="archived">已归档</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVisions.map((vision) => (
            <div
              key={vision.id}
              onClick={() => onSelectVision(vision.id)}
              className="cursor-pointer"
            >
            <Card
              className="hover:bg-surface-secondary transition-colors"
            >
              <Card.Header>
                <div className="flex items-start justify-between gap-2 w-full">
                  <Card.Title className="text-lg">{vision.title}</Card.Title>
                  <Chip variant="soft" color={scopeConfig[vision.scope].color} size="sm">
                    {scopeConfig[vision.scope].label}
                  </Chip>
                </div>
              </Card.Header>
              <Card.Content className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Calendar size={16} />
                  <span>
                    最后重申：{vision.lastReaffirmedAt.toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Chip variant="soft" size="sm">
                    {reminderModeLabels[vision.reminderMode]}
                  </Chip>
                </div>
              </Card.Content>
            </Card>
            </div>
          ))}
        </div>

        {filteredVisions.length === 0 && (
          <div className="text-center py-12 text-muted">
            {activeTab === 'active' ? '暂无活跃的愿景' : '暂无已归档的愿景'}
          </div>
        )}
      </div>
    </div>
  );
}
