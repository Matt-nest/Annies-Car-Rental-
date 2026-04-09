import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { SkeletonChartCard } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday } from 'date-fns';

const EASE = [0.25, 1, 0.5, 1];

const STATUS_COLORS = {
  pending_approval: '#f59e0b',
  approved:         '#63b3ed',
  confirmed:        '#22c55e',
  active:           '#22c55e',
  returned:         '#a78bfa',
  completed:        '#a8a29e',
  blocked:          '#737373',
};

export default function CalendarPage() {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [month, setMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [vs, bs] = await Promise.all([
          api.getVehicles(),
          api.getBookings({
            from: format(startOfMonth(month), 'yyyy-MM-dd'),
            to: format(endOfMonth(month), 'yyyy-MM-dd'),
            limit: 200,
          }),
        ]);
        setVehicles(vs);
        setBookings(bs.data || bs);
        const blockedResults = await Promise.all(vs.map(v => api.getBlockedDates(v.id).catch(() => [])));
        setBlocked(blockedResults.flat());
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [month]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  function getBookingsForVehicle(vehicleId) {
    return bookings.filter(b => b.vehicle_id === vehicleId && !['declined', 'cancelled'].includes(b.status));
  }
  function getBlockedForVehicle(vehicleId) {
    return blocked.filter(b => b.vehicle_id === vehicleId);
  }
  function isCovered(booking, day) {
    const d = format(day, 'yyyy-MM-dd');
    return d >= booking.pickup_date && d <= booking.return_date;
  }
  function isBlockedDay(blockedDates, day) {
    const d = format(day, 'yyyy-MM-dd');
    return blockedDates.some(b => d >= b.start_date && d <= b.end_date);
  }

  return (
    <div className="p-6 lg:p-8 max-w-full space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>Fleet Calendar</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Vehicle availability at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(subMonths(month, 1))} className="btn-ghost p-2.5 rounded-xl" style={{ minWidth: 44, minHeight: 44 }}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold min-w-[140px] text-center tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {format(month, 'MMMM yyyy')}
          </span>
          <button onClick={() => setMonth(addMonths(month, 1))} className="btn-ghost p-2.5 rounded-xl" style={{ minWidth: 44, minHeight: 44 }}>
            <ChevronRight size={18} />
          </button>
          <button onClick={() => setMonth(new Date())} className="btn-secondary text-xs py-2 px-3">Today</button>
        </div>
      </motion.div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).slice(0, 6).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: c }} />
            <span className="text-[10px] uppercase tracking-wider font-semibold capitalize" style={{ color: 'var(--text-tertiary)' }}>{s.replace('_', ' ')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{
            backgroundColor: 'var(--bg-card-hover)',
            backgroundImage: 'repeating-linear-gradient(45deg, var(--text-tertiary) 0, var(--text-tertiary) 1px, transparent 0, transparent 50%)',
            backgroundSize: '4px 4px',
          }} />
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Blocked</span>
        </div>
      </div>

      {/* Gantt */}
      {loading ? (
        <SkeletonChartCard height={400} />
      ) : vehicles.length === 0 ? (
        <EmptyState icon={Calendar} title="No vehicles" description="Add vehicles to see the fleet calendar." />
      ) : (
        <div className="card overflow-x-auto glass-scroll">
          <div className="min-w-[800px]">
            {/* Day headers */}
            <div className="flex" style={{ paddingLeft: '170px', borderBottom: '1px solid var(--border-subtle)' }}>
              {days.map(day => (
                <div
                  key={day.toISOString()}
                  className="flex-1 text-center py-2.5 min-w-[28px]"
                  style={{
                    fontSize: '10px',
                    fontWeight: isToday(day) ? 700 : 600,
                    color: isToday(day) ? 'var(--accent-color)' : 'var(--text-tertiary)',
                    backgroundColor: isToday(day) ? 'var(--accent-glow)' : 'transparent',
                    borderRight: '1px solid var(--border-subtle)',
                  }}
                >
                  {format(day, 'd')}
                </div>
              ))}
            </div>

            {/* Vehicle rows */}
            {vehicles.map(v => {
              const vBookings = getBookingsForVehicle(v.id);
              const vBlocked = getBlockedForVehicle(v.id);
              return (
                <div
                  key={v.id}
                  className="flex min-h-[44px] transition-colors"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Vehicle label */}
                  <div
                    className="w-[170px] shrink-0 px-4 py-2.5 flex flex-col justify-center"
                    style={{ borderRight: '1px solid var(--border-subtle)' }}
                  >
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{v.year} {v.make} {v.model}</p>
                    <p className="text-[10px] mono-code" style={{ color: 'var(--text-tertiary)' }}>{v.vehicle_code}</p>
                  </div>

                  {/* Day cells */}
                  <div className="flex flex-1">
                    {days.map(day => {
                      const booking = vBookings.find(b => isCovered(b, day));
                      const blockedDay = !booking && isBlockedDay(vBlocked, day);
                      const isStart = booking && format(day, 'yyyy-MM-dd') === booking.pickup_date;

                      return (
                        <div
                          key={day.toISOString()}
                          className="flex-1 min-w-[28px] relative"
                          style={{
                            borderRight: '1px solid var(--border-subtle)',
                            backgroundColor: booking
                              ? `${STATUS_COLORS[booking.status] || '#a8a29e'}18`
                              : isToday(day)
                              ? 'var(--accent-glow)'
                              : 'transparent',
                            backgroundImage: blockedDay
                              ? 'repeating-linear-gradient(45deg, var(--text-tertiary) 0, var(--text-tertiary) 1px, transparent 0, transparent 50%)'
                              : undefined,
                            backgroundSize: blockedDay ? '6px 6px' : undefined,
                            opacity: blockedDay ? 0.3 : 1,
                          }}
                          onClick={() => booking && navigate(`/bookings/${booking.id}`)}
                          title={blockedDay ? 'Blocked' : booking ? `${booking.booking_code} — ${booking.customers?.first_name}` : undefined}
                        >
                          {isStart && (
                            <div
                              className="absolute inset-y-1 left-0.5 right-0 rounded flex items-center px-1.5 cursor-pointer overflow-hidden"
                              style={{ backgroundColor: `${STATUS_COLORS[booking.status] || '#a8a29e'}cc` }}
                            >
                              <span className="text-white text-[9px] font-bold truncate">
                                {booking.customers?.first_name || booking.booking_code}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
