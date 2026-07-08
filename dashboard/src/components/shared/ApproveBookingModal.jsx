import { useEffect, useState } from 'react';
import { CheckCircle, Copy, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { api } from '../../api/client';
import brand from '../../config/brand';
import ApproveBookingPanel from './ApproveBookingPanel';

function PaymentLinkCopy({ url, label = 'Payment link' }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url || ''}
          className="input flex-1 font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        <button type="button" onClick={copy} className="btn-secondary shrink-0 px-3">
          <Copy size={14} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        Share this link if you want the customer to complete payment manually. They also receive it automatically by email and SMS.
      </p>
    </div>
  );
}

/**
 * Full approval flow: review receipt + customer, set risk/deposit, approve,
 * then surface the copyable payment link.
 */
export default function ApproveBookingModal({ open, booking, onClose, onApproved }) {
  const [isHighRisk, setIsHighRisk] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [actioning, setActioning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const baseDeposit = Number(booking?.deposit_amount) || 0;

  useEffect(() => {
    if (!open || !booking) return;
    setIsHighRisk(!!booking.is_high_risk);
    setDepositAmount(String(baseDeposit.toFixed(2)));
    setError('');
    setSuccess(null);
    setActioning(false);
  }, [open, booking?.id, baseDeposit]);

  async function handleApprove() {
    if (!booking?.id) return;
    setActioning(true);
    setError('');
    try {
      const result = await api.approveBooking(booking.id, {
        is_high_risk: isHighRisk,
        deposit_amount: Number(depositAmount),
      });
      const paymentLink = result.payment_link || `${brand.siteUrl}/confirm?code=${booking.booking_code}`;
      setSuccess({ ...result, payment_link: paymentLink });
      onApproved?.({ ...result, payment_link: paymentLink });
    } catch (e) {
      setError(e?.data?.error || e?.message || 'Could not approve booking');
    } finally {
      setActioning(false);
    }
  }

  function handleClose() {
    setSuccess(null);
    onClose?.();
  }

  if (!booking) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={success ? 'Booking approved' : 'Review & approve booking'}
      maxWidth="max-w-2xl"
    >
      {success ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl p-3" style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <CheckCircle size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-600">Approved — customer notified</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {booking.customers?.first_name} {booking.customers?.last_name} will receive the payment link by email and SMS.
                {success.is_high_risk ? ' Marked as high-risk.' : ''}
                {success.deposit_amount != null ? ` Deposit: $${Number(success.deposit_amount).toFixed(2)}.` : ''}
              </p>
            </div>
          </div>
          <PaymentLinkCopy url={success.payment_link} />
          <button type="button" onClick={handleClose} className="btn-primary w-full justify-center">
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div role="alert" className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger-color)' }}>
              {error}
            </div>
          )}
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Review the details below, then approve{' '}
            <span className="font-mono font-semibold">{booking.booking_code}</span>.
          </p>
          <ApproveBookingPanel
            booking={booking}
            isHighRisk={isHighRisk}
            setIsHighRisk={setIsHighRisk}
            depositAmount={depositAmount}
            setDepositAmount={setDepositAmount}
            baseDeposit={baseDeposit}
          />
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleClose} className="btn-secondary flex-1 justify-center" disabled={actioning}>
              Cancel
            </button>
            <button type="button" onClick={handleApprove} disabled={actioning} className="btn-primary flex-1 justify-center">
              {actioning ? <><Loader2 size={14} className="animate-spin" /> Approving…</> : 'Approve & notify customer'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Inline banner with copyable payment link on an approved, unpaid booking. */
export function PaymentLinkBanner({ bookingCode, className = '' }) {
  const url = `${brand.siteUrl}/confirm?code=${bookingCode}`;
  return (
    <div className={className}>
      <PaymentLinkCopy url={url} label="Customer payment link" />
    </div>
  );
}
