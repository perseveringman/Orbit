import { type ReactElement } from 'react';
import { Separator } from '@heroui/react';
import { DateHeader } from './DateHeader';
import { ProtectedSessionBanner } from './ProtectedSessionBanner';
import { DayNoteEditor } from './DayNoteEditor';
import { TimelineGroup } from './TimelineGroup';
import { SummaryCard } from './SummaryCard';
import { InsightCard } from './InsightCard';
import type { ActionLog, DayNote, Summary, BehaviorInsight } from './mock-data';

interface JournalDayViewProps {
  date: Date;
  isToday: boolean;
  notableEventCount: number;
  protectedMode: boolean;
  protectedStartedAt: Date;
  dayNote?: DayNote;
  actionLogs: ActionLog[];
  summary?: Summary;
  insights: BehaviorInsight[];
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onEndProtected: () => void;
}

function groupLogsByHour(logs: ActionLog[]): Map<string, ActionLog[]> {
  const groups = new Map<string, ActionLog[]>();
  for (const log of logs) {
    const h = new Date(log.startTime).getHours();
    const key = `${String(h).padStart(2, '0')}:00`;
    const arr = groups.get(key) ?? [];
    arr.push(log);
    groups.set(key, arr);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function JournalDayView({
  date,
  isToday,
  notableEventCount,
  protectedMode,
  protectedStartedAt,
  dayNote,
  actionLogs,
  summary,
  insights,
  onPrevDay,
  onNextDay,
  onToday,
  onEndProtected,
}: JournalDayViewProps): ReactElement {
  const hourGroups = groupLogsByHour(actionLogs);
  const now = new Date();
  const currentHour = now.getHours();

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <DateHeader
        date={date}
        isToday={isToday}
        notableEventCount={notableEventCount}
        onPrev={onPrevDay}
        onNext={onNextDay}
        onToday={onToday}
      />

      {protectedMode && (
        <>
          <ProtectedSessionBanner
            active={protectedMode}
            startedAt={protectedStartedAt}
            onEnd={onEndProtected}
          />
          <Separator />
        </>
      )}

      <DayNoteEditor
        initialContent={dayNote?.content}
        initialPrivacy={dayNote?.privacyLevel}
      />

      <Separator />

      {/* Timeline */}
      <div>
        <h3 className="text-sm font-semibold text-muted mb-2">活动时间线</h3>
        {[...hourGroups.entries()].map(([hour, logs]) => {
          const hourNum = parseInt(hour, 10);
          const isRecent = isToday && Math.abs(currentHour - hourNum) <= 2;
          return (
            <TimelineGroup
              key={hour}
              hour={hour}
              logs={logs}
              defaultExpanded={isRecent}
            />
          );
        })}
        {hourGroups.size === 0 && (
          <p className="text-sm text-muted py-4 text-center">今天还没有活动记录</p>
        )}
      </div>

      <Separator />

      <SummaryCard summary={summary} />

      <Separator />

      {/* Insights */}
      <div>
        <h3 className="text-sm font-semibold text-muted mb-2">行为洞察</h3>
        <div className="space-y-3">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
          {insights.length === 0 && (
            <p className="text-sm text-muted py-4 text-center">暂无洞察</p>
          )}
        </div>
      </div>
    </div>
  );
}
