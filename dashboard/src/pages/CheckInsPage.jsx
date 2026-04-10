import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import { ArrowUpFromLine, ArrowDownToLine, Car, Calendar, Clock, ChevronRight, Search } from 'lucide-react';
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';

export default function CheckInsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today'); // 'today' | 'upcoming' | 'past'

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    setLoading(true);
    try {
      const result = await api.getBookings({ limit: 200 });
      // API returns { data: [...], total, limit, offset }
      setBookings(Array.isArray(result) ? result : (result?.data || []));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const today = new Date().toISOString().split('T')[0];

  // Categorize bookings
  const pickups = bookings.filter(b => b.pickup_date && ['confirmed', 'ready_for_pickup', 'approved'].includes(b.status));
  const returns = bookings.filter(b => b.return_date && ['active'].includes(b.status));

  const todayPickups = pickups.filter(b => b.pickup_date === today);
  const todayReturns = returns.filter(b => b.return_date === today);
  const upcomingPickups = pickups.filter(b => b.pickup_date > today).sort((a, b) => a.pickup_date.localeCompare(b.pickup_date));
  const upcomingReturns = returns.filter(b => b.return_date > today).sort((a, b) => a.return_date.localeCompare(b.return_date));
  const pastReturns = bookings.filter(b => b.status === 'returned' || b.status === 'completed').sort((a, b) => (b.return_date || '').localeCompare(a.return_date || '')).slice(0, 10);

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = parseISO(dateStr);
      if (isToday(d)) return 'Today';
      if (isTomorrow(d)) return 'Tomorrow';
      if (isYesterday(d)) return 'Yesterday';
      return format(d, 'MMM d');
    } catch { return dateStr; }
  }

  function BookingRow({ booking, type }) {
    const v = booking.vehicles;
    const c = booking.customers;
    const vehicleName = v ? `${v.year} ${v.make} ${v.model}` : 'Vehicle';
    const customerName = c ? `${c.first_name} ${c.last_name}` : 'Customer';
    const dateStr = type === 'pickup' ? booking.pickup_date : booking.return_date;
    const isPickup = type === 'pickup';

    return (
      <div
        onClick={() => navigate(`/bookings/${booking.id}`, { state: { activeTab: isPickup ? 'checkin' : 'checkout' } })}
        className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-medium)] cursor-pointer transition-all group"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPickup ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
          {isPickup ? <ArrowUpFromLine size={18} className="text-blue-500" /> : <ArrowDownToLine size={18} className="text-purple-500" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{vehicleName}</span>
            <StatusBadge status={booking.status} size="xs" />
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
            <span>{customerName}</span>
            <span>·</span>
            <span className="font-mono">{booking.booking_code}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{formatDate(dateStr)}</p>
          <p className="text-xs text-[var(--text-tertiary)]">{isPickup ? 'Check-In' : 'Check-Out'}</p>
        </div>

        <ChevronRight size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent-color)] shrink-0 transition-colors" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 rounded skeleton" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Check-Ins & Check-Outs</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Manage today's vehicle handoffs and returns</p>
      </div>

      {/* Today's Activity */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-[var(--accent-color)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Today</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-glow)] text-[var(--accent-color)] font-semibold">
            {todayPickups.length + todayReturns.length}
          </span>
        </div>

        {todayPickups.length === 0 && todayReturns.length === 0 ? (
          <div className="text-center py-10 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)]">
            <Clock size={32} className="mx-auto text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--text-tertiary)]">No check-ins or check-outs scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayPickups.map(b => <BookingRow key={`p-${b.id}`} booking={b} type="pickup" />)}
            {todayReturns.map(b => <BookingRow key={`r-${b.id}`} booking={b} type="return" />)}
          </div>
        )}
      </section>

      {/* Upcoming */}
      {(upcomingPickups.length > 0 || upcomingReturns.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Upcoming</h2>
          <div className="space-y-3">
            {upcomingPickups.map(b => <BookingRow key={`up-${b.id}`} booking={b} type="pickup" />)}
            {upcomingReturns.map(b => <BookingRow key={`ur-${b.id}`} booking={b} type="return" />)}
          </div>
        </section>
      )}

      {/* Recent Returns */}
      {pastReturns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Recently Returned</h2>
          <div className="space-y-3">
            {pastReturns.map(b => <BookingRow key={`past-${b.id}`} booking={b} type="return" />)}
          </div>
        </section>
      )}
    </div>
  );
}
