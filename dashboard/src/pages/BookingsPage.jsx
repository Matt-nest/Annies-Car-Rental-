import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import DataTable from '../components/shared/DataTable';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Modal from '../components/shared/Modal';
import { format } from 'date-fns';

const STATUSES = ['', 'pending_approval', 'approved', 'confirmed', 'active', 'returned', 'completed', 'declined', 'cancelled'];

export default function BookingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null); // { type, booking }
  const [declineReason, setDeclineReason] = useState('');
  const [actioning, setActioning] = useState(false);

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function handleApprove(booking) {
    setActioning(true);
    await api.approveBooking(booking.id).catch(console.error);
    setActionModal(null);
    fetchBookings();
    setActioning(false);
  }

  async function handleDecline() {
    setActioning(true);
    await api.declineBooking(actionModal.booking.id, declineReason).catch(console.error);
    setActionModal(null);
    setDeclineReason('');
    fetchBookings();
    setActioning(false);
  }

  const columns = [
    { key: 'booking_code', label: 'Booking', render: b => (
      <span className="font-mono text-xs font-medium text-stone-700">{b.booking_code}</span>
    )},
    { key: 'customer', label: 'Customer', render: b => (
      <div>
        <p className="font-medium text-stone-900">{b.customers?.first_name} {b.customers?.last_name}</p>
        <p className="text-xs text-stone-400">{b.customers?.email}</p>
      </div>
    )},
    { key: 'vehicle', label: 'Vehicle', render: b => (
      <span className="text-stone-700">{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</span>
    )},
    { key: 'dates', label: 'Dates', render: b => (
      <div className="text-xs text-stone-600">
        <p>{format(new Date(b.pickup_date), 'MMM d')} → {format(new Date(b.return_date), 'MMM d, yyyy')}</p>
        <p className="text-stone-400">{b.rental_days}d</p>
      </div>
    )},
    { key: 'status', label: 'Status', render: b => <StatusBadge status={b.status} /> },
    { key: 'total_cost', label: 'Total', render: b => (
      <span className="font-medium">${Number(b.total_cost).toLocaleString()}</span>
    )},
    { key: 'actions', label: '', render: b => (
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        {b.status === 'pending_approval' && (
          <>
            <button onClick={() => handleApprove(b)} className="btn-primary py-1 px-2.5 text-xs gap-1">
              <CheckCircle size={13} /> Approve
            </button>
            <button onClick={() => setActionModal({ type: 'decline', booking: b })} className="btn-danger py-1 px-2.5 text-xs gap-1">
              <XCircle size={13} /> Decline
            </button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Bookings</h1>
        <button onClick={fetchBookings} className="btn-ghost py-1.5 px-3">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-stone-400" />
          <input
            className="bg-transparent text-sm outline-none placeholder-stone-400 flex-1"
            placeholder="Search booking code…"
            value={q}
            onChange={e => setSearchParams({ status, q: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-stone-400" />
          <select
            className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-amber-400"
            value={status}
            onChange={e => setSearchParams({ status: e.target.value, q })}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s || 'All statuses'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={bookings}
          loading={loading}
          emptyMessage="No bookings found"
          onRowClick={b => navigate(`/bookings/${b.id}`)}
        />
      </div>

      {/* Decline modal */}
      <Modal
        open={actionModal?.type === 'decline'}
        onClose={() => setActionModal(null)}
        title="Decline Booking"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
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
