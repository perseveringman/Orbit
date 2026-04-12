import { useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TimelineRow } from './TimelineRow';
import type { ActionLog } from './mock-data';

interface TimelineGroupProps {
  hour: string;
  logs: ActionLog[];
  defaultExpanded?: boolean;
}

export function TimelineGroup({
  hour,
  logs,
  defaultExpanded = true,
}: TimelineGroupProps): ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const totalMinutes = logs.reduce((s, l) => s + l.durationMinutes, 0);

  return (
    <div className="mb-2">
      <button
        className="flex items-center gap-2 w-full py-1.5 px-1 text-left hover:bg-surface-secondary rounded-lg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
        <span className="text-sm font-semibold text-foreground">{hour}</span>
        <span className="text-xs text-muted ml-auto">
          {logs.length} 条 · {totalMinutes} 分钟
        </span>
      </button>
      {expanded && (
        <div className="ml-5 border-l border-border pl-3">
          {logs.map((log) => (
            <TimelineRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}
