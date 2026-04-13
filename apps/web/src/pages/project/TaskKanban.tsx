import type { ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { STATUS_CONFIG, type TaskItem, type TaskStatus } from './mock-data';
import { TaskCard } from './TaskCard';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'completed'];

export interface TaskKanbanProps {
  tasks: TaskItem[];
  onAddTask?: (status: TaskStatus) => void;
}

export function TaskKanban({ tasks, onAddTask }: TaskKanbanProps): ReactElement {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        const config = STATUS_CONFIG[status];

        return (
          <div
            key={status}
            className="bg-content2 rounded-xl p-3 min-h-[200px]"
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-sm font-semibold text-foreground">
                  {config.label}
                </span>
                <span className="text-xs text-muted bg-content3 rounded-full px-2 py-0.5">
                  {columnTasks.length}
                </span>
              </div>
              <button
                className="text-muted hover:text-foreground"
                aria-label={`添加${config.label}任务`}
                onClick={() => onAddTask?.(status)}
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
