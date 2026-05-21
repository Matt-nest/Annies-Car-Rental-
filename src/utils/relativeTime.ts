/**
 * Relative-time formatter for the customer portal — matches iOS Messages /
 * Mail recency conventions. Locale + timezone follow the user via Intl.
 *
 *   < 60 s          → "Just now"
 *   < 60 min        → "5 min ago"
 *   today           → "Today at 7:11 PM"
 *   yesterday       → "Yesterday at 7:11 PM"
 *   < 7 days        → "Monday at 7:11 PM"
 *   same year       → "Mar 15"
 *   else            → "Mar 15, 2024"
 */
const dayMs = 24 * 60 * 60 * 1000;
const minuteMs = 60 * 1000;

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});
const sameYearFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const fullDateFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long' });

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function formatRelativeTime(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  if (diffMs < minuteMs) return 'Just now';
  if (diffMs < 60 * minuteMs) {
    const mins = Math.floor(diffMs / minuteMs);
    return `${mins} min ago`;
  }

  const todayStart = startOfDay(now).getTime();
  const dStart = startOfDay(d).getTime();
  const dayDiff = Math.round((todayStart - dStart) / dayMs);

  if (dayDiff === 0) return `Today at ${timeFmt.format(d)}`;
  if (dayDiff === 1) return `Yesterday at ${timeFmt.format(d)}`;
  if (dayDiff > 1 && dayDiff < 7) return `${weekdayFmt.format(d)} at ${timeFmt.format(d)}`;

  if (d.getFullYear() === now.getFullYear()) return sameYearFmt.format(d);
  return fullDateFmt.format(d);
}

export function formatRelativeTimeShort(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  if (diffMs < minuteMs) return 'Now';
  if (diffMs < 60 * minuteMs) return `${Math.floor(diffMs / minuteMs)}m`;
  if (diffMs < 24 * 60 * minuteMs) return `${Math.floor(diffMs / (60 * minuteMs))}h`;

  const todayStart = startOfDay(now).getTime();
  const dStart = startOfDay(d).getTime();
  const dayDiff = Math.round((todayStart - dStart) / dayMs);

  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff > 1 && dayDiff < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
  }
  if (d.getFullYear() === now.getFullYear()) return sameYearFmt.format(d);
  return fullDateFmt.format(d);
}
