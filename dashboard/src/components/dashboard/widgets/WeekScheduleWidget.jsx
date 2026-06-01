import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { api } from '../../../api/client';
import { cachedQuery } from '../../../lib/queryCache';
import WidgetWrapper from '../WidgetWrapper';

const EASE = [0.25, 1, 0.5, 1];

export default function WeekScheduleWidget() {
  const [upcoming, setUpcoming] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    cachedQuery('upcoming', () => api.getUpcoming())
      .then(setUpcoming)
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const pickups = upcoming?.pickups || [];
  const returns = upcoming?.returns || [];

  const byPickup = {}, byReturn = {};
  for (const b of pickups) {
    if (!byPickup[b.pickup_date]) byPickup[b.pickup_date] = [];
    byPickup[b.pickup_date].push(b);
  }
  for (const b of returns) {
    if (!byReturn[b.return_date]) byReturn[b.return_date] = [];
    byReturn[b.return_date].push(b);
  }

  const selKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selAll = selKey ? [
    ...(byPickup[selKey] || []).map((b) => ({ ...b, _type: 'pickup' })),
    ...(byReturn[selKey] || []).map((b) => ({ ...b, _type: 'return' })),
  ] : [];

  const headerAction = (
    <button
      onClick={() => navigate('/calendar')}
      className="text-xs font-medium transition-opacity hover:opacity-70"
      style={{ color: 'var(--accent-color)' }}
    >
      Calendar →
    </button>
  );

  return (
    <WidgetWrapper
      title="Next 7 Days"
      icon={Calendar}
      loading={loading}
      error={error}
      onRetry={load}
      skeletonType="list"
      headerAction={headerAction}
      noPadding
    >
      {/* Day strip */}
      <div className="flex px-5 py-3 gap-2 overflow-x-auto no-scrollbar">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const pc = byPickup[key]?.length || 0;
          const rc = byReturn[key]?.length || 0;
          const isToday = isSameDay(day, today);
          const isSel = selectedDay && isSameDay(day, selectedDay);
          const hasAny = pc + rc > 0;

          return (
            <button
              key={key}
              onClick={() => setSelectedDay((d) => (d && isSameDay(d, day)) ? null : (hasAny ? day : null))}
              className="flex flex-col items-center gap-1.5 py-2.5 px-3 rounded-xl min-w-[52px] transition-all duration-200"
              style={{
                backgroundColor: isSel ? 'var(--accent-color)' : isToday ? 'var(--accent-glow)' : hasAny ? 'var(--bg-card-hover)' : 'transparent',
                border: isToday && !isSel ? '1px solid var(--accent-color)' : '1px solid transparent',
                opacity: !hasAny ? 0.4 : 1,
                cursor: hasAny ? 'pointer' : 'default',
                minHeight: 64,
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: isSel ? 'var(--accent-fg)' : 'var(--text-tertiary)' }}>
                {format(day, 'EEE')}
              </span>
              <span className="text-sm font-bold"
                style={{ color: isSel ? 'var(--accent-fg)' : isToday ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                {format(day, 'd')}
              </span>
              <div className="flex gap-0.5">
                {pc > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.8)' : '#63b3ed' }} />}
                {rc > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.6)' : '#a78bfa' }} />}
                {!hasAny && <span className="w-1.5 h-1.5" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-5 pb-3 flex items-center gap-4">
        {[['#63b3ed', 'Check-In'], ['#a78bfa', 'Check-Out']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
            {l}
          </span>
        ))}
      </div>

      {/* Selected day detail */}
      <AnimatePresence>
        {selectedDay && selAll.length > 0 && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <div className="px-5 py-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
              <p className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {format(selectedDay, 'EEEE, MMMM d')}
              </p>
              <div className="space-y-2">
                {selAll.map((b) => (
                  <div
                    key={`${b._type}-${b.id}`}
                    onClick={() => navigate(`/bookings/${b.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/bookings/${b.id}`)}
                    className="flex items-center gap-2.5 py-1 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
                    style={{ minHeight: 36 }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: b._type === 'pickup' ? '#63b3ed' : '#a78bfa' }} />
                    <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {b._type === 'pickup' ? b.pickup_time?.slice(0, 5) : b.return_time?.slice(0, 5)}
                    </span>
                    <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                      {b.customers?.first_name} {b.customers?.last_name}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {b.vehicles?.make} {b.vehicles?.model}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </WidgetWrapper>
  );
}
