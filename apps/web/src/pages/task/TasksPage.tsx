import { useState, type ReactElement } from 'react';
import { Card, Chip, Button, Tabs, Separator } from '@heroui/react';
import {
  FolderOpen,
  CalendarDays,
  ClipboardList,
  Crosshair,
  Plus,
} from 'lucide-react';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  type TaskStatus,
  type Task,
  type Project,
} from './mock-data';
import { useTaskList, useProjectList } from '../../data';
import { QuickCaptureInput } from './QuickCaptureInput';
import { TaskDetailPanel } from './TaskDetailPanel';

// Statuses to display as grouped sections
const GROUPED_STATUSES: TaskStatus[] = [
  'captured',
  'clarifying',
  'ready',
  'scheduled',
  'focused',
  'blocked',
];

const KANBAN_STATUSES: TaskStatus[] = [
  'captured',
  'clarifying',
  'ready',
  'scheduled',
  'focused',
  'done',
  'blocked',
  'dropped',
];

function TaskCard({
  task,
  projects,
  onSelect,
}: {
  task: Task;
  projects: Project[];
  onSelect: (id: string) => void;
}) {
  const project = task.projectId ? projects.find(p => p.id === task.projectId) ?? null : null;
  return (
    <button
      className="w-full text-left"
      onClick={() => onSelect(task.id)}
    >
    <Card
      className="cursor-pointer hover:bg-surface-secondary transition-colors"
    >
      <Card.Content>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Chip
                variant="soft"
                color={STATUS_COLORS[task.status]}
                size="sm"
              >
                {STATUS_LABELS[task.status]}
              </Chip>
              {project && (
                <Chip variant="soft" size="sm">
                  <FolderOpen size={10} className="inline mr-0.5" />
                  {project.title}
                </Chip>
              )}
              {task.dueDate && (
                <span className="text-xs text-muted flex items-center gap-0.5">
                  <CalendarDays size={10} />
                  {task.dueDate}
                </span>
              )}
              {task.focusRank != null && (
                <Chip variant="soft" color="accent" size="sm">
                  #{task.focusRank}
                </Chip>
              )}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
    </button>
  );
}

// ─── Status Grouped View ─────────────────────────────────────────────

function StatusGroupedView({
  tasks,
  projects,
  filter,
  onSelectTask,
}: {
  tasks: Task[];
  projects: Project[];
  filter: { status: TaskStatus | 'all'; project: string | 'all'; dueDate: string | 'all' };
  onSelectTask: (id: string) => void;
}) {
  const filtered = tasks.filter((t) => {
    if (filter.status !== 'all' && t.status !== filter.status) return false;
    if (filter.project !== 'all' && t.projectId !== filter.project) return false;
    if (filter.dueDate === 'overdue' && (!t.dueDate || t.dueDate > '2026-04-09'))
      return false;
    if (filter.dueDate === 'today' && t.dueDate !== '2026-04-09') return false;
    if (filter.dueDate === 'week' && (!t.dueDate || t.dueDate > '2026-04-16'))
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {GROUPED_STATUSES.map((status) => {
        const group = filtered.filter((t) => t.status === status);
        if (group.length === 0 && filter.status !== 'all' && filter.status !== status)
          return null;
        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-2">
              <Chip variant="soft" color={STATUS_COLORS[status]} size="sm">
                {STATUS_LABELS[status]}
              </Chip>
              <span className="text-xs text-muted">{group.length}</span>
            </div>
            {group.length === 0 ? (
              <p className="text-xs text-muted pl-2">暂无任务</p>
            ) : (
              <div className="space-y-2">
                {group.map((t) => (
                  <TaskCard key={t.id} task={t} projects={projects} onSelect={onSelectTask} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Kanban View ─────────────────────────────────────────────────────

function KanbanView({
  tasks,
  projects,
  onSelectTask,
}: {
  tasks: Task[];
  projects: Project[];
  onSelectTask: (id: string) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_STATUSES.map((status) => {
        const column = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className="flex-shrink-0 w-64 bg-surface-secondary rounded-xl p-3"
          >
            <div className="flex items-center gap-2 mb-3">
              <Chip variant="soft" color={STATUS_COLORS[status]} size="sm">
                {STATUS_LABELS[status]}
              </Chip>
              <span className="text-xs text-muted">{column.length}</span>
            </div>
            <div className="space-y-2">
              {column.map((t) => (
                <TaskCard key={t.id} task={t} projects={projects} onSelect={onSelectTask} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TasksPage ───────────────────────────────────────────────────────

export function TasksPage(): ReactElement {
  const { tasks } = useTaskList();
  const { projects } = useProjectList();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterProject, setFilterProject] = useState<string | 'all'>('all');
  const [filterDue, setFilterDue] = useState<string | 'all'>('all');

  const filter = { status: filterStatus, project: filterProject, dueDate: filterDue };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Quick capture */}
        <QuickCaptureInput />

        {/* Quick filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted">筛选：</span>
          {/* Status filter */}
          <select
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
          >
            <option value="all">所有状态</option>
            {GROUPED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {/* Project filter */}
          <select
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="all">所有项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {/* Due date filter */}
          <select
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
            value={filterDue}
            onChange={(e) => setFilterDue(e.target.value)}
          >
            <option value="all">所有日期</option>
            <option value="overdue">已逾期</option>
            <option value="today">今天</option>
            <option value="week">本周</option>
          </select>
        </div>

        {/* Tabs: 按状态 / 看板 */}
        <Tabs>
          <Tabs.List aria-label="任务视图">
            <Tabs.Tab id="grouped">
              <ClipboardList size={14} className="inline mr-1" />
              按状态
            </Tabs.Tab>
            <Tabs.Tab id="kanban">
              <Crosshair size={14} className="inline mr-1" />
              看板
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel id="grouped" className="pt-4">
            <StatusGroupedView
              tasks={tasks}
              projects={projects}
              filter={filter}
              onSelectTask={setSelectedTask}
            />
          </Tabs.Panel>

          <Tabs.Panel id="kanban" className="pt-4">
            <KanbanView tasks={tasks} projects={projects} onSelectTask={setSelectedTask} />
          </Tabs.Panel>
        </Tabs>
      </div>

      {/* Right panel: task detail */}
      {selectedTask && (
        <div className="w-80 border-l border-border bg-surface shrink-0 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="text-xs font-semibold text-muted">任务详情</span>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              onPress={() => setSelectedTask(null)}
            >
              ✕
            </Button>
          </div>
          <TaskDetailPanel taskId={selectedTask} onClose={() => setSelectedTask(null)} />
        </div>
      )}
    </div>
  );
}
