import type { LocaleCode } from './messages';

export function formatDate(date: Date, locale: LocaleCode, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatRelativeTime(date: Date, locale: LocaleCode): string {
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absDiffMs = Math.abs(diffMs);

  const units: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
    { unit: 'year', ms: 365.25 * 24 * 60 * 60 * 1000 },
    { unit: 'month', ms: 30.44 * 24 * 60 * 60 * 1000 },
    { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
    { unit: 'day', ms: 24 * 60 * 60 * 1000 },
    { unit: 'hour', ms: 60 * 60 * 1000 },
    { unit: 'minute', ms: 60 * 1000 },
    { unit: 'second', ms: 1000 }
  ];

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const { unit, ms } of units) {
    if (absDiffMs >= ms) {
      const value = Math.round(diffMs / ms);
      return rtf.format(value, unit);
    }
  }

  return rtf.format(0, 'second');
}

export function formatNumber(num: number, locale: LocaleCode, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(num);
}

export function formatCompactNumber(num: number, locale: LocaleCode): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(num);
}

export function formatPercent(num: number, locale: LocaleCode): string {
  return new Intl.NumberFormat(locale, { style: 'percent' }).format(num);
}

export function formatDateRange(start: Date, end: Date, locale: LocaleCode): string {
  const fmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  return fmt.formatRange(start, end);
}
