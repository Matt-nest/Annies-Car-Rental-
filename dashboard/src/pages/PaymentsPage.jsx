import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, DollarSign, Download, CreditCard, RefreshCw, AlertCircle, Shield, Clock, ClipboardCheck, ArrowRight, Copy, Mail, ExternalLink, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import Modal from '../components/shared/Modal';
import DataError from '../components/shared/DataError';
import InlineBanner from '../components/shared/InlineBanner';
import DepositsPanel from '../components/payments/DepositsPanel';
import { StripePanel } from './StripePage';
import { ActionHistoryPanel, AuditTrailPanel, MoneyActionConfirm, buildActionEntry, normalizeAuditEntries } from '../components/shared/MoneyActionGuardrails';
import { getBookingLifecycle, getCustomerName, getVehicleName } from '../lib/bookingOps';
import { formatDateOnly, localTodayYMD } from '../lib/dates';
import { isStripeProvider } from '../config/paymentProvider';
import brand from '../config/brand';

const EASE = [0.25, 1, 0.5, 1];

function canRefundPayment(payment) {
  if (payment.payment_type === 'refund' || payment.amount <= 0) return false;
  if (payment.method === 'stripe' && payment.reference_id?.startsWith('pi_')) return true;
  if (payment.method === 'square' && payment.reference_id) return true;
  return false;
}

function providerLabel(method) {
  if (method === 'stripe') return 'Stripe';
  if (method === 'square') return 'Square';
  return method || 'Payment';
}

function money(value, maximumFractionDigits = 0) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits });
}

function depositCents(row) {
  return Math.max(0, Number(row?.amount || 0) - Number(row?.refund_amount || 0) - Number(row?.applied_amount || 0));
}

function riskAmount(booking) {
  return Number(booking?.total_cost || 0) + Number(booking?.deposit_amount || 0);
}

function RiskTile({ icon: Icon, label, value, subtext, tone = 'slate' }) {
  const tones = {
    red: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    purple: 'border-purple-500/25 bg-purple-500/10 text-purple-600 dark:text-purple-400',
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    slate: 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)]',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between gap-3">
        <Icon size={17} />
        <span className="text-xl font-bold tabular-nums">{value}</span>
      </div>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      {subtext && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtext}</p>}
    </div>
  );
}

function paymentLink(booking) {
  return `${brand.siteUrl}/confirm?code=${encodeURIComponent(booking.booking_code)}`;
}

function reminderBody(booking) {
  const customer = booking.customers || {};
  const firstName = customer.first_name || 'there';
  return `Hi ${firstName}, your ${brand.name} booking ${booking.booking_code} is approved but payment is still needed before pickup.\n\nComplete payment here: ${paymentLink(booking)}\n\nUnpaid bookings can expire after approval. Reply here if you need help.`;
}

function RiskBookingRow({ booking, label, tone = 'amber', amount, action = 'Open booking', children }) {
  const toneMap = {
    red: 'text-red-600 dark:text-red-400 bg-red-500/10',
    amber: 'text-amber-700 dark:text-amber-400 bg-amber-500/10',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
    slate: 'text-[var(--text-secondary)] bg-[var(--bg-card-hover)]',
  };
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-card-hover)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[var(--text-primary)] truncate">{getCustomerName(booking)}</p>
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${toneMap[tone] || toneMap.slate}`}>
              {label}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)] truncate">{getVehicleName(booking)} · <span className="font-mono">{booking.booking_code}</span></p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {formatDateOnly(booking.pickup_date, 'MMM d')} to {formatDateOnly(booking.return_date, 'MMM d')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold tabular-nums text-[var(--text-primary)]">{money(amount, 2)}</p>
          <Link to={`/bookings/${booking.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-color)]">
            {action} <ArrowRight size={12} />
          </Link>
        </div>
      </div>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

