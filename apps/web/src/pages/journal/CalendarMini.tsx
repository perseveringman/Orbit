import { useState, type ReactElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@heroui/react';
import { generateCalendarData } from './mock-data';

const WEEKDAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六'];

interface CalendarMiniProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function CalendarMini({ selectedDate, onSelectDate }: CalendarMiniProps): ReactElement {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const calendarData = generateCalendarData(viewYear, viewMonth);
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  const monthLabel = `${viewYear} 年 ${viewMonth + 1} 月`;

  return (
    <div className="p-3">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" isIconOnly size="sm" onPress={prevMonth}>
          <ChevronLeft size={14} />
        </Button>
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <Button variant="ghost" isIconOnly size="sm" onPress={nextMonth}>
          <ChevronRight size={14} />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_HEADERS.map((day) => (
          <div key={day} className="text-center text-xs text-muted font-medium py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for first-day offset */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}
        {calendarData.map((day) => {
          const dayNum = new Date(day.date).getDate();
          const isSelected = day.date === selectedStr;
          const isToday = day.date === todayStr;

          return (
            <button
              key={day.date}
              className={`relative flex flex-col items-center justify-center h-8 rounded-lg text-xs transition-colors ${
                isSelected
                  ? 'bg-accent text-white font-semibold'
                  : isToday
                    ? 'bg-accent-soft text-accent font-semibold'
                    : 'text-foreground hover:bg-surface-secondary'
              }`}
              onClick={() => onSelectDate(new Date(day.date + 'T00:00:00'))}
            >
              {dayNum}
              {/* Dot indicators */}
              <div className="flex gap-0.5 absolute -bottom-0.5">
                {day.hasEntry && (
                  <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-accent'}`} />
                )}
                {day.hasInsight && (
                  <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-warning'}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
