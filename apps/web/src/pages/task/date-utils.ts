const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;

export function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatChineseDay(date: Date): string {
  return `${toDayKey(date)} · 星期${WEEKDAY_LABELS[date.getDay()]}`;
}
