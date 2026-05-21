/**
 * Relative-time formatter — matches the iOS Messages / Mail recency pattern.
 *
 *   < 60 s          → "Just now"
 *   < 60 min        → "5 min ago"
 *   today           → "Today at 7:11 PM"
 *   yesterday       → "Yesterday at 7:11 PM"
 *   < 7 days        → "Monday at 7:11 PM"
 *   < 365 days      → "Mar 15"
 *   else            → "Mar 15, 2025"
 *
 * Uses `Intl.RelativeTimeFormat` + `Intl.DateTimeFormat` so locale + timezone
 * follow the user automatically. Pass a Date, ISO string, or epoch ms.
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

function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function formatRelativeTime(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;

  // Future or just-now bucket
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

/** Short variant for tight contexts (message timestamps, list rows).
 *  "Now" · "5m" · "3h" · "Yesterday" · "Mon" · "Mar 15" · "Mar 15, 2024" */
export function formatRelativeTimeShort(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;

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
