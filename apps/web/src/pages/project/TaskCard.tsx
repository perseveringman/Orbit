import type { ReactElement } from 'react';
import { Card, ProgressBar } from '@heroui/react';
import {
  Clock,
  Flag,
  MoreHorizontal,
  Paperclip,
  MessageSquare,
} from 'lucide-react';
import { PRIORITY_COLORS, type TaskItem } from './mock-data';

export interface TaskCardProps {
  task: TaskItem;
  onMenuClick?: () => void;
}

export function TaskCard({ task, onMenuClick }: TaskCardProps): ReactElement {
  const flagColor = PRIORITY_COLORS[task.priority];
  const showProgress = task.progress > 0 && task.status !== 'todo';

  const formattedDate = new Date(task.dueDate + 'T00:00:00').toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const initials = task.assignee.name.slice(0, 1);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
      {/* Top row: due date + menu */}
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1 text-xs text-muted">
          <Clock size={12} />
          截止: {formattedDate}
        </span>
        <button
          className="text-muted hover:text-foreground"
          aria-label="任务菜单"
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick?.();
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Title with flag */}
      <div className="flex items-start gap-2 mb-1">
        <Flag size={14} style={{ color: flagColor }} className="mt-0.5 shrink-0" />
        <p className="text-sm font-semibold text-foreground leading-snug">
          {task.title}
        </p>
      </div>

      {/* Project */}
      <p className="text-xs text-muted mb-3 pl-[22px]">{task.project}</p>

      {/* Progress */}
      {showProgress && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted">进度</span>
            <span className="text-[10px] font-medium text-foreground">
              {task.progress}%
            </span>
          </div>
          <ProgressBar aria-label="进度" value={task.progress} size="sm">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      )}

      {/* Bottom: avatar + attachments + comments */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div
          className="w-6 h-6 rounded-full bg-content2 flex items-center justify-center text-[10px] font-semibold text-foreground"
          title={task.assignee.name}
        >
          {initials}
        </div>
        <div className="flex items-center gap-3">
          {task.attachments > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted">
              <Paperclip size={12} />
              {task.attachments}
            </span>
          )}
          {task.comments > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted">
              <MessageSquare size={12} />
              {task.comments}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
