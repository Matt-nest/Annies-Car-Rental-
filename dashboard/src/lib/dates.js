import { format, isToday, isTomorrow, isYesterday } from 'date-fns';

const pad = (n) => String(n).padStart(2, '0');

/** Build YYYY-MM-DD from local calendar parts (month is 0-indexed). */
export function toYMDParts(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Today's date as YYYY-MM-DD in local time (not UTC). */
export function localTodayYMD() {
  const t = new Date();
  return toYMDParts(t.getFullYear(), t.getMonth(), t.getDate());
}

/**
 * Parse a YYYY-MM-DD (or ISO datetime) string as a local calendar date.
 * Avoids the UTC off-by-one bug from `new Date('2026-07-08')`.
 */
export function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).split('T')[0];
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Alias used by RangeCalendar and the booking modal. */
export const parseYMD = parseDateOnly;

/** Format a date-only DB field for display. */
export function formatDateOnly(dateStr, pattern = 'MMM d, yyyy') {
  const d = parseDateOnly(dateStr);
  if (!d) return '—';
  return format(d, pattern);
}

/** Today / Tomorrow / Yesterday labels for schedule lists. */
export function formatDateOnlyRelative(dateStr) {
  const d = parseDateOnly(dateStr);
  if (!d) return '—';
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}
