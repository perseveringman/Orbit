import type { ReactElement } from 'react';
import { Card, Chip } from '@heroui/react';
import { Check, Circle, Zap, X } from 'lucide-react';
import {
  type Milestone,
  type MilestoneStatus,
} from './mock-data';

interface MilestoneTimelineProps {
  milestones: Milestone[];
  taskStatsByMilestone?: Record<string, { total: number; done: number }>;
}

const MILESTONE_ICON: Record<MilestoneStatus, ReactElement> = {
  done: <Check size={16} className="text-success" />,
  active: <Zap size={16} className="text-accent animate-pulse" />,
  planned: <Circle size={16} className="text-muted" />,
  dropped: <X size={16} className="text-danger" />,
};

const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  done: '已完成',
  active: '进行中',
  planned: '计划中',
  dropped: '已放弃',
};

const MILESTONE_DOT_COLORS: Record<MilestoneStatus, string> = {
  done: 'bg-success',
  active: 'bg-accent',
  planned: 'bg-surface-secondary',
  dropped: 'bg-danger',
};

export function MilestoneTimeline({
  milestones,
  taskStatsByMilestone = {},
}: MilestoneTimelineProps): ReactElement {
  return (
    <div className="relative pl-6">
      {/* Connecting line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

      <div className="space-y-4">
        {milestones.map((ms) => {
          const stats = taskStatsByMilestone[ms.id] ?? {
            total: ms.taskIds.length,
            done: 0,
          };
          const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

          return (
            <div key={ms.id} className="relative">
              {/* Dot */}
              <div
                className={`absolute -left-6 top-1 w-[22px] h-[22px] rounded-full border-2 border-background flex items-center justify-center ${MILESTONE_DOT_COLORS[ms.status]}`}
              >
                {MILESTONE_ICON[ms.status]}
              </div>

              <Card className="ml-2">
                <Card.Header>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip
                      variant="soft"
                      color={
                        ms.status === 'done'
                          ? 'success'
                          : ms.status === 'active'
                            ? 'accent'
                            : ms.status === 'dropped'
                              ? 'danger'
                              : 'default'
                      }
                      size="sm"
                    >
                      {MILESTONE_STATUS_LABELS[ms.status]}
                    </Chip>
                    {ms.dueDate && (
                      <span className="text-xs text-muted">
                        截止 {ms.dueDate}
                      </span>
                    )}
                  </div>
                </Card.Header>
                <Card.Title>{ms.title}</Card.Title>
                <Card.Content>
                  <p className="text-sm text-muted mb-2">
                    {ms.completionDefinition}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>
                      {stats.done}/{stats.total} 任务
                    </span>
                    <div className="flex-1 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span>{pct}%</span>
                  </div>
                </Card.Content>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
