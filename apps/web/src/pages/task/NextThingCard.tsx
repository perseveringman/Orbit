import { useState, type ReactElement } from 'react';
import { Card, Chip, Button } from '@heroui/react';
import { Sparkles, FolderOpen, Milestone as MsIcon, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { type TodayRecommendation } from './mock-data';
import { useTask, useProject, useMilestoneList } from '../../data';

interface NextThingCardProps {
  recommendation: TodayRecommendation;
  onStartFocus?: () => void;
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-muted">
      {label}
      <span className="font-semibold text-foreground">{pct}</span>
    </span>
  );
}

export function NextThingCard({
  recommendation,
  onStartFocus,
}: NextThingCardProps): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const task = useTask(recommendation.taskId);
  const project = useProject(task?.projectId ?? null);
  const { milestones } = useMilestoneList();
  const milestone = task?.milestoneId ? milestones.find(m => m.id === task.milestoneId) ?? null : null;

  return (
    <Card className="border-l-4 border-accent">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-accent" />
          <span className="text-sm font-semibold text-accent">下一件事</span>
        </div>
      </Card.Header>
      <Card.Title>
        <span className="text-xl">{task?.title ?? '未知任务'}</span>
      </Card.Title>
      <Card.Content>
        <div className="space-y-3">
          {/* Context chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {project && (
              <Chip variant="soft" size="sm">
                <FolderOpen size={12} className="inline mr-1" />
                {project.title}
              </Chip>
            )}
            {milestone && (
              <Chip variant="soft" size="sm">
                <MsIcon size={12} className="inline mr-1" />
                {milestone.title}
              </Chip>
            )}
          </div>

          {/* Reasoning (expandable) */}
          <div>
            <button
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              为什么推荐这个？
            </button>
            {expanded && (
              <p className="mt-2 text-sm text-muted leading-relaxed bg-surface-secondary rounded-lg p-3">
                {recommendation.reasoning}
              </p>
            )}
          </div>

          {/* Scores */}
          <div className="flex items-center gap-2 flex-wrap">
            <ScoreBadge label="紧急" value={recommendation.urgency} />
            <ScoreBadge label="重要" value={recommendation.importance} />
            <ScoreBadge label="契合" value={recommendation.contextFit} />
          </div>
        </div>
      </Card.Content>
      <Card.Footer>
        <Button
          variant="primary"
          onPress={onStartFocus}
          isDisabled={!task || !onStartFocus}
        >
          <Zap size={16} /> 开始专注
        </Button>
      </Card.Footer>
    </Card>
  );
}
