import { type ReactElement } from 'react';
import { Card, Chip, Button, Separator } from '@heroui/react';
import {
  CheckCircle,
  CalendarDays,
  FolderOpen,
  Flag,
  PenLine,
  Check,
} from 'lucide-react';
import type { InboxItem } from './mock-data';

interface InboxDetailTodoProps {
  item: InboxItem;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  in_progress: '进行中',
  done: '已完成',
};

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success'> = {
  pending: 'default',
  in_progress: 'warning',
  done: 'success',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

const PRIORITY_COLORS: Record<string, 'default' | 'warning' | 'danger' | 'accent'> = {
  low: 'default',
  medium: 'accent',
  high: 'warning',
  urgent: 'danger',
};

export function InboxDetailTodo({ item }: InboxDetailTodoProps): ReactElement {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start gap-3">
          <CheckCircle size={24} className="text-muted mt-0.5 shrink-0" />
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            {item.title}
          </h1>
        </div>

        {/* Status & Priority chips */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {item.todoStatus && (
            <Chip
              variant="soft"
              color={STATUS_COLORS[item.todoStatus]}
              size="sm"
            >
              {STATUS_LABELS[item.todoStatus]}
            </Chip>
          )}
          {item.todoPriority && (
            <Chip
              variant="soft"
              color={PRIORITY_COLORS[item.todoPriority]}
              size="sm"
            >
              <Flag size={10} className="inline mr-0.5" />
              {PRIORITY_LABELS[item.todoPriority]}
            </Chip>
          )}
        </div>

        <Separator className="my-6" />

        {/* Details */}
        <div className="space-y-3">
          {item.todoDueDate && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays size={14} className="text-muted" />
              <span className="text-muted">截止日期</span>
              <span className="ml-auto text-foreground">{item.todoDueDate}</span>
            </div>
          )}
          {item.todoProject && (
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen size={14} className="text-muted" />
              <span className="text-muted">项目</span>
              <span className="ml-auto text-foreground">{item.todoProject}</span>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* Description */}
        <div>
          <span className="text-xs font-medium text-muted">描述</span>
          <p className="text-sm text-foreground mt-1">{item.preview}</p>
        </div>

        {/* Progress */}
        {item.todoStatus === 'in_progress' && (
          <>
            <Separator className="my-6" />
            <div>
              <span className="text-xs font-medium text-muted">进度</span>
              <div className="h-2 bg-surface-secondary rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: '40%' }}
                />
              </div>
              <p className="text-xs text-muted mt-1">进行中</p>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-8">
          {item.todoStatus !== 'done' && (
            <Button variant="primary" onPress={() => {}}>
              <Check size={16} /> 标记完成
            </Button>
          )}
          <Button variant="secondary" onPress={() => {}}>
            <PenLine size={16} /> 编辑
          </Button>
        </div>
      </div>
    </div>
  );
}
