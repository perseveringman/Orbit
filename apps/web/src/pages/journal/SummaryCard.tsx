import { useState, type ReactElement } from 'react';
import { Sparkles, RefreshCw, Pencil } from 'lucide-react';
import { Card, Chip, Button } from '@heroui/react';
import type { Summary, SummaryScope } from './mock-data';

const SCOPE_LABELS: Record<SummaryScope, string> = {
  day: '日',
  week: '周',
  month: '月',
};

const GENERATED_LABELS: Record<string, string> = {
  system: '系统生成',
  agent: 'AI 代理',
  user_edited: '用户编辑',
};

interface SummaryCardProps {
  summary?: Summary;
  onGenerate?: () => void;
}

export function SummaryCard({ summary, onGenerate }: SummaryCardProps): ReactElement {
  const [isEditing, setIsEditing] = useState(false);

  if (!summary) {
    return (
      <Card>
        <Card.Content>
          <div className="flex flex-col items-center py-8 gap-3">
            <Sparkles size={24} className="text-muted" />
            <p className="text-sm text-muted">暂无摘要</p>
            <Button variant="primary" onPress={onGenerate}>
              生成今日摘要
            </Button>
          </div>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <span className="font-semibold text-foreground">AI 摘要</span>
            <Chip variant="soft" color="accent" size="sm">{SCOPE_LABELS[summary.scope]}</Chip>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onPress={() => setIsEditing(!isEditing)}>
              <Pencil size={14} /> 编辑
            </Button>
            <Button variant="ghost" size="sm" onPress={onGenerate}>
              <RefreshCw size={14} /> 重新生成
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Content>
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {summary.body}
        </div>
      </Card.Content>
      <Card.Footer>
        <div className="flex items-center justify-between w-full text-xs text-muted">
          <span>基于 {summary.sourceCount} 条行为记录</span>
          <div className="flex items-center gap-2">
            <span>{GENERATED_LABELS[summary.generatedBy]}</span>
            <span>v{summary.version}</span>
          </div>
        </div>
      </Card.Footer>
    </Card>
  );
}
