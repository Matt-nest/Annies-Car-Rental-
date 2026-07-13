import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, CheckCircle, XCircle, RefreshCw, BookOpen, AlertCircle, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useAlerts } from '../lib/alertsContext';
import StatusBadge from '../components/shared/StatusBadge';
import DataTable from '../components/shared/DataTable';
import Modal from '../components/shared/Modal';
import DataError from '../components/shared/DataError';
import NewBookingModal from '../components/bookings/NewBookingModal';
import ApproveBookingModal from '../components/shared/ApproveBookingModal';
import { format } from 'date-fns';
import { formatDateOnly } from '../lib/dates';
import {
  getBookingLifecycle,
  hasCompletedRentalPayment,
  hasCustomerSignedAgreement,
  isReadyForHandoff,
  isReturnOverdue,
  isSameLocalDay,
  needsOwnerCounterSignature,
  toneClasses,
} from '../lib/bookingOps';

const EASE = [0.25, 1, 0.5, 1];
const STATUSES = ['', 'pending_approval', 'approved', 'confirmed', 'ready_for_pickup', 'active', 'returned', 'completed', 'declined', 'cancelled'];

const DELIVERY_LABELS = {
  pickup: 'Customer Pickup',
  psl_delivery: 'PSL Delivery',
  surrounding_delivery: 'Surrounding Area Delivery',
  home_delivery: 'Home Delivery',
  airport_pickup: 'Airport Pickup',
  delivery: 'Delivery',
};

const LIFECYCLE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'needs_approval', label: 'Needs approval', match: b => b.status === 'pending_approval' },
  { key: 'payment_due', label: 'Payment due', match: b => b.status === 'approved' && !hasCompletedRentalPayment(b) },
  { key: 'agreement_due', label: 'Agreement due', match: b => ['approved', 'confirmed'].includes(b.status) && hasCompletedRentalPayment(b) && !hasCustomerSignedAgreement(b) },
  { key: 'counter_sign', label: 'Counter-sign', match: b => needsOwnerCounterSignature(b) },
  { key: 'pickup_today', label: 'Pickup today', match: b => ['confirmed', 'ready_for_pickup'].includes(b.status) && isReadyForHandoff(b) && isSameLocalDay(b.pickup_date) },
  { key: 'active', label: 'Active', match: b => b.status === 'active' && !isReturnOverdue(b) },
  { key: 'overdue', label: 'Overdue', match: b => isReturnOverdue(b) },
  { key: 'needs_checkout', label: 'Needs checkout', match: b => b.status === 'returned' },
];

function resolveDeliveryType(booking) {
  if (booking.delivery_type) return booking.delivery_type;
  const m = booking.special_requests?.match(/Delivery type:\s*(\w+)/i);
  return m?.[1] || (booking.delivery_requested ? 'delivery' : 'pickup');
}

function formatDeliveryLabel(booking) {
  const type = resolveDeliveryType(booking);
  return DELIVERY_LABELS[type] || type.replace(/_/g, ' ');
}

