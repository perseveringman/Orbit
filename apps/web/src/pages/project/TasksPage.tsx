import { useState, type ReactElement } from 'react';
import { Button, Chip } from '@heroui/react';
import {
  Upload,
  Plus,
  Settings,
  Filter,
  ArrowUpDown,
  Table2,
  LayoutGrid,
  GanttChart,
  X,
  CheckCircle2,
  ClipboardList as ClipboardListIcon,
  Clock,
} from 'lucide-react';
import {
  MOCK_STATS,
  MOCK_TASKS,
  MOCK_CALENDAR_TASKS,
} from './mock-data';
import { TaskStatusOverviewCard, StatCard } from './TaskStatsCards';
import { TaskCalendar } from './TaskCalendar';
import { TaskKanban } from './TaskKanban';

// ─── View Mode ───────────────────────────────────────────────────────

type ViewMode = 'table' | 'kanban' | 'timeline';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: ReactElement }[] = [
  { id: 'table', label: '表格', icon: <Table2 size={14} /> },
  { id: 'kanban', label: '看板', icon: <LayoutGrid size={14} /> },
  { id: 'timeline', label: '时间线', icon: <GanttChart size={14} /> },
];

// ─── Page ────────────────────────────────────────────────────────────

export function TasksPage(): ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [urgentFilter, setUrgentFilter] = useState(true);

  const filteredTasks = urgentFilter
    ? MOCK_TASKS.filter((t) => t.priority === 'urgent')
    : MOCK_TASKS;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* ─── Page Header ─────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">任务</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted mt-1">
            <Settings size={14} />
            最近同步: 刚刚
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <Upload size={14} />
            导入任务
          </Button>
          <Button variant="primary" size="sm">
            <Plus size={14} />
            添加任务
          </Button>
        </div>
      </div>

      {/* ─── Stats + Calendar (2-column layout) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: Task Status Overview (spans 1 col, 2 rows) */}
        <div className="lg:row-span-2">
          <TaskStatusOverviewCard stats={MOCK_STATS} />
        </div>

        {/* Right top: 3 stat cards */}
        <StatCard
          title="已完成任务"
          value={MOCK_STATS.completed}
          change={10}
          icon={<CheckCircle2 size={20} className="text-green-500" />}
          iconClassName="bg-green-50"
        />
        <StatCard
          title="待处理任务"
          value={MOCK_STATS.pending}
          change={14}
          icon={<ClipboardListIcon size={20} className="text-orange-500" />}
          iconClassName="bg-orange-50"
        />
        <StatCard
          title="即将到期"
          value={MOCK_STATS.upcomingDeadlines}
          change={-5}
          icon={<Clock size={20} className="text-red-500" />}
          iconClassName="bg-red-50"
        />

        {/* Right bottom: Calendar (spans 3 cols) */}
        <div className="lg:col-span-3">
          <TaskCalendar tasks={MOCK_CALENDAR_TASKS} />
        </div>
      </div>

      {/* ─── All Tasks Section ───────────────────────────── */}
      <section>
        {/* Header bar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-xl font-bold text-foreground">全部任务</h2>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter */}
            <Button variant="secondary" size="sm">
              <Filter size={14} />
              筛选
            </Button>

            {/* Active filter chip */}
            {urgentFilter && (
              <Chip
                variant="soft"
                size="sm"
                className="bg-red-100 text-red-700"
              >
                紧急
                <button
                  onClick={() => setUrgentFilter(false)}
                  aria-label="移除紧急筛选"
                  className="ml-1"
                >
                  <X size={12} />
                </button>
              </Chip>
            )}

            {/* Sort */}
            <Button variant="secondary" size="sm">
              <ArrowUpDown size={14} />
              排序
            </Button>

            {/* View toggles */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setViewMode(opt.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors ${
                    viewMode === opt.id
                      ? 'bg-foreground text-background font-semibold'
                      : 'text-muted hover:bg-content2'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Kanban board (default view) */}
        {viewMode === 'kanban' && <TaskKanban tasks={filteredTasks} />}

        {viewMode === 'table' && (
          <div className="text-sm text-muted p-8 text-center bg-content2 rounded-xl">
            表格视图（开发中）
          </div>
        )}

        {viewMode === 'timeline' && (
          <div className="text-sm text-muted p-8 text-center bg-content2 rounded-xl">
            时间线视图（开发中）
          </div>
        )}
      </section>
    </div>
  );
}
