import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import DataError from '../components/shared/DataError';
import { localTodayYMD, formatDateOnlyRelative } from '../lib/dates';
import {
  getBookingLifecycle,
  getCustomerName,
  getPickupDateTime,
  getReturnDateTime,
  getVehicleName,
  hasCompletedRentalPayment,
  hasCustomerSignedAgreement,
  isReadyForHandoff,
  isReturnOverdue,
  needsOwnerCounterSignature,
  toneClasses,
} from '../lib/bookingOps';

function compareDateTime(a, b, getter) {
  return toComparableTime(getter(a)) - toComparableTime(getter(b));
}

function toComparableTime(value) {
  if (!value) return 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function toDateKey(value) {
  if (!value) return '';
  if (value instanceof Date) {
    const time = value.getTime();
    if (Number.isNaN(time)) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number') {
    return toDateKey(new Date(value));
  }
  const raw = String(value);
  const dateOnly = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) return dateOnly;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : toDateKey(parsed);
}

function isOnOrBefore(date, today) {
  const key = toDateKey(date);
  return Boolean(key && key <= today);
}

function isAfter(date, today) {
  const key = toDateKey(date);
  return Boolean(key && key > today);
}

function formatTime(value) {
  if (!value) return '--:--';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '--:--';
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') return formatTime(new Date(value));
  const raw = String(value);
  const timeMatch = raw.match(/(?:T|\s)?(\d{2}:\d{2})(?::\d{2})?/);
  return timeMatch?.[1] || raw.slice(0, 5) || '--:--';
}

function formatScheduleDate(value) {
  const key = toDateKey(value);
  return key ? formatDateOnlyRelative(key) : '—';
}

function getBlockers(booking) {
  const blockers = [];
  if (!hasCompletedRentalPayment(booking)) blockers.push('Payment');
  if (!hasCustomerSignedAgreement(booking)) blockers.push('Agreement');
  if (needsOwnerCounterSignature(booking)) blockers.push('Counter-sign');
  return blockers;
}