function MoneyAtRiskPanel({ bookings, deposits, loading, error, onRetry, persistedHistory = [] }) {
  const [acting, setActing] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const today = localTodayYMD();
  const risk = useMemo(() => {
    const paymentDue = bookings
      .filter((booking) => getBookingLifecycle(booking).key === 'payment_due')
      .sort((a, b) => riskAmount(b) - riskAmount(a));
    const needsCheckout = bookings
      .filter((booking) => booking.status === 'returned')
      .sort((a, b) => (b.return_date || '').localeCompare(a.return_date || ''));
    const longTermAtRisk = bookings
      .filter((booking) => booking.rental_type === 'long_term' && ['active', 'returned'].includes(booking.status))
      .filter((booking) => booking.status === 'returned' || (booking.status === 'active' && booking.return_date && booking.return_date < today))
      .sort((a, b) => (a.return_date || '').localeCompare(b.return_date || ''));
    const heldDeposits = deposits.filter((row) => row.status === 'held');
    const heldDepositTotal = heldDeposits.reduce((sum, row) => sum + depositCents(row), 0) / 100;
    const paymentDueTotal = paymentDue.reduce((sum, booking) => sum + riskAmount(booking), 0);
    const checkoutExposure = needsCheckout.reduce((sum, booking) => sum + Number(booking.deposit_amount || 0), 0);
    const longTermExposure = longTermAtRisk.reduce((sum, booking) => sum + Number(booking.total_cost || 0), 0);
    return { paymentDue, needsCheckout, longTermAtRisk, heldDeposits, heldDepositTotal, paymentDueTotal, checkoutExposure, longTermExposure };
  }, [bookings, deposits, today]);

  if (loading) return <SkeletonTable rows={5} cols={3} />;

  const recordAction = (action, status) => {
    setActionHistory((items) => [buildActionEntry(action, status), ...items].slice(0, 8));
  };

  const copyPaymentLink = async (booking) => {
    await navigator.clipboard.writeText(paymentLink(booking));
    api.recordMoneyAction({
      actionKey: 'payment_link_copied',
      title: 'Payment link copied',
      detail: 'Operator copied the customer payment link.',
      bookingId: booking.id,
      customerId: booking.customers?.id,
      amountCents: Math.round(riskAmount(booking) * 100),
      metadata: {
        subject: `${getCustomerName(booking)} · ${booking.booking_code}`,
        booking_code: booking.booking_code,
      },
    }).catch(() => {});
    setActionError('');
    setNotice(`Payment link copied for ${booking.booking_code}.`);
    recordAction({
      title: 'Payment link copied',
      subject: `${getCustomerName(booking)} · ${booking.booking_code}`,
      auditDetail: 'Operator copied the customer payment link.',
    });
  };

  const runPaymentReminder = async (booking, action) => {
    if (!booking.customers?.id) {
      setActionError('This booking has no linked customer to message.');
      return;
    }
    setActing(`reminder-${booking.id}`);
    setActionError('');
    try {
      await api.sendMessage(booking.customers.id, {
        channel: 'email',
        subject: `${brand.name}: payment needed for ${booking.booking_code}`,
        body: reminderBody(booking),
        moneyAction: {
          actionKey: 'payment_reminder_sent',
          title: 'Payment reminder sent',
          detail: 'Operator sent a payment reminder with the customer payment link.',
          bookingId: booking.id,
          amountCents: Math.round(riskAmount(booking) * 100),
          metadata: {
            subject: `${getCustomerName(booking)} · ${booking.booking_code}`,
            booking_code: booking.booking_code,
          },
        },
      });
      setNotice(`Payment reminder sent for ${booking.booking_code}.`);
      recordAction(action || {
        title: 'Payment reminder sent',
        subject: `${getCustomerName(booking)} · ${booking.booking_code}`,
        amount: riskAmount(booking),
      });
    } catch (err) {
      setActionError(err?.message || 'Payment reminder failed.');
    } finally {
      setActing('');
      setConfirmAction(null);
    }
  };

  const requestPaymentReminder = (booking) => {
    if (!booking.customers?.id || !booking.customers?.email) {
      setActionError('This booking needs a linked customer with an email before a reminder can be sent.');
      return;
    }
    setConfirmAction({
      title: 'Send Payment Reminder',
      subject: `${getCustomerName(booking)} · ${booking.booking_code}`,
      amount: riskAmount(booking),
      impact: 'Sends an email reminder with the customer payment link.',
      checklist: ['Customer is approved for this rental.', 'Payment is still due.', 'The email address on file is correct.'],
      warning: 'This contacts the customer. Use it only when the booking is still valid and payment is truly outstanding.',
      auditDetail: 'Message will be saved in the customer conversation history and this session action log.',
      confirmLabel: 'Send Reminder',
      onConfirm: () => runPaymentReminder(booking, {
        title: 'Payment reminder sent',
        subject: `${getCustomerName(booking)} · ${booking.booking_code}`,
        amount: riskAmount(booking),
        auditDetail: 'Operator sent a payment reminder.',
      }),
    });
  };

  return (
    <div className="space-y-5">
      <DataError error={error} onRetry={onRetry} />
      <InlineBanner message={actionError} onDismiss={() => setActionError('')} />
      <InlineBanner message={notice} tone="success" onDismiss={() => setNotice('')} />
      <MoneyActionConfirm
        action={confirmAction}
        busy={!!acting}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm?.()}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RiskTile icon={DollarSign} label="Collection Queue" value={risk.paymentDue.length} subtext={`${money(risk.paymentDueTotal, 2)} payment due`} tone={risk.paymentDue.length ? 'amber' : 'slate'} />
        <RiskTile icon={Shield} label="Deposits Held" value={risk.heldDeposits.length} subtext={`${money(risk.heldDepositTotal, 2)} refundable exposure`} tone={risk.heldDeposits.length ? 'purple' : 'slate'} />
        <RiskTile icon={ClipboardCheck} label="Needs Settlement" value={risk.needsCheckout.length} subtext={`${money(risk.checkoutExposure, 2)} deposit decisions`} tone={risk.needsCheckout.length ? 'amber' : 'slate'} />
        <RiskTile icon={Clock} label="Long-Term At Risk" value={risk.longTermAtRisk.length} subtext={`${money(risk.longTermExposure, 2)} renewal value`} tone={risk.longTermAtRisk.length ? 'red' : 'slate'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Collect rental balance</h2>
            <p className="text-xs text-[var(--text-tertiary)]">Approved bookings that are not operationally ready because payment is still due.</p>
          </div>
          {risk.paymentDue.slice(0, 6).map((booking) => (
            <RiskBookingRow key={booking.id} booking={booking} label="Payment due" amount={riskAmount(booking)} action="Open">
              <button type="button" className="btn-primary text-xs py-1.5" disabled={acting === `reminder-${booking.id}` || !booking.customers?.email} onClick={() => requestPaymentReminder(booking)}>
                {acting === `reminder-${booking.id}` ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />} Send reminder
              </button>
              <button type="button" className="btn-secondary text-xs py-1.5" onClick={() => copyPaymentLink(booking)}>
                <Copy size={13} /> Copy link
              </button>
              <a href={paymentLink(booking)} target="_blank" rel="noreferrer" className="btn-ghost text-xs py-1.5">
                <ExternalLink size={13} /> Customer page
              </a>
            </RiskBookingRow>
          ))}
          {risk.paymentDue.length === 0 && <EmptyState icon={DollarSign} title="No collection blockers" description="Approved bookings with missing payment will appear here." />}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Settle deposits</h2>
            <p className="text-xs text-[var(--text-tertiary)]">Returned rentals and held deposits that need a refund, partial refund, or applied charge decision.</p>
          </div>
          {risk.needsCheckout.slice(0, 6).map((booking) => (
            <RiskBookingRow key={booking.id} booking={booking} label="Needs checkout" tone="amber" amount={Number(booking.deposit_amount || 0)} action="Settle" />
          ))}
          {risk.needsCheckout.length === 0 && <EmptyState icon={ClipboardCheck} title="No deposits to settle" description="Returned rentals needing inspection and deposit decisions will appear here." />}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Long-term collections</h2>
            <p className="text-xs text-[var(--text-tertiary)]">Monthly renters past due or returned without settlement.</p>
          </div>
          {risk.longTermAtRisk.slice(0, 6).map((booking) => (
            <RiskBookingRow key={booking.id} booking={booking} label={booking.status === 'returned' ? 'Settle account' : 'Past due'} tone="red" amount={Number(booking.total_cost || 0)} action="Manage account">
              {booking.status === 'active' && (
                <>
                  <button type="button" className="btn-primary text-xs py-1.5" disabled={acting === `reminder-${booking.id}` || !booking.customers?.email} onClick={() => requestPaymentReminder(booking)}>
                    {acting === `reminder-${booking.id}` ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />} Send reminder
                  </button>
                  <button type="button" className="btn-secondary text-xs py-1.5" onClick={() => copyPaymentLink(booking)}>
                    <Copy size={13} /> Copy link
                  </button>
                </>
              )}
            </RiskBookingRow>
          ))}
          {risk.longTermAtRisk.length === 0 && <EmptyState icon={Clock} title="No long-term collection risk" description="Past-due monthly accounts and unsettled long-term returns will appear here." />}
        </section>
      </div>
      <ActionHistoryPanel entries={[...actionHistory, ...persistedHistory]} title="Collection action history" />
    </div>
  );
}

