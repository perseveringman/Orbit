import type { ReactElement } from 'react';
import { Button, Card, Chip } from '@heroui/react';
import { Plus } from 'lucide-react';
import { mockDirectives } from './mock-data';
import type { DirectiveStatus, VisionScope } from './mock-data';

interface DirectivePanelProps {
  visionId: string;
}

const scopeConfig = {
  life: { label: '生活', color: 'accent' as const },
  career: { label: '职业', color: 'success' as const },
  theme: { label: '主题', color: 'default' as const },
};

const statusConfig: Record<DirectiveStatus, { label: string; color: 'success' | 'warning' | 'default' }> = {
  active: { label: '进行中', color: 'warning' },
  completed: { label: '已完成', color: 'success' },
  paused: { label: '暂停', color: 'default' },
};

export function DirectivePanel({ visionId }: DirectivePanelProps): ReactElement {
  const directives = mockDirectives.filter((d) => d.visionId === visionId);

  const handleCreateDirective = () => {
    console.log('Creating new directive for vision:', visionId);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Directives</h3>
        <Button
          variant="primary"
          size="sm"
          onPress={handleCreateDirective}
        >
          <Plus size={16} />
          新 Directive
        </Button>
      </div>

      <div className="space-y-3">
        {directives.map((directive) => (
          <div key={directive.id} className="cursor-pointer">
          <Card className="hover:bg-surface-secondary transition-colors">
            <Card.Header>
              <div className="flex items-start justify-between gap-2 w-full">
                <Card.Title className="text-sm">{directive.title}</Card.Title>
              </div>
            </Card.Header>
            <Card.Content className="space-y-2">
              <p className="text-sm text-muted line-clamp-2">{directive.body}</p>
              <div className="flex gap-2">
                <Chip variant="soft" color={statusConfig[directive.status].color} size="sm">
                  {statusConfig[directive.status].label}
                </Chip>
                <Chip variant="soft" color={scopeConfig[directive.scope].color} size="sm">
                  {scopeConfig[directive.scope].label}
                </Chip>
              </div>
            </Card.Content>
          </Card>
          </div>
        ))}
      </div>

      {directives.length === 0 && (
        <div className="text-center py-8 text-muted text-sm">
          暂无 Directive，点击上方按钮创建
        </div>
      )}
    </div>
  );
}
