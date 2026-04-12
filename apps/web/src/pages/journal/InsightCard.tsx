import { useState, type ReactElement } from 'react';
import {
  Crosshair, ArrowRight, AlertTriangle, Clock,
  Pin, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, Chip, Button, ProgressBar, Label } from '@heroui/react';
import type { BehaviorInsight, InsightType } from './mock-data';

const INSIGHT_CONFIG: Record<InsightType, { icon: typeof Crosshair; color: 'accent' | 'success' | 'warning' | 'danger'; label: string }> = {
  focus_pattern:  { icon: Crosshair,      color: 'accent',  label: '专注模式' },
  input_to_output: { icon: ArrowRight,    color: 'success', label: '输入→输出' },
  project_drift:  { icon: AlertTriangle,  color: 'warning', label: '项目偏移' },
  review_gap:     { icon: Clock,          color: 'danger',  label: '审查间隔' },
};

interface InsightCardProps {
  insight: BehaviorInsight;
  onPin?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export function InsightCard({ insight, onPin, onDismiss }: InsightCardProps): ReactElement {
  const [showEvidence, setShowEvidence] = useState(false);
  const config = INSIGHT_CONFIG[insight.type];
  const Icon = config.icon;

  if (insight.dismissed) {
    return (
      <Card className="opacity-60">
        <Card.Content>
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-muted" />
            <span className="text-sm text-muted line-through">{insight.statement}</span>
          </div>
          {insight.dismissReason && (
            <p className="text-xs text-muted mt-1 ml-6">驳回原因：{insight.dismissReason}</p>
          )}
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg bg-${config.color}/10`}>
              <Icon size={14} className={`text-${config.color}`} />
            </div>
            <Chip variant="soft" color={config.color} size="sm">{config.label}</Chip>
          </div>
          <span className="text-xs text-muted">还有 {insight.expiresInDays} 天过期</span>
        </div>
      </Card.Header>
      <Card.Content>
        <p className="text-sm font-semibold text-foreground mb-3">{insight.statement}</p>

        <div className="mb-3">
          <ProgressBar aria-label="置信度" value={insight.confidence} size="sm" color={config.color}>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted">置信度</Label>
              <ProgressBar.Output className="text-xs text-muted" />
            </div>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </div>

        {showEvidence && (
          <div className="text-xs text-muted bg-surface-secondary rounded-lg p-3 mb-3">
            {insight.evidence}
          </div>
        )}
      </Card.Content>
      <Card.Footer>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onPress={() => setShowEvidence(!showEvidence)}>
            {showEvidence ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showEvidence ? '收起证据' : '展开证据'}
          </Button>
          <Button variant="ghost" size="sm" onPress={() => onPin?.(insight.id)}>
            <Pin size={14} /> 固定
          </Button>
          <Button variant="ghost" size="sm" onPress={() => onDismiss?.(insight.id)}>
            <X size={14} /> 驳回
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}
