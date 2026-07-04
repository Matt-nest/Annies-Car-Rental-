import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Search, DollarSign, Download, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import Modal from '../components/shared/Modal';
import DataError from '../components/shared/DataError';

const EASE = [0.25, 1, 0.5, 1];

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [refundData, setRefundData] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getAllPayments({ limit: 100 });
      setPayments(res.data || []);
      setError(null);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const summary = useMemo(() => {
    const totals = payments.reduce((acc, payment) => {
      const amount = Number(payment.amount || 0);
      if (payment.payment_type === 'refund') {
        acc.refunds += Math.abs(amount);
      } else {
        acc.gross += amount;
        if (payment.payment_type === 'deposit') acc.deposits += amount;
        if (payment.payment_type === 'insurance') acc.insurance += amount;
      }
      acc.net += amount;
      return acc;
    }, { gross: 0, refunds: 0, net: 0, deposits: 0, insurance: 0 });
    return totals;
  }, [payments]);

  const openRefundModal = (payment) => {
    const childRefunds = payments.filter(p => {
      if (p.payment_type !== 'refund' || p.booking_id !== payment.booking_id) return false;
      return p.notes?.includes(`Refund for payment ${payment.id}`) ||
        (payment.reference_id && p.notes?.includes(`PI: ${payment.reference_id}`) && payment.payment_type === 'deposit');
    });
    const totalRefunded = childRefunds.reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
    const maxRefund = payment.amount - totalRefunded;
    if (maxRefund <= 0) { alert('This payment has already been fully refunded.'); return; }
    setRefundData({ ...payment, maxRefund });
    setRefundAmount(maxRefund.toString());
    setRefundReason('requested_by_customer');
    setRefundError('');
  };

  const closeRefundModal = () => { setRefundData(null); setRefundAmount(''); setRefundError(''); };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    setRefundError('');
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0 || amt > refundData.maxRefund) {
      setRefundError(`Amount must be between $0.01 and $${refundData.maxRefund.toFixed(2)}`);
      return;
    }
    setRefunding(true);
    try {
      await api.issueRefund(refundData.id, { amount: amt, reason: refundReason });
      closeRefundModal();
      await loadData();
    } catch (err) { setRefundError(err.message || 'Refund processing failed.'); }
    finally { setRefunding(false); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>Payments Ledger</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Live payment ledger, deposit tracking, and card refund controls</p>
        </div>
        <button className="btn-secondary" onClick={loadData}>
          <RefreshCw size={14} /> Refresh ledger
        </button>
      </motion.div>

      <DataError error={error} />

      {!loading && payments.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ['Gross collected', summary.gross, '#22c55e'],
            ['Refunded', summary.refunds, 'var(--danger-color)'],
            ['Net ledger', summary.net, 'var(--accent-color)'],
            ['Deposits held/paid', summary.deposits, '#8b5cf6'],
            ['Insurance collected', summary.insurance, '#0ea5e9'],
          ].map(([label, value, color]) => (
            <div key={label} className="card p-4">
              <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
              <p className="text-xl font-bold tabular-nums mt-1" style={{ color }}>
                ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments found" description="Payments will appear here as bookings are completed." />
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto glass-scroll">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Date', 'Booking', 'Customer', 'Type', 'Method', 'Amount', 'Actions'].map(h => (
                    <th key={h} className={`px-5 py-4 font-bold uppercase ${h === 'Amount' || h === 'Actions' ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => {
                  const isStripe = payment.method === 'stripe' && payment.reference_id?.startsWith('pi_');
                  const isSquare = payment.method === 'square' && !!payment.reference_id;
                  const isRefund = payment.payment_type === 'refund';
                  const canRefund = !isRefund && (isStripe || isSquare) && payment.amount > 0 && payment.payment_type !== 'insurance';
                  const displayAmount = isRefund
                    ? `-$${Math.abs(payment.amount).toFixed(2)}`
                    : `$${parseFloat(payment.amount).toFixed(2)}`;

                  return (
                    <tr
                      key={payment.id}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td className="px-5 py-4 mono-code text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {format(new Date(payment.created_at), 'MM/dd/yy HH:mm')}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          to={`/bookings/${payment.booking_id}`}
                          className="mono-code font-bold text-xs transition-colors"
                          style={{ color: 'var(--accent-color)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {payment.bookings?.booking_code || payment.booking_id.substring(0, 8)}
                        </Link>
                      </td>
                      <td className="px-5 py-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {payment.bookings?.customers
                          ? `${payment.bookings.customers.first_name} ${payment.bookings.customers.last_name}`
                          : 'Unknown'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="status-pill capitalize" style={{
                          backgroundColor: isRefund ? 'rgba(244,63,94,0.08)' : payment.payment_type === 'deposit' ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)',
                          borderColor: isRefund ? 'rgba(244,63,94,0.15)' : payment.payment_type === 'deposit' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
                          color: isRefund ? '#f43f5e' : payment.payment_type === 'deposit' ? '#8b5cf6' : '#3b82f6',
                        }}>
                          {payment.payment_type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 capitalize" style={{ color: 'var(--text-secondary)' }}>
                          {['stripe', 'square'].includes(payment.method) ? <CreditCard size={13} style={{ color: '#818cf8' }} /> : <DollarSign size={13} style={{ color: '#22c55e' }} />}
                          <span className="text-xs">{payment.method}</span>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-right font-bold tabular-nums`} style={{ color: isRefund ? 'var(--danger-color)' : '#22c55e' }}>
                        {displayAmount}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {canRefund && (
                          <button
                            onClick={() => openRefundModal(payment)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-200"
                            style={{
                              backgroundColor: 'var(--accent-glow)',
                              color: 'var(--accent-color)',
                              border: '1px solid rgba(30,58,95,0.2)',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = 'var(--accent-color)';
                              e.currentTarget.style.color = 'var(--accent-fg)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'var(--accent-glow)';
                              e.currentTarget.style.color = 'var(--accent-color)';
                            }}
                          >
                            {payment.payment_type === 'deposit' ? 'Refund deposit' : 'Refund'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {payments.map(payment => {
              const isRefund = payment.payment_type === 'refund';
              const isStripe = payment.method === 'stripe' && payment.reference_id?.startsWith('pi_');
              const isSquare = payment.method === 'square' && !!payment.reference_id;
              const canRefund = !isRefund && (isStripe || isSquare) && payment.amount > 0 && payment.payment_type !== 'insurance';
              const displayAmount = isRefund
                ? `-$${Math.abs(payment.amount).toFixed(2)}`
                : `$${parseFloat(payment.amount).toFixed(2)}`;
              const customerName = payment.bookings?.customers
                ? `${payment.bookings.customers.first_name} ${payment.bookings.customers.last_name}` : 'Unknown';

              return (
                <div key={payment.id} className="px-4 py-3.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{customerName}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: isRefund ? 'var(--danger-color)' : '#22c55e' }}>
                      {displayAmount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/bookings/${payment.booking_id}`}
                        className="mono-code text-xs font-semibold"
                        style={{ color: 'var(--accent-color)' }}
                      >
                        {payment.bookings?.booking_code || payment.booking_id.substring(0, 8)}
                      </Link>
                      <span className="status-pill capitalize" style={{
                        backgroundColor: isRefund ? 'rgba(244,63,94,0.08)' : payment.payment_type === 'deposit' ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)',
                        borderColor: isRefund ? 'rgba(244,63,94,0.15)' : payment.payment_type === 'deposit' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
                        color: isRefund ? '#f43f5e' : payment.payment_type === 'deposit' ? '#8b5cf6' : '#3b82f6',
                      }}>
                        {payment.payment_type}
                      </span>
                    </div>
                    <span className="mono-code text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {format(new Date(payment.created_at), 'MM/dd HH:mm')}
                    </span>
                  </div>
                  {canRefund && (
                    <button
                      onClick={() => openRefundModal(payment)}
                      className="mt-2 w-full h-10 rounded-lg text-xs font-semibold transition-colors"
                      style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)', border: '1px solid rgba(30,58,95,0.2)' }}
                    >
                      {payment.payment_type === 'deposit' ? 'Refund Deposit' : 'Issue Refund'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Refund Modal */}
      <Modal open={!!refundData} onClose={closeRefundModal} title="Issue Refund">
        <form onSubmit={handleRefundSubmit} className="space-y-6">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Booking: <span className="mono-code font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              {refundData?.bookings?.booking_code}
            </span>
            {refundData?.payment_type === 'deposit' && (
              <span className="ml-2 text-xs font-semibold text-purple-500">Deposit refund</span>
            )}
          </p>

          {refundError && (
            <div className="card p-3 flex items-start gap-2" style={{ backgroundColor: 'var(--danger-glow)', borderColor: 'rgba(244,63,94,0.2)' }}>
              <AlertCircle size={15} style={{ color: 'var(--danger-color)' }} className="mt-0.5 shrink-0" />
              <p className="text-xs" style={{ color: 'var(--danger-color)' }}>{refundError}</p>
            </div>
          )}

          <div>
            <label className="label">Refund Amount ($)</label>
            <div className="relative">
              <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="number" step="0.01" min="0.01" max={refundData?.maxRefund} required
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                className="input pl-9 mono-code"
              />
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
              Max: <span className="mono-code font-semibold" style={{ color: 'var(--text-primary)' }}>${refundData?.maxRefund?.toFixed(2)}</span>
            </p>
          </div>

          <div>
            <label className="label">Reason</label>
            <select value={refundReason} onChange={e => setRefundReason(e.target.value)} className="input">
              <option value="requested_by_customer">Requested by Customer</option>
              <option value="duplicate">Duplicate Charge</option>
              <option value="fraudulent">Fraudulent</option>
            </select>
          </div>

          <div className="card p-3" style={{ backgroundColor: 'var(--danger-glow)', borderColor: 'rgba(244,63,94,0.15)' }}>
            <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--danger-color)' }}>Warning</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              This will immediately reverse funds on the customer's card through the configured payment processor. This action cannot be undone.
              For deposits, the booking deposit tracker is updated after a successful full refund.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={closeRefundModal} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={refunding} className="btn-danger flex-1 justify-center">
              {refunding && <RefreshCw size={14} className="animate-spin" />}
              Confirm Refund
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
