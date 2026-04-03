import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday } from 'date-fns';

const STATUS_COLORS = {
  pending_approval: '#f59e0b',
  approved:         '#3b82f6',
  confirmed:        '#1d4ed8',
  active:           '#16a34a',
  returned:         '#9333ea',
  completed:        '#6b7280',
  blocked:          '#d1d5db',
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
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [month]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  function getBookingsForVehicle(vehicleId) {
    return bookings.filter(b => b.vehicle_id === vehicleId && !['declined', 'cancelled'].includes(b.status));
  }

  function isCovered(booking, day) {
    const d = format(day, 'yyyy-MM-dd');
    return d >= booking.pickup_date && d <= booking.return_date;
  }

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="p-4 sm:p-6 max-w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Fleet Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(subMonths(month, 1))} className="btn-ghost p-2">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-stone-700 min-w-[120px] text-center">
            {format(month, 'MMMM yyyy')}
          </span>
          <button onClick={() => setMonth(addMonths(month, 1))} className="btn-ghost p-2">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => setMonth(new Date())} className="btn-secondary text-xs py-1.5 px-3">Today</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).slice(0, 6).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-stone-600">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
            <span className="capitalize">{s.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Gantt grid */}
      <div className="card overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="flex border-b border-stone-100" style={{ paddingLeft: '160px' }}>
            {days.map(day => (
              <div
                key={day.toISOString()}
                className={`flex-1 text-center py-2 text-xs font-medium border-r border-stone-50 min-w-[28px]
                  ${isToday(day) ? 'bg-amber-50 text-amber-700' : 'text-stone-400'}`}
              >
                {format(day, 'd')}
              </div>
            ))}
          </div>

          {/* Vehicle rows */}
          {vehicles.map(v => {
            const vBookings = getBookingsForVehicle(v.id);
            return (
              <div key={v.id} className="flex border-b border-stone-50 hover:bg-stone-50 transition-colors min-h-[44px]">
                {/* Vehicle label */}
                <div className="w-40 shrink-0 px-3 py-2 border-r border-stone-100 flex flex-col justify-center">
                  <p className="text-xs font-medium text-stone-800 truncate">{v.year} {v.make} {v.model}</p>
                  <p className="text-xs text-stone-400 font-mono">{v.vehicle_code}</p>
                </div>

                {/* Day cells */}
                <div className="flex flex-1">
                  {days.map(day => {
                    const booking = vBookings.find(b => isCovered(b, day));
                    const isStart = booking && format(day, 'yyyy-MM-dd') === booking.pickup_date;

                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex-1 border-r border-stone-50 min-w-[28px] relative
                          ${isToday(day) ? 'bg-amber-50/40' : ''}`}
                        style={{
                          backgroundColor: booking
                            ? `${STATUS_COLORS[booking.status]}22`
                            : undefined,
                        }}
                        onClick={() => booking && navigate(`/bookings/${booking.id}`)}
                      >
                        {isStart && (
                          <div
                            className="absolute inset-y-1 left-0.5 right-0 rounded-sm flex items-center px-1 cursor-pointer overflow-hidden"
                            style={{ backgroundColor: STATUS_COLORS[booking.status] + 'cc' }}
                            title={`${booking.booking_code} — ${booking.customers?.first_name || ''}`}
                          >
                            <span className="text-white text-[9px] font-medium truncate">
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
    </div>
  );
}