function StatPill({ icon: Icon, label, value, tone = 'slate' }) {
  const toneMap = {
    red: 'border-red-500/20 bg-red-500/10 text-red-500',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
    purple: 'border-purple-500/20 bg-purple-500/10 text-purple-500',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
    slate: 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]',
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneMap[tone] || toneMap.slate}`}>
      <div className="flex items-center gap-2">
        <Icon size={15} />
        <span className="text-lg font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] font-semibold mt-0.5 text-[var(--text-tertiary)]">{label}</p>
    </div>
  );
}

function BookingOpsCard({ booking, mode, onOpen }) {
  const lifecycle = getBookingLifecycle(booking);
  const tone = toneClasses(lifecycle.tone);
  const pickup = `${formatScheduleDate(booking.pickup_date)} ${formatTime(booking.pickup_time)}`;
  const ret = `${formatScheduleDate(booking.return_date)} ${formatTime(booking.return_time)}`;
  const blockers = getBlockers(booking);
  const c = booking.customers || {};

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left rounded-xl border ${tone.border} bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] p-3 transition-colors group`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold truncate text-[var(--text-primary)]">{getVehicleName(booking)}</p>
            <StatusBadge status={booking.status} size="xs" />
          </div>
          <p className="text-xs mt-0.5 text-[var(--text-secondary)] truncate">
            {getCustomerName(booking)} · <span className="font-mono">{booking.booking_code}</span>
          </p>
        </div>
        <ChevronRight size={15} className="mt-0.5 shrink-0 text-[var(--text-tertiary)] opacity-60 group-hover:opacity-100" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-[var(--bg-card-hover)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)]">Pickup</p>
          <p className="font-semibold text-[var(--text-primary)]">{pickup}</p>
        </div>
        <div className="rounded-lg bg-[var(--bg-card-hover)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)]">Return</p>
          <p className="font-semibold text-[var(--text-primary)]">{ret}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${tone.bg} ${tone.text}`}>
          {mode || lifecycle.label}
        </span>
        {blockers.map((blocker) => (
          <span key={blocker} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-500/10 text-amber-500">
            {blocker}
          </span>
        ))}
        {c.phone && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--bg-card-hover)] text-[var(--text-secondary)]">
            {c.phone}
          </span>
        )}
      </div>
    </button>
  );
}

function Lane({ title, icon: Icon, count, children, empty, tone = 'slate' }) {
  const iconClass = {
    red: 'text-red-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    emerald: 'text-emerald-500',
    slate: 'text-[var(--text-tertiary)]',
  }[tone] || 'text-[var(--text-tertiary)]';

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={`${iconClass} shrink-0`} />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] truncate">{title}</h2>
        </div>
        <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">{count}</span>
      </div>
      {count > 0 ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/50 p-4 text-center">
          <CheckCircle2 size={18} className="mx-auto text-emerald-500/70" />
          <p className="text-xs font-medium mt-2 text-[var(--text-secondary)]">{empty}</p>
        </div>
      )}
    </section>
  );
}

export default function CheckInsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');

  async function loadBookings() {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.getBookings({ limit: 200 });
      setBookings(Array.isArray(result) ? result : (result?.data || []));
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'Could not load check-in operations');
    }
    setLoading(false);
  }

  useEffect(() => { loadBookings(); }, []);

  const today = localTodayYMD();
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return bookings;
    return bookings.filter((booking) => {
      const haystack = [
        booking.booking_code,
        getCustomerName(booking),
        getVehicleName(booking),
        booking.customers?.email,
        booking.customers?.phone,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [bookings, q]);

  const lanes = useMemo(() => {
    const pickupCandidates = filtered.filter((b) => b.pickup_date && ['approved', 'confirmed', 'ready_for_pickup'].includes(b.status));
    const blocked = pickupCandidates
      .filter((b) => !isReadyForHandoff(b))
      .sort((a, b) => compareDateTime(a, b, getPickupDateTime));
    const handoffDue = pickupCandidates
      .filter((b) => isReadyForHandoff(b) && isOnOrBefore(b.pickup_date, today))
      .sort((a, b) => compareDateTime(a, b, getPickupDateTime));
    const active = filtered.filter((b) => b.status === 'active');
    const overdue = active.filter((b) => isReturnOverdue(b)).sort((a, b) => compareDateTime(a, b, getReturnDateTime));
    const dueBack = active
      .filter((b) => !isReturnOverdue(b) && isOnOrBefore(b.return_date, today))
      .sort((a, b) => compareDateTime(a, b, getReturnDateTime));
    const activeOut = active
      .filter((b) => !isReturnOverdue(b) && isAfter(b.return_date, today))
      .sort((a, b) => compareDateTime(a, b, getReturnDateTime));
    const returned = filtered
      .filter((b) => b.status === 'returned')
      .sort((a, b) => compareDateTime(a, b, getReturnDateTime));
    const upcomingReady = pickupCandidates
      .filter((b) => isReadyForHandoff(b) && isAfter(b.pickup_date, today))
      .sort((a, b) => compareDateTime(a, b, getPickupDateTime));

    return { blocked, handoffDue, overdue, dueBack, activeOut, returned, upcomingReady };
  }, [filtered, today]);

  const openBooking = (booking, tab) => navigate(`/bookings/${booking.id}`, { state: { activeTab: tab } });

  if (loading) {
    return (
      <div className="page-shell lg:p-8 space-y-4">
        <div className="h-8 w-64 rounded skeleton" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-xl skeleton" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell lg:p-8 space-y-6 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Check-In / Check-Out Board</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">
            Handoffs, active trips, returns, overdue rentals, and settlement work in one operator queue.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 min-w-0 sm:min-w-[320px]"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <Search size={15} className="text-[var(--text-tertiary)] shrink-0" />
            <input
              className="bg-transparent text-sm outline-none flex-1 min-w-0 text-[var(--text-primary)]"
              placeholder="Search renter, vehicle, booking, phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="button" onClick={loadBookings} className="btn-secondary justify-center">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <DataError message={loadError} onRetry={loadBookings} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatPill icon={ShieldAlert} label="Blocked pickup" value={lanes.blocked.length} tone={lanes.blocked.length ? 'amber' : 'slate'} />
        <StatPill icon={ArrowUpFromLine} label="Ready handoff" value={lanes.handoffDue.length} tone={lanes.handoffDue.length ? 'blue' : 'slate'} />
        <StatPill icon={AlertTriangle} label="Overdue" value={lanes.overdue.length} tone={lanes.overdue.length ? 'red' : 'slate'} />
        <StatPill icon={ArrowDownToLine} label="Due back" value={lanes.dueBack.length} tone={lanes.dueBack.length ? 'purple' : 'slate'} />
        <StatPill icon={Clock} label="Active out" value={lanes.activeOut.length} tone="emerald" />
        <StatPill icon={ClipboardCheck} label="Settle" value={lanes.returned.length} tone={lanes.returned.length ? 'amber' : 'slate'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Lane title="Blocked From Pickup" icon={ShieldAlert} count={lanes.blocked.length} empty="No pickup blockers." tone="amber">
          {lanes.blocked.map((b) => <BookingOpsCard key={b.id} booking={b} mode="Resolve blockers" onOpen={() => openBooking(b, 'overview')} />)}
        </Lane>
        <Lane title="Ready For Handoff" icon={ArrowUpFromLine} count={lanes.handoffDue.length} empty="No vehicles ready for handoff now." tone="blue">
          {lanes.handoffDue.map((b) => <BookingOpsCard key={b.id} booking={b} mode="Open check-in" onOpen={() => openBooking(b, 'checkin')} />)}
        </Lane>
        <Lane title="Overdue Returns" icon={AlertTriangle} count={lanes.overdue.length} empty="No overdue returns." tone="red">
          {lanes.overdue.map((b) => <BookingOpsCard key={b.id} booking={b} mode="Contact / checkout" onOpen={() => openBooking(b, 'checkout')} />)}
        </Lane>
        <Lane title="Due Back Today" icon={ArrowDownToLine} count={lanes.dueBack.length} empty="No returns due now." tone="purple">
          {lanes.dueBack.map((b) => <BookingOpsCard key={b.id} booking={b} mode="Prepare return" onOpen={() => openBooking(b, 'checkout')} />)}
        </Lane>
        <Lane title="Active Out" icon={Clock} count={lanes.activeOut.length} empty="No active rentals out past today." tone="emerald">
          {lanes.activeOut.slice(0, 10).map((b) => <BookingOpsCard key={b.id} booking={b} mode="Monitor" onOpen={() => openBooking(b, 'checkout')} />)}
        </Lane>
        <Lane title="Returned / Settle" icon={ClipboardCheck} count={lanes.returned.length} empty="No returned rentals need settlement." tone="amber">
          {lanes.returned.map((b) => <BookingOpsCard key={b.id} booking={b} mode="Inspect and settle" onOpen={() => openBooking(b, 'checkout')} />)}
        </Lane>
      </div>

      {lanes.upcomingReady.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[var(--accent-color)]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Upcoming Ready Pickups</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lanes.upcomingReady.slice(0, 6).map((b) => (
              <BookingOpsCard key={b.id} booking={b} mode="Upcoming handoff" onOpen={() => openBooking(b, 'checkin')} />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="card p-8 text-center">
          <PackageCheck size={28} className="mx-auto text-[var(--text-tertiary)]" />
          <p className="text-sm font-medium mt-2 text-[var(--text-primary)]">No matching rental operations.</p>
          <p className="text-xs mt-1 text-[var(--text-tertiary)]">Clear search or refresh the board.</p>
        </div>
      )}
    </div>
  );
}
