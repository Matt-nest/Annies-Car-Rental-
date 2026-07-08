import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toYMDParts as toYMD, parseYMD } from '../../lib/dates';

/**
 * RangeCalendar — the customer site's two-click range calendar, ported to the
 * admin dashboard so "pick dates" feels identical to the front end. 1st click
 * sets the start date, 2nd sets the end, 3rd restarts. Past dates are disabled.
 *
 * All dates are local 'YYYY-MM-DD' strings (no toISOString — avoids UTC drift),
 * matching the booking API. Token note: the customer version uses `var(--accent)`
 * which the dashboard doesn't define — mapped to `var(--accent-color)` here.
 */

export { toYMD, parseYMD };
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const prettyDate = (s) => { if (!s) return ''; const d = parseYMD(s); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };

export default function RangeCalendar({ startDate, endDate, onSelect }) {
  const today = new Date();
  const todayYMD = toYMD(today.getFullYear(), today.getMonth(), today.getDate());
  const anchor = startDate ? parseYMD(startDate) : today;
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const canGoPrev = view.y > today.getFullYear() || (view.y === today.getFullYear() && view.m > today.getMonth());
  const goPrev = () => { if (!canGoPrev) return; setView(v => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })); };
  const goNext = () => setView(v => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button" onClick={goPrev} disabled={!canGoPrev}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[var(--bg-card-hover)] cursor-pointer"
          style={{ color: 'var(--text-secondary)' }} aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{MONTHS[view.m]} {view.y}</span>
        <button
          type="button" onClick={goNext}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-[var(--bg-card-hover)] cursor-pointer"
          style={{ color: 'var(--text-secondary)' }} aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wider py-1" style={{ color: 'var(--text-tertiary)' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const ymd = toYMD(view.y, view.m, day);
          const disabled = ymd < todayYMD;
          const isStart = ymd === startDate;
          const isEnd = ymd === endDate;
          const inRange = !!startDate && !!endDate && ymd > startDate && ymd < endDate;
          const isEdge = isStart || isEnd;
          return (
            <div
              key={ymd}
              className="flex justify-center"
              style={inRange ? { backgroundColor: 'color-mix(in srgb, var(--accent-color) 14%, transparent)' } : undefined}
            >
              <button
                type="button" disabled={disabled} onClick={() => onSelect(ymd)}
                className={`w-9 h-9 text-[13px] flex items-center justify-center rounded-full transition-all duration-200 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                style={{
                  backgroundColor: isEdge ? 'var(--accent-color)' : 'transparent',
                  color: disabled ? 'var(--text-tertiary)' : isEdge ? 'var(--accent-fg)' : 'var(--text-primary)',
                  opacity: disabled ? 0.3 : 1,
                  fontWeight: isEdge ? 600 : 400,
                  boxShadow: isEdge ? '0 4px 14px color-mix(in srgb, var(--accent-color) 45%, transparent)' : 'none',
                }}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
