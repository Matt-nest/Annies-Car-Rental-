import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../shared/Modal';

/**
 * Danger-zone delete for a customer profile — removes the customer and every
 * related booking, payment, message, review, agreement, deposit, and ID photo.
 */
export default function CustomerDeleteSection({ customer, canDelete, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !customer?.id) return;
    let cancelled = false;
    setPreviewLoading(true);
    setError('');
    api.getCustomerDeletionPreview(customer.id)
      .then(data => { if (!cancelled) setPreview(data); })
      .catch(err => { if (!cancelled) setError(err?.message || 'Could not load deletion preview'); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [open, customer?.id]);

  function handleOpen() {
    setConfirmEmail('');
    setError('');
    setPreview(null);
    setOpen(true);
  }

  function handleClose() {
    if (deleting) return;
    setOpen(false);
    setConfirmEmail('');
    setError('');
  }

  async function handleDelete() {
    if (!customer?.id) return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteCustomer(customer.id, confirmEmail.trim());
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  if (!canDelete) return null;

  const counts = preview?.counts;
  const emailMatch = confirmEmail.trim().toLowerCase() === (customer.email || '').toLowerCase();

  return (
    <>
      <div className="card p-5 border border-red-200 dark:border-red-500/20">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 size={15} /> Delete customer profile
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 leading-relaxed">
              Permanently removes this customer and <strong className="text-[var(--text-secondary)]">everything</strong> tied to them
              — all bookings, payments, deposits, messages, reviews, rental agreements, ID photos, and inquiry records.
              This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpen}
            className="shrink-0 text-xs font-medium px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Delete customer
          </button>
        </div>
      </div>

      <Modal open={open} onClose={handleClose} title="Delete customer permanently?" maxWidth="max-w-lg">
        <div className="space-y-4">
          <div
            className="flex items-start gap-3 p-3 rounded-xl text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-[var(--text-secondary)]">
              <p className="font-semibold text-red-600 dark:text-red-400">
                {customer.first_name} {customer.last_name}
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                You are about to erase this customer and every record linked to them from the database.
                Active and past rentals, payment history, and uploaded ID images will all be removed.
              </p>
            </div>
          </div>

          {previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] py-2">
              <Loader2 size={14} className="animate-spin" /> Calculating related records…
            </div>
          ) : counts ? (
            <div
              className="grid grid-cols-2 gap-2 text-sm p-3 rounded-xl"
              style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
            >
              {[
                ['Bookings', counts.bookings],
                ['Payments', counts.payments],
                ['Messages', counts.messages],
                ['Reviews', counts.reviews],
                ['Agreements', counts.agreements],
                ['Deposits', counts.deposits],
                ['Inquiries', counts.monthly_inquiries],
              ].map(([label, n]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-[var(--text-tertiary)]">{label}</span>
                  <span className="font-semibold tabular-nums text-[var(--text-primary)]">{n}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">
              Type <span className="font-mono normal-case">{customer.email}</span> to confirm
            </label>
            <input
              type="email"
              className="input w-full"
              value={confirmEmail}
              onChange={e => setConfirmEmail(e.target.value)}
              placeholder={customer.email}
              autoComplete="off"
              disabled={deleting}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500" role="alert">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={handleClose} disabled={deleting} className="btn-ghost" style={{ border: '1px solid var(--border-subtle)' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || !emailMatch || previewLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 transition-colors"
            >
              {deleting ? (
                <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Deleting…</span>
              ) : (
                'Delete everything'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
