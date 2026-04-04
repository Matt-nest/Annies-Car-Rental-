import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Car, Calendar, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, format } from 'date-fns';
import { api } from '../../../api/client';
import { cachedQuery, invalidateCache } from '../../../lib/queryCache';
import Modal from '../../shared/Modal';
import WidgetWrapper from '../WidgetWrapper';

function DeclineModal({ booking, onDecline, onClose }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const QUICK_REASONS = [
    'Vehicle not available for those dates',
    'Unable to verify driver license',
    'Booking details incomplete',
    'Vehicle requires maintenance',
  ];

  async function submit() {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await api.declineBooking(booking.id, reason.trim());
      onDecline(booking.id);
      onClose();
    } catch (e) {
      console.error(e);
      alert(e?.data?.error || 'Failed to decline booking');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Decline Booking">
      <div className="space-y-4">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Declining booking{' '}
            <span className="mono-code text-xs" style={{ color: 'var(--text-primary)' }}>
              {booking.booking_code}
            </span>{' '}
            for {booking.customers?.first_name} {booking.customers?.last_name}.
          </p>
        </div>

        {/* Quick-reason chips */}
        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{
                backgroundColor: reason === r ? 'var(--accent-glow)' : 'var(--bg-card)',
                border: `1px solid ${reason === r ? 'var(--accent-color)' : 'var(--border-subtle)'}`,
                color: reason === r ? 'var(--accent-color)' : 'var(--text-secondary)',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <div>
          <label className="label">Reason</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Explain why this booking is being declined..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button
            onClick={submit}
            disabled={!reason.trim() || saving}
            className="btn btn-danger"
          >
            {saving ? 'Declining…' : 'Decline Booking'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BookingCard({ booking, onApprove, onDeclineClick, approving }) {
  const vehicle = booking.vehicles;
  const customer = booking.customers;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 self-start sm:self-center"
        style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}
      >
        {customer?.first_name?.[0]}{customer?.last_name?.[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {customer?.first_name} {customer?.last_name}
          </span>
          {booking.booking_code && (
            <span className="mono-code text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-tertiary)' }}>
              {booking.booking_code}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {vehicle && (
            <span className="flex items-center gap-1">
              <Car size={10} />
              {vehicle.year} {vehicle.make} {vehicle.model}
            </span>
          )}
          {booking.pickup_date && (
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {format(new Date(booking.pickup_date), 'MMM d')}
              {booking.return_date && ` — ${format(new Date(booking.return_date), 'MMM d')}`}
            </span>
          )}
          {booking.total_cost && (
            <span className="flex items-center gap-1">
              <DollarSign size={10} />
              {Number(booking.total_cost).toLocaleString()}
            </span>
          )}
          {booking.created_at && (
            <span className="opacity-60">
              {formatDistanceToNow(new Date(booking.created_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0 sm:ml-2">
        <button
          onClick={() => onDeclineClick(booking)}
          disabled={approving === booking.id}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444',
            minHeight: 36,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.14)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)')}
        >
          <XCircle size={13} /> Decline
        </button>
        <button
          onClick={() => onApprove(booking.id)}
          disabled={approving === booking.id}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            backgroundColor: approving === booking.id ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.25)',
            color: '#22c55e',
            minHeight: 36,
            opacity: approving === booking.id ? 0.6 : 1,
          }}
          onMouseEnter={(e) => { if (approving !== booking.id) e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.16)'; }}
          onMouseLeave={(e) => { if (approving !== booking.id) e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.1)'; }}
        >
          <CheckCircle2 size={13} />
          {approving === booking.id ? 'Approving…' : 'Approve'}
        </button>
      </div>
    </motion.div>
  );
}

export default function PendingApprovalsWidget() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(null);
  const [declining, setDeclining] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.getBookings({ status: 'pending_approval', limit: 20 })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        setBookings(list);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Don't render when there's nothing pending
  if (!loading && !error && bookings.length === 0) return null;

  async function handleApprove(id) {
    setApproving(id);
    try {
      await api.approveBooking(id);
      // Invalidate overview cache so the badge count updates on next load
      invalidateCache('overview');
      setBookings((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      console.error(e);
      alert(e?.data?.error || 'Failed to approve booking');
    } finally {
      setApproving(null);
    }
  }

  function handleDeclined(id) {
    invalidateCache('overview');
    setBookings((prev) => prev.filter((b) => b.id !== id));
  }

  const headerAction = (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: 'var(--danger-color)', color: '#fff' }}
    >
      {bookings.length}
    </span>
  );

  return (
    <>
      <WidgetWrapper
        title="Pending Approvals"
        icon={CheckCircle2}
        loading={loading}
        error={error}
        onRetry={load}
        skeletonType="list"
        headerAction={headerAction}
        noPadding
      >
        <AnimatePresence mode="popLayout">
          {bookings.map((b, i) => (
            <BookingCard
              key={b.id}
              booking={b}
              onApprove={handleApprove}
              onDeclineClick={setDeclining}
              approving={approving}
              isLast={i === bookings.length - 1}
            />
          ))}
        </AnimatePresence>
        {bookings.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-1.5">
            <CheckCircle2 size={22} style={{ color: '#22c55e', opacity: 0.7 }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>All clear</p>
          </div>
        )}
      </WidgetWrapper>

      <AnimatePresence>
        {declining && (
          <DeclineModal
            booking={declining}
            onDecline={handleDeclined}
            onClose={() => setDeclining(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
