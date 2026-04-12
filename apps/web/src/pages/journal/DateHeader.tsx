import { type ReactElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Chip } from '@heroui/react';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

interface DateHeaderProps {
  date: Date;
  isToday: boolean;
  notableEventCount: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function DateHeader({
  date,
  isToday,
  notableEventCount,
  onPrev,
  onNext,
  onToday,
}: DateHeaderProps): ReactElement {
  const weekday = WEEKDAYS[date.getDay()];
  const dateStr = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;

  return (
    <div className="flex items-center justify-between py-3 sticky top-0 z-10 bg-background">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" isIconOnly size="sm" onPress={onPrev}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="ghost" isIconOnly size="sm" onPress={onNext}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-foreground">{weekday}</span>
          <span className="text-sm text-muted">{dateStr}</span>
        </div>

        {isToday && (
          <Chip variant="soft" color="accent" size="sm">今天</Chip>
        )}

        {notableEventCount > 0 && (
          <Chip variant="soft" color="default" size="sm">
            {notableEventCount} 条重要事件
          </Chip>
        )}
      </div>

      {!isToday && (
        <Button variant="secondary" size="sm" onPress={onToday}>
          今天
        </Button>
      )}
    </div>
  );
}
