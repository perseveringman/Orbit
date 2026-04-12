import { type ReactElement } from 'react';
import {
  BookOpen, ClipboardList, FileEdit, Microscope, BookText, Settings,
} from 'lucide-react';
import { Chip } from '@heroui/react';
import type { Surface, ActionLog } from './mock-data';

const SURFACE_CONFIG: Record<Surface, { icon: typeof BookOpen; color: string; bg: string }> = {
  reader:   { icon: BookOpen,      color: 'text-blue-600',   bg: 'bg-blue-100' },
  task:     { icon: ClipboardList, color: 'text-green-600',  bg: 'bg-green-100' },
  writing:  { icon: FileEdit,      color: 'text-purple-600', bg: 'bg-purple-100' },
  research: { icon: Microscope,    color: 'text-orange-600', bg: 'bg-orange-100' },
  journal:  { icon: BookText,      color: 'text-yellow-600', bg: 'bg-yellow-100' },
  app:      { icon: Settings,      color: 'text-gray-600',   bg: 'bg-gray-100' },
};

interface TimelineRowProps {
  log: ActionLog;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

export function TimelineRow({ log }: TimelineRowProps): ReactElement {
  const config = SURFACE_CONFIG[log.surface];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-2 px-1 rounded-lg hover:bg-surface-secondary transition-colors group">
      {/* Icon */}
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${config.bg}`}>
        <Icon size={16} className={config.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${log.isMajor ? 'font-semibold text-foreground' : 'text-foreground'}`}>
            {log.title}
          </span>
          {log.aggregatedCount && (
            <Chip variant="soft" size="sm" color="default">
              +{log.aggregatedCount} 类似操作
            </Chip>
          )}
        </div>
        <p className="text-xs text-muted mt-0.5">{log.subtitle}</p>
        {log.relatedObjects.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {log.relatedObjects.map((obj) => (
              <Chip key={obj} variant="soft" size="sm">{obj}</Chip>
            ))}
          </div>
        )}
      </div>

      {/* Time */}
      <div className="text-right shrink-0">
        <span className="text-xs text-muted">
          {formatTime(log.startTime)} – {formatTime(log.endTime)}
        </span>
        <p className="text-xs text-muted mt-0.5">{formatDuration(log.durationMinutes)}</p>
      </div>
    </div>
  );
}
