import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../api/client';
import {
  formatBookingWindow,
  getBookingLifecycle,
  getCustomerName,
  getVehicleName,
  hasCustomerSignedAgreement,
  hasCompletedRentalPayment,
  isReadyForHandoff,
  isReturnOverdue,
  isSameLocalDay,
  isWithinDays,
  needsOwnerCounterSignature,
  toneClasses,
} from '../../lib/bookingOps';

function normalizeList(res) {
  if (Array.isArray(res)) return res;
  return res?.data || [];
}

function pickTime(booking, kind) {
  const time = kind === 'return' ? booking.return_time : booking.pickup_time;
  return time?.slice(0, 5) || '--:--';
}

function WorkCard({ item, onClick }) {
  const tone = toneClasses(item.tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border ${tone.border} bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors p-3 group`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${tone.bg} ${tone.text} flex items-center justify-center shrink-0`}>
          <item.icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-[var(--text-primary)]">{item.title}</p>
              <p className="text-xs mt-0.5 truncate text-[var(--text-tertiary)]">{item.meta}</p>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] shrink-0 mt-0.5" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${tone.bg} ${tone.text}`}>
              {item.label}
            </span>
            {item.detail && (
              <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--bg-card-hover)] text-[var(--text-secondary)]">
                {item.detail}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyLane({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/45 p-4 text-center">
      <CheckCircle2 size={18} className="mx-auto text-emerald-500/70" />
      <p className="text-xs font-medium mt-2 text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}

export default function TodayOpsCockpit() {
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    error: null,
    overview: null,
    pending: [],
    approved: [],
    active: [],
    confirmed: [],
    readyForPickup: [],
    returned: [],
    webhookFailures: [],
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [overview, pending, approved, confirmed, readyForPickup, active, returned, webhookFailures] = await Promise.all([
        api.getOverview().catch(() => null),
        api.getBookings({ status: 'pending_approval', limit: 20 }).then(normalizeList).catch(() => []),
        api.getBookings({ status: 'approved', limit: 50 }).then(normalizeList).catch(() => []),
        api.getBookings({ status: 'confirmed', limit: 100 }).then(normalizeList).catch(() => []),
        api.getBookings({ status: 'ready_for_pickup', limit: 100 }).then(normalizeList).catch(() => []),
        api.getBookings({ status: 'active', limit: 100 }).then(normalizeList).catch(() => []),
        api.getBookings({ status: 'returned', limit: 50 }).then(normalizeList).catch(() => []),
        api.getWebhookFailures(10).then(normalizeList).catch(() => []),
      ]);
      setState({ loading: false, error: null, overview, pending, approved, confirmed, readyForPickup, active, returned, webhookFailures });
    } catch (e) {
      setState((prev) => ({ ...prev, loading: false, error: e?.message || 'Could not load operations cockpit' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const lanes = useMemo(() => {
    const handoffBookings = [...state.confirmed, ...state.readyForPickup].filter(isReadyForHandoff);

    const pickups = handoffBookings
      .filter((booking) => isSameLocalDay(booking.pickup_date))
      .map((booking) => ({
        id: `pickup-${booking.id}`,
        booking,
        icon: ArrowUpFromLine,
        title: getCustomerName(booking),
        meta: `${pickTime(booking, 'pickup')} pickup - ${getVehicleName(booking)}`,
        label: booking.status === 'ready_for_pickup' ? 'Ready for pickup' : 'Pickup today',
        detail: booking.booking_code,
        tone: 'blue',
      }));

    const returns = [
      ...(state.overview?.returns_today || []).map((booking) => ({
        id: `return-${booking.id}`,
        booking,
        icon: ArrowDownToLine,
        title: getCustomerName(booking),
        meta: `${pickTime(booking, 'return')} return - ${getVehicleName(booking)}`,
        label: 'Return today',
        detail: booking.booking_code,
        tone: 'purple',
      })),
    ];

    const overdue = state.active
      .filter((booking) => isReturnOverdue(booking))
      .map((booking) => ({
        id: `overdue-${booking.id}`,
        booking,
        icon: AlertTriangle,
        title: getCustomerName(booking),
        meta: `${getVehicleName(booking)} - due ${formatBookingWindow(booking)}`,
        label: 'Overdue return',
        detail: booking.booking_code,
        tone: 'red',
      }));

    const needsApproval = state.pending.map((booking) => ({
      id: `approval-${booking.id}`,
      booking,
      icon: CalendarClock,
      title: getCustomerName(booking),
      meta: `${getVehicleName(booking)} - ${formatBookingWindow(booking)}`,
      label: 'Needs approval',
      detail: booking.booking_code,
      tone: 'amber',
    }));

    const paymentDue = state.approved
      .filter((booking) => !hasCompletedRentalPayment(booking))
      .map((booking) => ({
        id: `payment-${booking.id}`,
        booking,
        icon: CreditCard,
        title: getCustomerName(booking),
        meta: `${getVehicleName(booking)} - ${formatBookingWindow(booking)}`,
        label: 'Payment due',
        detail: booking.booking_code,
        tone: 'sky',
      }));

    const agreementDue = [...state.approved, ...state.confirmed]
      .filter((booking) => hasCompletedRentalPayment(booking) && !hasCustomerSignedAgreement(booking))
      .map((booking) => ({
        id: `agreement-${booking.id}`,
        booking,
        icon: ShieldAlert,
        title: getCustomerName(booking),
        meta: `${getVehicleName(booking)} - agreement, license, insurance, or signature missing`,
        label: 'Agreement due',
        detail: booking.booking_code,
        tone: 'violet',
      }));

    const counterSign = [...state.approved, ...state.confirmed]
      .filter(needsOwnerCounterSignature)
      .map((booking) => ({
        id: `counter-sign-${booking.id}`,
        booking,
        icon: ShieldAlert,
        title: getCustomerName(booking),
        meta: `${getVehicleName(booking)} - owner signature needed before handoff`,
        label: 'Counter-sign needed',
        detail: booking.booking_code,
        tone: 'amber',
      }));

    const checkouts = state.returned.map((booking) => ({
      id: `checkout-${booking.id}`,
      booking,
      icon: ShieldAlert,
      title: getCustomerName(booking),
      meta: `${getVehicleName(booking)} - inspect and settle deposit`,
      label: 'Needs checkout',
      detail: booking.booking_code,
      tone: 'orange',
    }));

    const upcoming = handoffBookings
      .filter((booking) => !isSameLocalDay(booking.pickup_date) && isWithinDays(booking.pickup_date, 7))
      .slice(0, 6)
      .map((booking) => {
        const lifecycle = getBookingLifecycle(booking);
        return {
          id: `upcoming-${booking.id}`,
          booking,
          icon: CalendarClock,
          title: getCustomerName(booking),
          meta: `${getVehicleName(booking)} - ${formatBookingWindow(booking)}`,
          label: lifecycle.label,
          detail: booking.booking_code,
          tone: lifecycle.tone,
        };
      });

    return {
      needsAction: [...overdue, ...needsApproval, ...paymentDue, ...agreementDue, ...counterSign, ...checkouts].slice(0, 8),
      pickups: pickups.slice(0, 6),
      returns: returns.slice(0, 6),
      upcoming,
    };
  }, [state]);

  const riskCount = lanes.needsAction.length + (state.webhookFailures?.length || 0);

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Today Command Center</h2>
            {riskCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                {riskCount} need attention
              </span>
            )}
          </div>
          <p className="text-xs mt-1 text-[var(--text-secondary)]">
            Pickups, returns, money, checkout, and risk in one operator queue.
          </p>
        </div>
        <button type="button" onClick={load} className="btn-ghost py-2 px-3 justify-center">
          {state.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {state.error && (
        <div className="mx-5 mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 p-4 xl:grid-cols-4">
        {[
          { key: 'needsAction', title: 'Needs Action', empty: 'No urgent work queued.' },
          { key: 'pickups', title: "Today's Pickups", empty: 'No pickups today.' },
          { key: 'returns', title: "Today's Returns", empty: 'No returns today.' },
          { key: 'upcoming', title: 'Next 7 Days', empty: 'No confirmed pickups soon.' },
        ].map((lane) => (
          <div key={lane.key} className="space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{lane.title}</h3>
              <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">{lanes[lane.key].length}</span>
            </div>
            {state.loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[82px] rounded-xl bg-[var(--bg-card-hover)] animate-pulse" />
                ))}
              </div>
            ) : lanes[lane.key].length > 0 ? (
              <div className="space-y-2">
                {lanes[lane.key].map((item) => (
                  <WorkCard
                    key={item.id}
                    item={item}
                    onClick={() => item.booking?.id && navigate(`/bookings/${item.booking.id}`)}
                  />
                ))}
              </div>
            ) : (
              <EmptyLane label={lane.empty} />
            )}
          </div>
        ))}
      </div>

      {!state.loading && state.webhookFailures?.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-red-500/5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                Webhook failures need review
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Payment or notification automation may need attention before the next rental handoff.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/webhook-failures')} className="btn-secondary justify-center shrink-0">
            Review failures
          </button>
        </div>
      )}
    </section>
  );
}
