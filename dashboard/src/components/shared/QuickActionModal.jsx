import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Eye, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAlerts } from '../../lib/alertsContext';
import { invalidateCache } from '../../lib/queryCache';

/**
 * QuickActionModal — opens when admin clicks a high-priority dashboard
 * notification (new_booking, agreement_pending, damage_report). Surfaces the
 * same Approve / Decline / Dismiss controls available inline on the booking
 * detail page so admin doesn't lose dashboard context.
 *
 * On action: calls the same mutation the booking detail page calls, marks
 * the notification read, refreshes the alerts context, then closes.
 */
export default function QuickActionModal({ notification, onClose }) {
  const navigate = useNavigate();
  const { refresh: refreshAlerts } = useAlerts();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [error, setError] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);

  const bookingId = notification?.metadata?.booking_id;

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const b = await api.getBooking(bookingId);
        if (!cancelled) setBooking(b);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load booking');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  async function dismissAndRefresh() {
    if (notification && !notification.is_read) {
      try { await api.markNotificationRead(notification.id); } catch { /* swallow */ }
    }
    invalidateCache('overview');
    refreshAlerts();
  }

  async function handleApprove() {
    if (!bookingId) return;
    setActing('approve'); setError('');
    try {
      await api.approveBooking(bookingId);
      await dismissAndRefresh();
      onClose();
    } catch (e) {
      setError(e?.data?.error || e?.message || 'Failed to approve');
    } finally { setActing(null); }
  }

  async function handleDecline() {
    if (!bookingId || !declineReason.trim()) return;
    setActing('decline'); setError('');
    try {
      await api.declineBooking(bookingId, declineReason.trim());
      await dismissAndRefresh();
      onClose();
    } catch (e) {
      setError(e?.data?.error || e?.message || 'Failed to decline');
    } finally { setActing(null); }
  }

  async function handleDismiss() {
    setActing('dismiss');
    await dismissAndRefresh();
    setActing(null);
    onClose();
  }

  function handleViewFull() {
    if (notification?.link) navigate(notification.link);
    onClose();
  }

  const c = booking?.customers;
  const v = booking?.vehicles;
  const status = booking?.status;
  const canApprove = status === 'pending_approval';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[999991] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={e => e.stopPropagation()}
          className="rounded-2xl max-w-md w-full"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{notification?.title || 'Quick action'}</p>
              {notification?.message && (
                <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{notification.message}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            ) : !booking ? (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                No booking attached to this notification — dismiss or open it for full context.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>Customer</p>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{c?.first_name} {c?.last_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>Status</p>
                    <p className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{status?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>Vehicle</p>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{v?.year} {v?.make} {v?.model}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>Code</p>
                    <p className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{booking.booking_code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>Pickup</p>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{booking.pickup_date}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>Return</p>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{booking.return_date}</p>
                  </div>
                </div>

                {showDecline && (
                  <div className="pt-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>
                      Decline reason
                    </label>
                    <textarea
                      autoFocus
                      rows={2}
                      value={declineReason}
                      onChange={e => setDeclineReason(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg text-sm resize-none"
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      placeholder="Why are you declining?"
                    />
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-xs" style={{ color: 'var(--danger-color)' }}>{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-3 flex flex-wrap gap-2 justify-end" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={handleDismiss}
              disabled={!!acting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {acting === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
            </button>
            <button
              onClick={handleViewFull}
              disabled={!!acting || !notification?.link}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              <Eye size={12} /> View full
            </button>
            {canApprove && !showDecline && (
              <>
                <button
                  onClick={() => setShowDecline(true)}
                  disabled={!!acting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <XCircle size={12} /> Decline
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!!acting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-transform hover:scale-[1.03] disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917' }}
                >
                  {acting === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Approve
                </button>
              </>
            )}
            {canApprove && showDecline && (
              <>
                <button
                  onClick={() => { setShowDecline(false); setDeclineReason(''); }}
                  disabled={!!acting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecline}
                  disabled={!!acting || !declineReason.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                  style={{ backgroundColor: '#ef4444', color: '#fff' }}
                >
                  {acting === 'decline' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                  Confirm decline
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
