import { useState, useMemo, type ReactElement } from 'react';
import { Separator } from '@heroui/react';
import { JournalDayView } from './JournalDayView';
import { CalendarMini } from './CalendarMini';
import {
  TODAY,
  dayNotes,
  actionLogs,
  summaries,
  insights,
} from './mock-data';

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function JournalPage(): ReactElement {
  const todayDate = useMemo(() => new Date(TODAY + 'T00:00:00'), []);
  const [currentDate, setCurrentDate] = useState(todayDate);
  const [protectedMode, setProtectedMode] = useState(false);
  const [protectedStartedAt] = useState(() => new Date());

  const isToday = isSameDay(currentDate, todayDate);

  const navigate = (days: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setCurrentDate(d);
  };

  const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const dayNote = dayNotes.find((n) => n.date === dateStr);
  const daySummary = summaries.find((s) => s.scope === 'day' && s.date === dateStr);
  const weekSummary = summaries.find((s) => s.scope === 'week');
  const notableCount = actionLogs.filter((l) => l.isMajor).length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main scrollable area */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        <JournalDayView
          date={currentDate}
          isToday={isToday}
          notableEventCount={notableCount}
          protectedMode={protectedMode}
          protectedStartedAt={protectedStartedAt}
          dayNote={dayNote}
          actionLogs={isToday ? actionLogs : []}
          summary={daySummary}
          insights={isToday ? insights : []}
          onPrevDay={() => navigate(-1)}
          onNextDay={() => navigate(1)}
          onToday={() => setCurrentDate(todayDate)}
          onEndProtected={() => setProtectedMode(false)}
        />
      </div>

      {/* Right panel */}
      <aside className="w-72 border-l border-border bg-surface shrink-0 overflow-y-auto">
        <CalendarMini
          selectedDate={currentDate}
          onSelectDate={setCurrentDate}
        />

        <Separator />

        {/* Week overview */}
        <div className="p-3">
          <h3 className="text-sm font-semibold text-foreground mb-2">本周概览</h3>
          {weekSummary ? (
            <div className="text-xs text-muted whitespace-pre-wrap leading-relaxed">
              {weekSummary.body}
            </div>
          ) : (
            <p className="text-xs text-muted">暂无周报</p>
          )}
        </div>
      </aside>
    </div>
  );
}
