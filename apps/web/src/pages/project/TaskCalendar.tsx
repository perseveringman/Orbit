import type { ReactElement } from 'react';
import { Card } from '@heroui/react';
import { MoreHorizontal } from 'lucide-react';
import { CALENDAR_WEEK, TODAY, type CalendarTask } from './mock-data';

// ─── Helpers ─────────────────────────────────────────────────────────

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function formatDate(iso: string): { day: number; month: string; weekday: string } {
  const d = new Date(iso + 'T00:00:00');
  return {
    day: d.getDate(),
    month: `${d.getMonth() + 1}月`,
    weekday: DAY_NAMES[d.getDay()],
  };
}

function shortLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function colIndex(date: string): number {
  return CALENDAR_WEEK.indexOf(date);
}

function colSpan(task: CalendarTask): number {
  if (!task.endDate) return 1;
  const start = colIndex(task.date);
  const end = colIndex(task.endDate);
  if (start < 0) return 1;
  return end >= 0 ? end - start + 1 : 1;
}

// ─── Task Block ──────────────────────────────────────────────────────

function CalendarTaskBlock({ task }: { task: CalendarTask }): ReactElement {
  const start = colIndex(task.date);
  if (start < 0) return <></>;

  const span = colSpan(task);

  const baseStyle: React.CSSProperties = {
    gridColumn: `${start + 1} / span ${span}`,
  };

  let className =
    'rounded-lg px-3 py-2 text-xs font-medium truncate ';

  if (task.variant === 'filled') {
    className += 'text-white';
    baseStyle.backgroundColor = task.color;
  } else if (task.variant === 'outlined') {
    className += 'border-2';
    baseStyle.borderColor = task.color;
    baseStyle.color = task.color;
  } else {
    className += 'text-foreground';
    baseStyle.backgroundColor = task.color + '18';
    baseStyle.color = task.color;
  }

  return (
    <div className={className} style={baseStyle}>
      <span className="text-[10px] opacity-70 mr-1">{shortLabel(task.date)}</span>
      {task.title}
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────

export function TaskCalendar({
  tasks,
}: {
  tasks: CalendarTask[];
}): ReactElement {
  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-foreground">任务日历</span>
        <button className="text-muted hover:text-foreground" aria-label="更多">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Week header */}
      <div
        className="grid mb-3 text-center"
        style={{ gridTemplateColumns: `repeat(${CALENDAR_WEEK.length}, 1fr)` }}
      >
        {CALENDAR_WEEK.map((date) => {
          const { day, month, weekday } = formatDate(date);
          const isToday = date === TODAY;
          return (
            <div key={date} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-muted">{weekday}</span>
              <span className="text-[10px] text-muted">{month}</span>
              <span
                className={`text-sm font-semibold w-8 h-8 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-foreground text-background'
                    : 'text-foreground'
                }`}
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>

      {/* Task rows */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${CALENDAR_WEEK.length}, 1fr)` }}
      >
        {tasks.map((task) => (
          <CalendarTaskBlock key={task.id} task={task} />
        ))}
      </div>
    </Card>
  );
}
