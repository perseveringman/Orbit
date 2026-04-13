import type { ReactElement } from 'react';
import { Card, Chip } from '@heroui/react';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  MoreHorizontal,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { STATUS_CONFIG, type TaskStats } from './mock-data';

// ─── Helpers ─────────────────────────────────────────────────────────

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

// ─── Task Status Overview Card ───────────────────────────────────────

export function TaskStatusOverviewCard({ stats }: { stats: TaskStats }): ReactElement {
  const { todo, inProgress, inReview, completed } = stats.statusBreakdown;
  const total = todo + inProgress + inReview + completed;

  const segments = [
    { key: 'todo' as const, count: todo, ...STATUS_CONFIG.todo },
    { key: 'in_progress' as const, count: inProgress, ...STATUS_CONFIG.in_progress },
    { key: 'in_review' as const, count: inReview, ...STATUS_CONFIG.in_review },
    { key: 'completed' as const, count: completed, ...STATUS_CONFIG.completed },
  ];

  return (
    <Card className="p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-foreground">任务状态概览</span>
        <button className="text-muted hover:text-foreground" aria-label="更多">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-3">
        {segments.map((s) => (
          <div
            key={s.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${pct(s.count, total)}%`, backgroundColor: s.color }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label} {pct(s.count, total)}%
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <p className="text-xs font-semibold text-foreground mb-2">状态明细</p>
      <div className="grid grid-cols-2 gap-2">
        {segments.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between rounded-lg bg-content2 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {pct(s.count, total)}%
                </p>
                <p className="text-[10px] text-muted">{s.count} 个任务</p>
              </div>
            </div>
            <Info size={12} className="text-muted" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Stat Card (generic) ─────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: number;
  change: number;
  icon: ReactElement;
  iconClassName?: string;
}

export function StatCard({
  title,
  value,
  change,
  icon,
  iconClassName,
}: StatCardProps): ReactElement {
  const isPositive = change >= 0;

  return (
    <Card className="p-5 relative">
      <ArrowUpRight
        size={14}
        className="absolute top-4 right-4 text-muted"
      />
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconClassName ?? 'bg-content2'}`}
        >
          {icon}
        </div>
        <span className="text-sm font-medium text-muted">{title}</span>
      </div>
      <p className="text-4xl font-bold text-foreground mb-2">{value}</p>
      <div className="flex items-center gap-2">
        <Chip
          variant="soft"
          size="sm"
          className={isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
        >
          {isPositive ? '+' : ''}{change}%
        </Chip>
        <span className="text-xs text-muted">从上月</span>
      </div>
    </Card>
  );
}

// ─── Export ──────────────────────────────────────────────────────────

export function TaskStatsCards({ stats }: { stats: TaskStats }): ReactElement {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <TaskStatusOverviewCard stats={stats} />

      <StatCard
        title="已完成任务"
        value={stats.completed}
        change={10}
        icon={<CheckCircle2 size={20} className="text-green-500" />}
        iconClassName="bg-green-50"
      />

      <StatCard
        title="待处理任务"
        value={stats.pending}
        change={14}
        icon={<ClipboardList size={20} className="text-orange-500" />}
        iconClassName="bg-orange-50"
      />

      <StatCard
        title="即将到期"
        value={stats.upcomingDeadlines}
        change={-5}
        icon={<Clock size={20} className="text-red-500" />}
        iconClassName="bg-red-50"
      />
    </div>
  );
}
