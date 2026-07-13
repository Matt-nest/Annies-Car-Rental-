import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  CreditCard,
  DoorOpen,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ReceiptText,
  UserPlus,
  WalletCards,
} from 'lucide-react';
import { formatDateOnly, localTodayYMD } from '../lib/dates';
import { api } from '../api/client';
import brand from '../config/brand';
import StatusBadge from '../components/shared/StatusBadge';
import DataError from '../components/shared/DataError';
import { SkeletonTable } from '../components/shared/Skeleton';
import Modal from '../components/shared/Modal';
import InlineBanner from '../components/shared/InlineBanner';
import LongTermOnboardModal from '../components/portal/LongTermOnboardModal';
import { getCustomerName, getVehicleName, toneClasses } from '../lib/bookingOps';

const ACTIVE_STATUSES = ['pending_approval', 'approved', 'confirmed', 'ready_for_pickup', 'active', 'returned'];
const DAY_MS = 24 * 60 * 60 * 1000;

function portalUrl(code) {
  return `${brand.siteUrl}/portal?code=${encodeURIComponent(code)}`;
}

function money(value, maximumFractionDigits = 0) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits });
}

function daysUntil(dateStr, today = localTodayYMD()) {
  if (!dateStr) return null;
  const end = new Date(`${dateStr}T12:00:00`).getTime();
  const start = new Date(`${today}T12:00:00`).getTime();
  if (Number.isNaN(end) || Number.isNaN(start)) return null;
  return Math.ceil((end - start) / DAY_MS);
}

function accountMoneyState(booking, today = localTodayYMD()) {
  const renewalDays = daysUntil(booking.return_date, today);
  const monthlyRent = Number(booking.total_cost || 0);
  const deposit = Number(booking.deposit_amount || 0);
  const isPastDue = booking.status === 'active' && renewalDays != null && renewalDays < 0;
  const isReturned = booking.status === 'returned';
  const needsCollection = getAccountState(booking, today).key === 'onboarding' || isPastDue;

  if (isPastDue) {
    return {
      label: 'Collect renewal',
      tone: 'red',
      amount: monthlyRent,
      description: `${Math.abs(renewalDays)} day${Math.abs(renewalDays) === 1 ? '' : 's'} past due`,
    };
  }

  if (isReturned) {
    return {
      label: 'Settle deposit',
      tone: 'amber',
      amount: deposit,
      description: 'Inspection, charges, refund, or close-out',
    };
  }

  if (needsCollection) {
    return {
      label: 'Onboarding balance',
      tone: 'amber',
      amount: monthlyRent + deposit,
      description: 'Payment, agreement, and handoff still open',
    };
  }

  return {
    label: 'Account value',
    tone: renewalDays != null && renewalDays <= 7 ? 'purple' : 'slate',
    amount: monthlyRent,
    description: renewalDays == null ? 'No renewal date' : `${renewalDays} day${renewalDays === 1 ? '' : 's'} until renewal`,
  };
}

function getAccountState(booking, today) {
  const days = daysUntil(booking.return_date, today);

  if (booking.status === 'returned') {
    return {
      key: 'checkout',
      label: 'Needs checkout',
      tone: 'orange',
      action: 'Inspect and settle return',
      priority: 1,
    };
  }

  if (['pending_approval', 'approved', 'confirmed', 'ready_for_pickup'].includes(booking.status)) {
    return {
      key: 'onboarding',
      label: 'Onboarding',
      tone: 'amber',
      action: 'Finish payment, agreement, and handoff',
      priority: 2,
    };
  }

  if (booking.status === 'active' && days != null && days < 0) {
    return {
      key: 'past_due',
      label: 'Past due renewal',
      tone: 'red',
      action: 'Renew, collect, or recover vehicle',
      priority: 0,
    };
  }

  if (booking.status === 'active' && days != null && days <= 7) {
    return {
      key: 'renew_soon',
      label: 'Renewal soon',
      tone: 'purple',
      action: 'Confirm next month',
      priority: 3,
    };
  }

  if (booking.status === 'active') {
    return {
      key: 'active',
      label: 'Active account',
      tone: 'emerald',
      action: 'Monitor account',
      priority: 4,
    };
  }

  return {
    key: 'review',
    label: 'Review',
    tone: 'slate',
    action: 'Review account',
    priority: 5,
  };
}