function AuditViewer() {
  const [filters, setFilters] = useState({
    booking_id: '',
    customer_id: '',
    operator: '',
    action_key: '',
    status: '',
  });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const loadAudit = async () => {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(
        Object.entries({ ...filters, limit: 100 }).filter(([, value]) => value !== '')
      );
      const res = await api.getMoneyActions(params);
      setEntries(normalizeAuditEntries(res?.data || []));
    } catch (err) {
      setError(err.message || 'Could not load audit records.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAudit(); }, []);

  const clearFilters = () => {
    setFilters({ booking_id: '', customer_id: '', operator: '', action_key: '', status: '' });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Backend audit viewer</p>
            <p className="text-xs text-[var(--text-tertiary)]">Filter persisted money actions by booking, customer, operator, action, or status.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={loadAudit} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
            Booking ID
            <input className="input text-sm" value={filters.booking_id} onChange={(e) => updateFilter('booking_id', e.target.value.trim())} placeholder="uuid" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
            Customer ID
            <input className="input text-sm" value={filters.customer_id} onChange={(e) => updateFilter('customer_id', e.target.value.trim())} placeholder="uuid" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
            Operator
            <input className="input text-sm" value={filters.operator} onChange={(e) => updateFilter('operator', e.target.value.trim())} placeholder="email search" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
            Action
            <input className="input text-sm" value={filters.action_key} onChange={(e) => updateFilter('action_key', e.target.value.trim())} placeholder="payment_reminder_sent" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
            Status
            <select className="input text-sm" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
              <option value="">Any</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={loadAudit} disabled={loading}>
            <Search size={14} /> Apply filters
          </button>
          <button type="button" className="btn-ghost text-[var(--text-secondary)]" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </div>

      <DataError error={error} />
      <AuditTrailPanel
        entries={entries}
        title="Filtered immutable audit records"
        emptyText={loading ? 'Loading audit records...' : 'No audit records match these filters.'}
        max={100}
      />
    </div>
  );
}

export default function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const paymentTabs = [
    { key: 'risk', label: 'Money at Risk', icon: AlertCircle },
    { key: 'ledger', label: 'Ledger', icon: CreditCard },
    { key: 'deposits', label: 'Deposits', icon: Shield },
    ...(isStripeProvider() ? [{ key: 'stripe', label: 'Stripe', icon: ExternalLink }] : []),
    { key: 'audit', label: 'Audit', icon: History },
  ];
  const tab = paymentTabs.some(item => item.key === rawTab) ? rawTab : 'risk';
  const [payments, setPayments] = useState([]);
  const [riskBookings, setRiskBookings] = useState([]);
  const [riskDeposits, setRiskDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskLoading, setRiskLoading] = useState(true);
  const [error, setError] = useState(null);
  const [riskError, setRiskError] = useState(null);

  const [refundData, setRefundData] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [notice, setNotice] = useState('');
  const [ledgerHistory, setLedgerHistory] = useState([]);
  const [moneyActions, setMoneyActions] = useState([]);

  const loadMoneyActions = async () => {
    try {
      const res = await api.getMoneyActions({ limit: 30 });
      setMoneyActions(normalizeAuditEntries(res?.data || []));
    } catch {
      setMoneyActions([]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getAllPayments({ limit: 100 });
      setPayments(res.data || []);
      await loadMoneyActions();
      setError(null);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const loadRiskData = async () => {
    setRiskLoading(true);
    try {
      const [bookRes, depRes] = await Promise.all([
        api.getBookings({ limit: 250 }),
        api.listDeposits({ status: 'held' }).catch(() => ({ data: [] })),
      ]);
      setRiskBookings(Array.isArray(bookRes) ? bookRes : (bookRes?.data || []));
      setRiskDeposits(depRes?.data || []);
      await loadMoneyActions();
      setRiskError(null);
    } catch (err) {
      setRiskError(err.message || 'Could not load money risk queues');
    }
    setRiskLoading(false);
  };

  useEffect(() => {
    loadData();
    loadRiskData();
  }, []);

  const openRefundModal = (payment) => {
    const childRefunds = payments.filter(p =>
      p.payment_type === 'refund' &&
      p.booking_id === payment.booking_id &&
      p.notes?.includes(`Refund for payment ${payment.id}`)
    );
    const totalRefunded = childRefunds.reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
    const maxRefund = payment.amount - totalRefunded;
    if (maxRefund <= 0) { setNotice('This payment has already been fully refunded.'); return; }
    setNotice('');
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
      setLedgerHistory((items) => [buildActionEntry({
        title: `${providerLabel(refundData.method)} refund issued`,
        subject: `${refundData?.bookings?.booking_code || refundData.id}`,
        amount: amt,
        auditDetail: `${refundReason.replaceAll('_', ' ')} refund sent to ${providerLabel(refundData.method)}.`,
      }), ...items].slice(0, 8));
      setNotice(`Refund submitted for ${refundData?.bookings?.booking_code || 'payment'}.`);
      closeRefundModal();
      await loadData();
    } catch (err) { setRefundError(err.message || 'Refund processing failed.'); }
    finally { setRefunding(false); }
  };

  return (
    <div className="page-shell lg:p-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>Payments</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {tab === 'risk'
              ? 'Collection, deposit, refund, and long-term money operations'
              : tab === 'deposits'
                ? 'Held deposits, settlement, and refunds'
                : tab === 'audit'
                  ? 'Immutable money-action history by booking, customer, and operator'
                  : tab === 'stripe'
                    ? 'Payment processor health, balances, charges, refunds, and configuration'
                    : 'Review all transactions and manage refunds'}
          </p>
        </div>
        {(tab === 'ledger' || tab === 'risk') && (
          <button className="btn-secondary" onClick={tab === 'risk' ? loadRiskData : loadData}>
            <RefreshCw size={14} /> Sync
          </button>
        )}
      </motion.div>

      <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-1">
        {paymentTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSearchParams(key === 'risk' ? {} : { tab: key })}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors"
            style={{
              color: tab === key ? 'var(--accent-color)' : 'var(--text-tertiary)',
              borderBottom: tab === key ? '2px solid var(--accent-color)' : '2px solid transparent',
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'risk' ? (
        <MoneyAtRiskPanel
          bookings={riskBookings}
          deposits={riskDeposits}
          loading={riskLoading}
          error={riskError}
          onRetry={loadRiskData}
          persistedHistory={moneyActions}
        />
      ) : tab === 'deposits' ? (
        <DepositsPanel />
      ) : tab === 'stripe' ? (
        <StripePanel embedded />
      ) : tab === 'audit' ? (
        <AuditViewer />
      ) : (
        <>

      <DataError error={error} />
      <InlineBanner message={notice} onDismiss={() => setNotice('')} />
      <ActionHistoryPanel entries={[...ledgerHistory, ...moneyActions]} title="Ledger action history" />

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
                  const refundable = canRefundPayment(payment);
                  const isRefund = payment.payment_type === 'refund';
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
                          {payment.method === 'stripe' ? <CreditCard size={13} style={{ color: '#818cf8' }} /> : <DollarSign size={13} style={{ color: '#22c55e' }} />}
                          <span className="text-xs">{payment.method}</span>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-right font-bold tabular-nums`} style={{ color: isRefund ? 'var(--danger-color)' : '#22c55e' }}>
                        {displayAmount}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {!isRefund && refundable && (
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
                            Refund
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
              const refundable = canRefundPayment(payment);
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
                  {!isRefund && refundable && (
                    <button
                      onClick={() => openRefundModal(payment)}
                      className="mt-2 w-full h-10 rounded-lg text-xs font-semibold transition-colors"
                      style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)', border: '1px solid rgba(30,58,95,0.2)' }}
                    >
                      Issue Refund
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Refund Modal */}
      <Modal open={!!refundData} onClose={closeRefundModal} title={`Issue ${providerLabel(refundData?.method)} Refund`}>
        <form onSubmit={handleRefundSubmit} className="space-y-6">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Booking: <span className="mono-code font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              {refundData?.bookings?.booking_code}
            </span>
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
              This will immediately reverse funds on the customer's card via {providerLabel(refundData?.method)}.
              {refundData?.payment_type === 'deposit' ? ' This refunds the security deposit portion of the original charge.' : ''}
              {' '}This action cannot be undone.
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
        </>
      )}
    </div>
  );
}
