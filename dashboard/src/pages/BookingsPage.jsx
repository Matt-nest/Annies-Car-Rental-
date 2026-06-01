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
import { format } from 'date-fns';

const EASE = [0.25, 1, 0.5, 1];
const STATUSES = ['', 'pending_approval', 'approved', 'confirmed', 'active', 'returned', 'completed', 'declined', 'cancelled'];

export default function BookingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [actioning, setActioning] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);

  const { refresh: refreshAlerts } = useAlerts();
  const status = searchParams.get('status') || '';
  const q = searchParams.get('q') || '';

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

  async function handleApprove(booking) {
    setActioning(true);
    await api.approveBooking(booking.id).catch(console.error);
    setActionModal(null);
    await Promise.all([fetchBookings(), refreshAlerts()]);
    setActioning(false);
  }

  async function handleDecline() {
    setActioning(true);
    await api.declineBooking(actionModal.booking.id, declineReason).catch(console.error);
    setActionModal(null);
    setDeclineReason('');
    await Promise.all([fetchBookings(), refreshAlerts()]);
    setActioning(false);
  }

  const columns = [
    { key: 'booking_code', label: 'Booking', render: b => (
      <span className="mono-code text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{b.booking_code}</span>
    )},
    { key: 'customer', label: 'Customer', render: b => (
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: 'linear-gradient(135deg, #465FFF, #8B5CF6)',
            color: 'var(--accent-fg)',
          }}
        >
          {b.customers?.first_name?.[0]}{b.customers?.last_name?.[0]}
        </div>
        <div>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{b.customers?.first_name} {b.customers?.last_name}</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{b.customers?.email}</p>
        </div>
      </div>
    )},
    { key: 'vehicle', label: 'Vehicle', render: b => (
      <span style={{ color: 'var(--text-secondary)' }}>{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</span>
    )},
    { key: 'dates', label: 'Dates', render: b => (
      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        <p>{format(new Date(b.pickup_date), 'MMM d')} → {format(new Date(b.return_date), 'MMM d, yyyy')}</p>
        <p style={{ color: 'var(--text-tertiary)' }}>{b.rental_days}d</p>
      </div>
    )},
    { key: 'status', label: 'Status', render: b => <StatusBadge status={b.status} /> },
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
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Bookings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Manage rentals and reservations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchBookings} className="btn-ghost py-2 px-3">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setNewBookingOpen(true)} className="btn-primary py-2 px-3">
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
            placeholder="Search booking code…"
            value={q}
            onChange={e => setSearchParams({ status, q: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--text-tertiary)' }} />
          <select
            className="input max-w-[200px]"
            value={status}
            onChange={e => setSearchParams({ status: e.target.value, q })}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s ? s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'All statuses'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={bookings}
          loading={loading}
          emptyMessage="No bookings found"
          emptyIcon={BookOpen}
          onRowClick={b => navigate(`/bookings/${b.id}`)}
          mobileCardRenderer={b => (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="mono-code text-xs font-semibold" style={{ color: 'var(--accent-color)' }}>{b.booking_code}</span>
                <StatusBadge status={b.status} />
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, #465FFF, #8B5CF6)', color: '#fff' }}
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
                <span>{format(new Date(b.pickup_date), 'MMM d')} → {format(new Date(b.return_date), 'MMM d')}</span>
                <span>{b.rental_days}d</span>
              </div>
              {b.status === 'pending_approval' && (
                <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setActionModal({ type: 'approve', booking: b })}
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

      {/* Approve modal */}
      <Modal open={actionModal?.type === 'approve'} onClose={() => setActionModal(null)} title="Approve Booking">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            You're about to approve{' '}
            <span className="mono-code text-sm font-semibold px-2 py-0.5 rounded-lg"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              {actionModal?.booking?.booking_code}
            </span>{' '}
            for {actionModal?.booking?.customers?.first_name} {actionModal?.booking?.customers?.last_name}.
            They'll be notified via SMS/email.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setActionModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={() => handleApprove(actionModal.booking)} disabled={actioning} className="btn-primary flex-1 justify-center">
              {actioning ? 'Approving…' : 'Approve Booking'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Decline modal */}
      <Modal open={actionModal?.type === 'decline'} onClose={() => setActionModal(null)} title="Decline Booking">
        <div className="space-y-4">
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