function compareAccounts(a, b, today) {
  const as = getAccountState(a, today);
  const bs = getAccountState(b, today);
  if (as.priority !== bs.priority) return as.priority - bs.priority;
  return (a.return_date || '9999-12-31').localeCompare(b.return_date || '9999-12-31');
}

function StatTile({ icon: Icon, label, value, subtext, tone = 'slate' }) {
  const toneMap = {
    red: 'border-red-500/20 bg-red-500/10 text-red-500',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    purple: 'border-purple-500/20 bg-purple-500/10 text-purple-500',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
    slate: 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]',
  };

  return (
    <div className={`rounded-xl border px-3 py-3 ${toneMap[tone] || toneMap.slate}`}>
      <div className="flex items-center justify-between gap-3">
        <Icon size={17} />
        <span className="text-xl font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider mt-1 text-[var(--text-tertiary)]">{label}</p>
      {subtext && <p className="text-xs mt-0.5 text-[var(--text-secondary)]">{subtext}</p>}
    </div>
  );
}

function PaymentPlanActions({ booking, onRefresh }) {
  const [state, setState] = useState({ loading: true, label: 'Checking plan', tone: 'slate', detail: '' });
  const [planData, setPlanData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [interval, setInterval] = useState('monthly');
  const [installmentCount, setInstallmentCount] = useState('1');
  const [startDate, setStartDate] = useState(localTodayYMD());
  const [acting, setActing] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const bookingId = booking.id;

  const loadPlan = useCallback(() => {
    setState({ loading: true, label: 'Checking plan', tone: 'slate', detail: '' });
    setError('');
    api.getPaymentPlan(bookingId)
      .then((plan) => {
        setPlanData(plan);
        const installments = Array.isArray(plan?.installments) ? plan.installments : [];
        const unpaid = installments.filter((item) => !['paid', 'completed', 'succeeded', 'cancelled'].includes(item.status));
        const overdue = unpaid.filter((item) => item.due_date && item.due_date < localTodayYMD());
        if (!plan?.plan?.id) {
          setState({ loading: false, label: 'No payment plan', tone: 'slate', detail: 'Create for split-pay or exception accounts.' });
        } else if (overdue.length) {
          const amount = overdue.reduce((sum, item) => sum + Number(item.amount_cents || item.amount || 0), 0);
          setState({ loading: false, label: 'Plan overdue', tone: 'red', detail: `${overdue.length} installment${overdue.length === 1 ? '' : 's'} · ${money(amount / 100, 2)}` });
        } else if (unpaid.length) {
          setState({ loading: false, label: 'Plan active', tone: 'purple', detail: `${unpaid.length} installment${unpaid.length === 1 ? '' : 's'} remaining` });
        } else {
          setState({ loading: false, label: 'Plan paid', tone: 'emerald', detail: 'All installments collected.' });
        }
      })
      .catch(() => {
        setState({ loading: false, label: 'Plan unavailable', tone: 'slate', detail: 'Open booking to manage payments.' });
      });
  }, [bookingId]);

  useEffect(() => {
    let mounted = true;
    if (mounted) loadPlan();
    return () => { mounted = false; };
  }, [loadPlan]);

  const tone = toneClasses(state.tone);
  const chargeable = (planData?.installments || []).find((item) => ['failed', 'scheduled'].includes(item.status));
  const hasActivePlan = !!planData?.plan?.id && planData.plan.status === 'active';

  async function createPlan(event) {
    event.preventDefault();
    setActing('create');
    setError('');
    setMessage('');
    try {
      await api.createPaymentPlan(bookingId, { interval, installmentCount: Number(installmentCount), startDate });
      setModalOpen(false);
      setMessage('Payment plan created.');
      await loadPlan();
      onRefresh?.();
    } catch (err) {
      setError(err?.message || 'Could not create payment plan.');
    }
    setActing('');
  }

  async function chargeNext() {
    if (!chargeable?.id) return;
    const amount = Number(chargeable.amount_cents || chargeable.amount || 0) / 100;
    if (!confirm(`Charge ${money(amount, 2)} now to the card on file for ${booking.booking_code}?`)) return;
    setActing('charge');
    setError('');
    setMessage('');
    try {
      const result = await api.chargeInstallment(chargeable.id);
      if (result?.status === 'failed') setError(result.reason || 'Installment charge failed.');
      else setMessage('Installment charge submitted.');
      await loadPlan();
      onRefresh?.();
    } catch (err) {
      setError(err?.message || 'Installment charge failed.');
    }
    setActing('');
  }

  async function sendRenewalInvoice() {
    if (!confirm(`Generate and send renewal invoice for ${booking.booking_code}?`)) return;
    setActing('invoice');
    setError('');
    setMessage('');
    try {
      const invoice = await api.generateInvoice(bookingId);
      const invoiceId = invoice?.id || invoice?.invoice?.id;
      if (invoiceId) await api.sendInvoice(invoiceId);
      setMessage('Renewal invoice generated and sent.');
      onRefresh?.();
    } catch (err) {
      setError(err?.message || 'Invoice send failed.');
    }
    setActing('');
  }

  return (
    <div className="rounded-lg bg-[var(--bg-card-hover)] px-3 py-2 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Payment Plan</p>
      <p className={`text-xs font-semibold mt-0.5 flex items-center gap-1 ${tone.text}`}>
        {state.loading ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
        {state.label}
      </p>
      {state.detail && <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{state.detail}</p>}
      <InlineBanner message={error} onDismiss={() => setError('')} />
      <InlineBanner message={message} tone="success" onDismiss={() => setMessage('')} />
      <div className="flex flex-wrap gap-1.5">
        {!hasActivePlan && (
          <button type="button" className="btn-secondary text-[11px] py-1 px-2" onClick={() => setModalOpen(true)}>
            Create plan
          </button>
        )}
        {chargeable && (
          <button type="button" className="btn-primary text-[11px] py-1 px-2" disabled={acting === 'charge'} onClick={chargeNext}>
            {acting === 'charge' && <Loader2 size={11} className="animate-spin" />} Charge next
          </button>
        )}
        <button type="button" className="btn-ghost text-[11px] py-1 px-2" disabled={acting === 'invoice'} onClick={sendRenewalInvoice}>
          {acting === 'invoice' && <Loader2 size={11} className="animate-spin" />} Send invoice
        </button>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Payment Plan">
        <form onSubmit={createPlan} className="space-y-5">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-hover)] p-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{getCustomerName(booking)} · {booking.booking_code}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Splits the current outstanding rental balance into scheduled charges.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Cadence</label>
              <select className="input" value={interval} onChange={(e) => setInterval(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="label">Installments</label>
              <input className="input" type="number" min="1" max="60" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
            </div>
            <div>
              <label className="label">First due</label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-600">Collection workflow</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Charging an installment later may charge the saved card immediately. Use only after the renter has agreed to these terms.
            </p>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={acting === 'create'}>
              {acting === 'create' && <Loader2 size={14} className="animate-spin" />} Create Plan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function RenterCard({ booking, today, onRefresh }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notes, setNotes] = useState(booking.portal_notes || '');
  const c = booking.customers || {};
  const state = getAccountState(booking, today);
  const moneyState = accountMoneyState(booking, today);
  const moneyTone = toneClasses(moneyState.tone);
  const tone = toneClasses(state.tone);
  const url = portalUrl(booking.booking_code);
  const renewalDays = daysUntil(booking.return_date, today);
  const periodLabel = booking.pickup_date && booking.return_date
    ? `${formatDateOnly(booking.pickup_date)} -> ${formatDateOnly(booking.return_date)}`
    : 'Dates TBD';

  useEffect(() => {
    setNotes(booking.portal_notes || '');
  }, [booking.id, booking.portal_notes]);

  function copyLogin() {
    const text = `Booking code: ${booking.booking_code}\nEmail: ${c.email || ''}\nPortal: ${url}`;
    navigator.clipboard.writeText(text);
    setCopied('login');
    setTimeout(() => setCopied(''), 2000);
  }

  function copyPortal() {
    navigator.clipboard.writeText(url);
    setCopied('link');
    setTimeout(() => setCopied(''), 2000);
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await api.updateBooking(booking.id, { portal_notes: notes });
      onRefresh();
    } catch { /* keep the card usable even if notes save fails */ }
    setSavingNotes(false);
  }

  return (
    <article className={`rounded-xl border ${tone.border} bg-[var(--bg-card)] p-4 sm:p-5 space-y-4`}>
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-[var(--text-primary)] truncate">{getCustomerName(booking)}</p>
            <StatusBadge status={booking.status} size="xs" />
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${tone.bg} ${tone.text}`}>
              {state.label}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {getVehicleName(booking)} · <span className="font-mono">{booking.booking_code}</span>
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            {periodLabel}
            {booking.total_cost != null && (
              <> · <span className="tabular-nums font-medium">{money(booking.total_cost, 2)}</span></>
            )}
          </p>
          {(c.email || c.phone) && (
            <p className="text-xs text-[var(--text-tertiary)] truncate">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 shrink-0">
          <button type="button" className="btn-primary text-xs py-2 justify-center" onClick={copyLogin}>
            {copied === 'login' ? <Check size={14} /> : <Copy size={14} />} Copy login
          </button>
          <button type="button" className="btn-secondary text-xs py-2 justify-center" onClick={copyPortal}>
            {copied === 'link' ? <Check size={14} /> : <Copy size={14} />} Link
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="btn-ghost text-xs py-2 justify-center">
            <ExternalLink size={14} /> Open
          </a>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-[var(--bg-card-hover)] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Next Action</p>
          <p className="text-xs font-semibold mt-0.5 text-[var(--text-primary)]">{state.action}</p>
        </div>
        <div className="rounded-lg bg-[var(--bg-card-hover)] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Renewal</p>
          <p className="text-xs font-semibold mt-0.5 text-[var(--text-primary)]">
            {renewalDays == null ? 'Not scheduled' : renewalDays < 0 ? `${Math.abs(renewalDays)} day${Math.abs(renewalDays) === 1 ? '' : 's'} past due` : `${renewalDays} day${renewalDays === 1 ? '' : 's'} left`}
          </p>
        </div>
        <div className="rounded-lg bg-[var(--bg-card-hover)] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Monthly Rent</p>
          <p className="text-xs font-semibold mt-0.5 text-[var(--text-primary)]">{money(booking.total_cost || 0, 2)}</p>
        </div>
        <div className={`rounded-lg px-3 py-2 ${moneyTone.bg}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{moneyState.label}</p>
          <p className={`text-xs font-semibold mt-0.5 tabular-nums ${moneyTone.text}`}>{money(moneyState.amount, 2)}</p>
          <p className="text-[11px] mt-0.5 text-[var(--text-tertiary)]">{moneyState.description}</p>
        </div>
        <PaymentPlanActions booking={booking} onRefresh={onRefresh} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => navigate(`/bookings/${booking.id}`)}>
          Manage account <ChevronRight size={12} className="inline" />
        </button>
        {c.id && (
          <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => navigate('/messaging', { state: { customerId: c.id } })}>
            <MessageSquare size={12} className="inline mr-1" /> Message
          </button>
        )}
        <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => navigate(`/bookings/${booking.id}`, { state: { openExtend: true } })}>
          <CalendarPlus size={12} className="inline mr-1" /> Renew / extend
        </button>
        <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => navigate(`/bookings/${booking.id}`, { state: { activeTab: 'invoice' } })}>
          <ReceiptText size={12} className="inline mr-1" /> Money
        </button>
        {['returned', 'active'].includes(booking.status) && (
          <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => navigate(`/bookings/${booking.id}`, { state: { activeTab: 'checkout' } })}>
            <ClipboardCheck size={12} className="inline mr-1" /> Checkout
          </button>
        )}
      </div>

      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Account notes</label>
        <div className="flex gap-2 mt-1">
          <textarea
            className="input text-sm resize-none flex-1"
            rows={2}
            placeholder="Renewal terms, payment schedule, gate code, maintenance notes..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <button type="button" className="btn-secondary text-xs shrink-0 self-end" disabled={savingNotes} onClick={saveNotes}>
            {savingNotes ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function PortalPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('attention');
  const [renters, setRenters] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardPrefill, setOnboardPrefill] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [bookRes, inq] = await Promise.all([
        api.getBookings({ rental_type: 'long_term', limit: 150 }),
        api.getMonthlyInquiries({ status: 'new' }).catch(() => []),
      ]);
      const list = Array.isArray(bookRes) ? bookRes : (bookRes?.data || []);
      setRenters(list.filter(b => ACTIVE_STATUSES.includes(b.status)));
      setInquiries(Array.isArray(inq) ? inq : []);
    } catch (e) {
      setLoadError(e?.message || 'Could not load long-term account data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = localTodayYMD();
  const q = query.trim().toLowerCase();

  const filteredRenters = useMemo(() => {
    const base = [...renters].sort((a, b) => compareAccounts(a, b, today));
    if (!q) return base;
    return base.filter((booking) => {
      const haystack = [
        getCustomerName(booking),
        getVehicleName(booking),
        booking.booking_code,
        booking.customers?.email,
        booking.customers?.phone,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [renters, q, today]);

  const buckets = useMemo(() => {
    const attention = filteredRenters.filter((b) => ['past_due', 'onboarding', 'checkout'].includes(getAccountState(b, today).key));
    const renewals = filteredRenters.filter((b) => getAccountState(b, today).key === 'renew_soon');
    const active = filteredRenters.filter((b) => getAccountState(b, today).key === 'active');
    return { attention, renewals, active };
  }, [filteredRenters, today]);

  const stats = useMemo(() => {
    const activeAccounts = renters.filter((b) => b.status === 'active');
    const monthlyRunRate = activeAccounts.reduce((sum, b) => sum + Number(b.total_cost || 0), 0);
    const pastDue = renters.filter((b) => getAccountState(b, today).key === 'past_due').length;
    const pastDueValue = renters
      .filter((b) => getAccountState(b, today).key === 'past_due')
      .reduce((sum, b) => sum + Number(b.total_cost || 0), 0);
    const renewalSoon = renters.filter((b) => getAccountState(b, today).key === 'renew_soon').length;
    const renewalValue = renters
      .filter((b) => getAccountState(b, today).key === 'renew_soon')
      .reduce((sum, b) => sum + Number(b.total_cost || 0), 0);
    const attention = renters.filter((b) => ['past_due', 'onboarding', 'checkout'].includes(getAccountState(b, today).key)).length;
    return { activeAccounts: activeAccounts.length, monthlyRunRate, pastDue, pastDueValue, renewalSoon, renewalValue, attention };
  }, [renters, today]);

  const tabs = [
    { key: 'attention', label: `Needs attention (${buckets.attention.length})`, items: buckets.attention },
    { key: 'renewals', label: `Renewal soon (${buckets.renewals.length})`, items: buckets.renewals },
    { key: 'accounts', label: `Active accounts (${buckets.active.length})`, items: buckets.active },
    { key: 'leads', label: `New leads${inquiries.length ? ` (${inquiries.length})` : ''}`, items: [] },
  ];
  const activeTab = tabs.find((t) => t.key === tab) || tabs[0];

  return (
    <div className="page-shell lg:p-8 space-y-6 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[var(--text-primary)]">
            <DoorOpen size={24} className="text-[var(--accent-color)]" />
            Long-Term Account Center
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">
            Manage monthly renters as accounts: renewals, past-due periods, portal access, notes, and customer follow-up.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 min-w-0 sm:min-w-[300px]"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <Search size={15} className="text-[var(--text-tertiary)] shrink-0" />
            <input
              className="bg-transparent text-sm outline-none flex-1 min-w-0 text-[var(--text-primary)]"
              placeholder="Search account, car, code, phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="button" className="btn-secondary justify-center" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" className="btn-primary justify-center" onClick={() => { setOnboardPrefill(null); setOnboardOpen(true); }}>
            <UserPlus size={15} /> Onboard renter
          </button>
        </div>
      </div>

      <DataError message={loadError} onRetry={load} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={AlertTriangle} label="Attention" value={stats.attention} tone={stats.attention ? 'amber' : 'slate'} />
        <StatTile icon={AlertTriangle} label="Past Due" value={stats.pastDue} subtext={stats.pastDue ? `${money(stats.pastDueValue, 2)} to collect` : 'No overdue accounts'} tone={stats.pastDue ? 'red' : 'slate'} />
        <StatTile icon={CalendarClock} label="Renew Soon" value={stats.renewalSoon} subtext={stats.renewalSoon ? `${money(stats.renewalValue, 2)} renewal value` : 'No near renewals'} tone={stats.renewalSoon ? 'purple' : 'slate'} />
        <StatTile icon={DoorOpen} label="Active" value={stats.activeAccounts} tone="emerald" />
        <StatTile icon={WalletCards} label="Monthly Run Rate" value={money(stats.monthlyRunRate)} subtext="active accounts" tone="slate" />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-px">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'text-[var(--accent-color)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] border-b-transparent -mb-px'
                : 'text-[var(--text-tertiary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={4} cols={3} />
      ) : tab === 'leads' ? (
        <div className="space-y-3">
          {inquiries.length === 0 ? (
            <div className="card p-10 text-center">
              <CalendarClock size={30} className="mx-auto text-[var(--text-tertiary)]" />
              <p className="text-sm font-medium text-[var(--text-primary)] mt-2">No new monthly leads.</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">New monthly inquiries will appear here for fast onboarding.</p>
            </div>
          ) : inquiries.map(inq => (
            <div key={inq.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--text-primary)]">{inq.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{inq.email} · {inq.phone}</p>
                {inq.message && <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{inq.message}</p>}
              </div>
              <button
                type="button"
                className="btn-primary text-xs shrink-0"
                onClick={() => {
                  const parts = (inq.name || '').trim().split(/\s+/);
                  setOnboardPrefill({
                    firstName: parts[0] || '',
                    lastName: parts.slice(1).join(' ') || '',
                    email: inq.email || '',
                    phone: inq.phone || '',
                  });
                  setOnboardOpen(true);
                }}
              >
                Onboard
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost text-xs w-full" onClick={() => navigate('/monthly-inquiries')}>
            View all monthly leads →
          </button>
        </div>
      ) : activeTab.items.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <DoorOpen size={32} className="mx-auto text-[var(--text-tertiary)]" />
          <p className="text-sm font-medium text-[var(--text-primary)]">No long-term accounts in this queue</p>
          <p className="text-xs text-[var(--text-tertiary)] max-w-sm mx-auto">
            Accounts appear here when they match the selected operational state.
          </p>
          <button type="button" className="btn-primary" onClick={() => setOnboardOpen(true)}>Onboard renter</button>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab.items.map(b => (
            <RenterCard key={b.id} booking={b} today={today} onRefresh={load} />
          ))}
        </div>
      )}

      <LongTermOnboardModal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onCreated={load}
        initialCustomer={onboardPrefill}
      />
    </div>
  );
}