export default function BookingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [actioning, setActioning] = useState(false);
  const [actionModalError, setActionModalError] = useState(null);
  const [newBookingOpen, setNewBookingOpen] = useState(false);

  const [approveBooking, setApproveBooking] = useState(null);

  const { refresh: refreshAlerts } = useAlerts();
  const status = searchParams.get('status') || '';
  const q = searchParams.get('q') || '';
  const stage = searchParams.get('stage') || '';

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (q) params.q = q;
      const res = await api.getBookings(params);
      setBookings(res.data || res);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [status, q]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function openApproveModal(booking) {
    setActionModalError(null);
    try {
      const b = await api.getBooking(booking.id);
      if (b?.rental_agreements && !Array.isArray(b.rental_agreements)) {
        b.rental_agreements = [b.rental_agreements];
      }
      setApproveBooking(b);
    } catch (e) {
      setActionModalError(e?.data?.error || e?.message || 'Could not load booking');
    }
  }

  async function handleApproved() {
    setApproveBooking(null);
    await Promise.all([fetchBookings(), refreshAlerts()]);
  }

  async function handleDecline() {
    setActioning(true);
    setActionModalError(null);
    try {
      await api.declineBooking(actionModal.booking.id, declineReason);
      setActionModal(null);
      setDeclineReason('');
      await Promise.all([fetchBookings(), refreshAlerts()]);
    } catch (e) {
      setActionModalError(e?.data?.error || e?.message || 'Could not decline booking');
    } finally {
      setActioning(false);
    }
  }

  const setFilters = (next) => {
    const merged = { status, q, stage, ...next };
    Object.keys(merged).forEach((key) => {
      if (!merged[key]) delete merged[key];
    });
    setSearchParams(merged);
  };

  const stageFilter = LIFECYCLE_FILTERS.find(f => f.key === stage);
  const visibleBookings = stageFilter?.match ? bookings.filter(stageFilter.match) : bookings;

  const columns = [
    { key: 'booking_code', label: 'Booking', render: b => (
      <span className="mono-code text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{b.booking_code}</span>
    )},
    { key: 'customer', label: 'Customer', render: b => (
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: 'linear-gradient(135deg, #13294B, #8B5CF6)',
            color: 'var(--accent-fg)',
          }}
        >
          {b.customers?.first_name?.[0]}{b.customers?.last_name?.[0]}
        </div>
        <div>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{b.customers?.first_name} {b.customers?.last_name}</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{b.customers?.email}</p>
          {b.customers?.phone && (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{b.customers.phone}</p>
          )}
        </div>
      </div>
    )},
    { key: 'delivery', label: 'Delivery', render: b => {
      const type = resolveDeliveryType(b);
      return (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {type === 'pickup' ? 'Pickup' : formatDeliveryLabel(b)}
        </span>
      );
    }},
    { key: 'addons', label: 'Add-ons', render: b => {
      const tags = [];
      if (b.unlimited_miles || b.has_unlimited_miles) tags.push('Miles');
      if (b.unlimited_tolls || b.has_unlimited_tolls) tags.push('Tolls');
      if (b.delivery_requested || b.has_delivery) tags.push('Delivery');
      return tags.length
        ? <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{tags.join(' · ')}</span>
        : <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>;
    }},
    { key: 'vehicle', label: 'Vehicle', render: b => (
      <span style={{ color: 'var(--text-secondary)' }}>{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</span>
    )},
    { key: 'dates', label: 'Dates', render: b => (
      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        <p>{formatDateOnly(b.pickup_date, 'MMM d')} → {formatDateOnly(b.return_date)}</p>
        <p style={{ color: 'var(--text-tertiary)' }}>{b.rental_days}d</p>
      </div>
    )},
    { key: 'status', label: 'Status', render: b => {
      const lifecycle = getBookingLifecycle(b);
      const tone = toneClasses(lifecycle.tone);
      return (
        <div className="flex flex-col gap-1">
          <StatusBadge status={b.status} />
          <span className={`w-fit text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone.bg} ${tone.text}`}>
            {lifecycle.label}
          </span>
        </div>
      );
    }},
    { key: 'total_cost', label: 'Total', render: b => (
      <span className="font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>${Number(b.total_cost).toLocaleString()}</span>
    )},
    { key: 'actions', label: '', render: b => (
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        {b.status === 'pending_approval' && (
          <>
            <button
              onClick={() => setActionModal({ type: 'approve', booking: b })}
              title="Approve"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-sm"
            >
              <CheckCircle size={15} />
            </button>
            <button
              onClick={() => setActionModal({ type: 'decline', booking: b })}
              title="Decline"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm"
            >
              <XCircle size={15} />
            </button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <div className="page-shell lg:p-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Bookings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Manage rentals and reservations</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={fetchBookings} className="btn-ghost py-2 px-3 flex-1 sm:flex-none justify-center">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setNewBookingOpen(true)} className="btn-primary py-2 px-3 flex-1 sm:flex-none justify-center">
            <Plus size={14} /> New Booking
          </button>
        </div>
      </motion.div>

      <NewBookingModal
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        onCreated={fetchBookings}
      />

      <DataError error={error} />

      {/* Filter bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 flex-1 min-w-[200px]"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
          <Search size={15} style={{ color: 'var(--text-tertiary)' }} />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            style={{ color: 'var(--text-primary)' }}
            placeholder="Search booking, customer, phone, email, vehicle…"
            value={q}
            onChange={e => setFilters({ q: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--text-tertiary)' }} />
          <select
            className="input max-w-[200px]"
            value={status}
            onChange={e => setFilters({ status: e.target.value })}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s ? s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'All statuses'}</option>
            ))}
          </select>
        </div>
        <div className="w-full flex gap-2 overflow-x-auto pt-1">
          {LIFECYCLE_FILTERS.map(filter => (
            <button
              key={filter.key || 'all'}
              type="button"
              onClick={() => setFilters({ stage: filter.key })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                stage === filter.key
                  ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-[var(--accent-fg)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={visibleBookings}
          loading={loading}
          emptyMessage="No bookings found"
          emptyIcon={BookOpen}
          onRowClick={b => navigate(`/bookings/${b.id}`)}
          mobileCardRenderer={b => (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="mono-code text-xs font-semibold" style={{ color: 'var(--accent-color)' }}>{b.booking_code}</span>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={b.status} />
                  {(() => {
                    const lifecycle = getBookingLifecycle(b);
                    const tone = toneClasses(lifecycle.tone);
                    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tone.bg} ${tone.text}`}>{lifecycle.label}</span>;
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, #13294B, #8B5CF6)', color: '#fff' }}
                >
                  {b.customers?.first_name?.[0]}{b.customers?.last_name?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.customers?.first_name} {b.customers?.last_name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</p>
                </div>
                <span className="ml-auto text-sm font-bold tabular-nums shrink-0" style={{ color: 'var(--text-primary)' }}>${Number(b.total_cost).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>{formatDateOnly(b.pickup_date, 'MMM d')} → {formatDateOnly(b.return_date, 'MMM d')}</span>
                <span>{b.rental_days}d</span>
              </div>
              {b.status === 'pending_approval' && (
                <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openApproveModal(b)}
                    className="flex-1 h-10 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-500 active:bg-emerald-600"
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    onClick={() => setActionModal({ type: 'decline', booking: b })}
                    className="flex-1 h-10 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-red-500 active:bg-red-600"
                  >
                    <XCircle size={14} /> Decline
                  </button>
                </div>
              )}
            </div>
          )}
        />
      </div>

      <ApproveBookingModal
        open={!!approveBooking}
        booking={approveBooking}
        onClose={() => setApproveBooking(null)}
        onApproved={handleApproved}
      />

      {/* Decline modal */}
      <Modal open={actionModal?.type === 'decline'} onClose={() => { setActionModal(null); setActionModalError(null); }} title="Decline Booking">
        <div className="space-y-4">
          <DataError error={actionModalError} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Declining <span className="font-medium">{actionModal?.booking?.booking_code}</span> for{' '}
            {actionModal?.booking?.customers?.first_name} {actionModal?.booking?.customers?.last_name}.
            They'll be notified via SMS/email.
          </p>
          <div>
            <label className="label">Reason (optional)</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Vehicle unavailable, dates conflict…"
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setActionModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleDecline} disabled={actioning} className="btn-danger flex-1 justify-center">
              {actioning ? 'Declining…' : 'Decline Booking'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
