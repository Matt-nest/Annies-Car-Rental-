import { useEffect, useState, useCallback, useRef } from 'react';
import { BarChart2 } from 'lucide-react';
import { format, subDays, getDay, startOfWeek, addDays } from 'date-fns';
import { api } from '../../../api/client';
import WidgetWrapper from '../WidgetWrapper';

// ─── Color scale — 5 stops from bg to bright gold ─────────────────────────────
function heatColor(revenue, maxRevenue) {
  if (!revenue || revenue <= 0) return 'var(--bg-card-hover)';
  const t = Math.min(revenue / maxRevenue, 1);
  if (t < 0.15) return 'rgba(212,175,55,0.18)';
  if (t < 0.35) return 'rgba(212,175,55,0.36)';
  if (t < 0.55) return 'rgba(212,175,55,0.55)';
  if (t < 0.75) return 'rgba(212,175,55,0.74)';
  return 'rgba(212,175,55,0.95)';
}

// ─── Build the 52-week grid data structure ─────────────────────────────────────
function buildGrid(revenueByDate) {
  const today = new Date();
  const start = subDays(today, 364); // ~52 weeks back
  const weekStart = startOfWeek(start, { weekStartsOn: 0 }); // Sun

  const weeks = [];
  let current = weekStart;

  while (current <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(current, d);
      const key = format(day, 'yyyy-MM-dd');
      week.push({
        date: day,
        key,
        revenue: revenueByDate[key] || 0,
        isFuture: day > today,
      });
    }
    weeks.push(week);
    current = addDays(current, 7);
  }

  return weeks;
}

// ─── Month labels ─────────────────────────────────────────────────────────────
function getMonthLabels(weeks) {
  const labels = [];
  let lastMonth = -1;

  weeks.forEach((week, wi) => {
    const firstDay = week[0];
    const month = firstDay.date.getMonth();
    if (month !== lastMonth) {
      labels.push({ weekIndex: wi, label: format(firstDay.date, 'MMM') });
      lastMonth = month;
    }
  });

  return labels;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function HeatCell({ day, cellSize }) {
  const [showTip, setShowTip] = useState(false);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  if (day.isFuture) {
    return <div style={{ width: cellSize, height: cellSize, borderRadius: 2, backgroundColor: 'transparent' }} />;
  }

  return (
    <div
      ref={ref}
      style={{
        width: cellSize,
        height: cellSize,
        borderRadius: 2,
        backgroundColor: day._color,
        cursor: day.revenue > 0 ? 'pointer' : 'default',
        position: 'relative',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => {
        setShowTip(true);
        const rect = e.currentTarget.getBoundingClientRect();
        setTipPos({ x: rect.left, y: rect.top });
      }}
      onMouseLeave={() => setShowTip(false)}
    >
      {showTip && (
        <div
          className="glass-tooltip"
          style={{
            position: 'fixed',
            left: tipPos.x + cellSize / 2,
            top: tipPos.y - 4,
            transform: 'translate(-50%, -100%)',
            zIndex: 50,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {format(day.date, 'MMM d, yyyy')}
          </p>
          <p className="text-xs" style={{ color: day.revenue > 0 ? 'var(--accent-color)' : 'var(--text-tertiary)' }}>
            {day.revenue > 0 ? `$${day.revenue.toLocaleString()}` : 'No revenue'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────
export default function RevenueHeatmapWidget() {
  const [revenueByDate, setRevenueByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.getRevenue({ period: 'daily', days: 365 })
      .then((rev) => {
        const map = {};
        if (Array.isArray(rev)) {
          for (const r of rev) {
            if (r.date) map[r.date] = Number(r.total || r.amount || 0);
          }
        }
        setRevenueByDate(map);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Scroll to the right (current week) after mount
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [loading]);

  const maxRevenue = Math.max(...Object.values(revenueByDate), 1);
  const weeks = buildGrid(revenueByDate);
  const monthLabels = getMonthLabels(weeks);

  // Annotate cells with computed color
  const coloredWeeks = weeks.map((week) =>
    week.map((day) => ({ ...day, _color: heatColor(day.revenue, maxRevenue) }))
  );

  const CELL = 13; // px per cell
  const GAP = 2;

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <WidgetWrapper
      title="Revenue Heatmap — past 12 months"
      icon={BarChart2}
      loading={loading}
      error={error}
      onRetry={load}
      skeletonType="chart"
      noPadding
    >
      <div className="px-5 py-4 space-y-3">
        {/* Scrollable heatmap */}
        <div className="flex gap-2">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[2px] pt-[18px] shrink-0">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="flex items-center justify-end"
                style={{ height: CELL, fontSize: 9, color: 'var(--text-tertiary)', width: 10 }}>
                {i % 2 === 1 ? d : ''}
              </div>
            ))}
          </div>

          {/* Grid container — scrollable */}
          <div
            ref={scrollRef}
            className="overflow-x-auto no-scrollbar flex-1"
          >
            {/* Month labels row */}
            <div className="flex mb-1" style={{ gap: GAP }}>
              {coloredWeeks.map((week, wi) => {
                const monthLabel = monthLabels.find((m) => m.weekIndex === wi);
                return (
                  <div
                    key={wi}
                    style={{ width: CELL, fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0, height: 14, display: 'flex', alignItems: 'center' }}
                  >
                    {monthLabel?.label || ''}
                  </div>
                );
              })}
            </div>

            {/* Cell grid */}
            <div className="flex" style={{ gap: GAP }}>
              {coloredWeeks.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: GAP, flexShrink: 0 }}>
                  {week.map((day, di) => (
                    <HeatCell key={di} day={day} cellSize={CELL} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Less</span>
          {[0.1, 0.3, 0.5, 0.7, 0.95].map((t, i) => (
            <div key={i} style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: `rgba(212,175,55,${t})` }} />
          ))}
          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>More</span>
          <span className="ml-auto text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            Peak: ${maxRevenue.toLocaleString()}/day
          </span>
        </div>
      </div>
    </WidgetWrapper>
  );
}
