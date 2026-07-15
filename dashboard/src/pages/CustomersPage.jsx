import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  UserRoundCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { portalPreviewApi } from '../api/portalPreview';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import DataError from '../components/shared/DataError';
import { format } from 'date-fns';
import { formatDateOnly } from '../lib/dates';

const EASE = [0.25, 1, 0.5, 1];

const FILTERS = [
  { key: 'all', label: 'All', icon: Users },
  { key: 'active', label: 'Active', icon: CalendarDays },
  { key: 'payment', label: 'Payment Risk', icon: CreditCard },
  { key: 'trusted', label: 'Trusted', icon: BadgeCheck },
  { key: 'docs', label: 'Needs Docs', icon: FileText },
  { key: 'sms', label: 'SMS Opt-Out', icon: MessageSquare },
];

function fullName(customer) {
  return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
}

function initials(customer) {
  const first = customer.first_name?.[0] || '?';
  const last = customer.last_name?.[0] || '';
  return `${first}${last}`.toUpperCase();
}

function money(value, maximumFractionDigits = 0) {
  return Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  });
}

function bookingWindow(booking) {
  if (!booking?.pickup_date) return 'No dates set';
  if (!booking?.return_date) return formatDateOnly(booking.pickup_date, 'MMM d');
  return `${formatDateOnly(booking.pickup_date, 'MMM d')} -> ${formatDateOnly(booking.return_date, 'MMM d')}`;
}

function vehicleName(booking) {
  const vehicle = booking?.vehicle || booking?.vehicles;
  if (!vehicle) return booking?.booking_code || 'Vehicle pending';
  if (typeof vehicle === 'string') return vehicle;
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.nickname || booking?.booking_code || 'Vehicle pending';
}

function primaryBooking(customer) {
  return customer.current_booking || customer.next_booking || customer.latest_booking || null;
}

function getCustomerTone(customer) {
  if (customer.payment_due_count > 0) return { label: 'Payment due', tone: 'amber', icon: CreditCard };
  if (customer.insurance_review_count > 0) return { label: 'Insurance review', tone: 'red', icon: ShieldCheck };
  if (customer.needs_docs_count > 0) return { label: 'Needs docs', tone: 'violet', icon: FileText };
  if (customer.active_rentals > 0) return { label: 'Active rental', tone: 'emerald', icon: CalendarDays };
  if (customer.upcoming_rentals > 0) return { label: 'Upcoming', tone: 'sky', icon: CalendarDays };
  if (customer.is_trusted) return { label: 'Trusted', tone: 'emerald', icon: BadgeCheck };
  return { label: 'Customer', tone: 'slate', icon: Users };
}

function toneClass(tone) {
  const tones = {
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    slate: 'bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  };
  return tones[tone] || tones.slate;
}

function VerificationChip({ label, state, icon: Icon }) {
  const styles = {
    good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    missing: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    neutral: 'bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  };
  const FallbackIcon = state === 'missing' ? XCircle : CheckCircle2;
  const DisplayIcon = Icon || FallbackIcon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[state] || styles.neutral}`}>
      <DisplayIcon size={11} />
      {label}
    </span>
  );
}

function VerificationRow({ customer }) {
  const v = customer.verification || {};
  const insuranceState = v.insurance_verified ? 'good' : v.insurance_on_file ? 'warn' : 'missing';
  return (
    <div className="flex flex-wrap gap-1.5">
      <VerificationChip label="ID" state={v.id_on_file ? 'good' : 'missing'} />
      <VerificationChip label="Insurance" state={insuranceState} icon={ShieldCheck} />
      <VerificationChip label="Agreement" state={v.agreement_on_file ? 'good' : 'missing'} icon={FileText} />
      <VerificationChip label={v.sms_opt_out ? 'SMS off' : 'SMS'} state={v.sms_opt_out ? 'warn' : 'good'} icon={MessageSquare} />
    </div>
  );
}

function StatTile({ icon: Icon, label, value, subtext, tone = 'slate' }) {
  return (
    <div className={`rounded-xl border p-4 ${toneClass(tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <Icon size={17} />
        <span className="text-2xl font-bold tabular-nums">{value}</span>
      </div>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      {subtext && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtext}</p>}
    </div>
  );
}

function QuickActions({ customer, onPortalPreview, portalPreviewing }) {
  const hasPortalBooking = !!primaryBooking(customer);
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPortalPreview(customer);
        }}
        disabled={!hasPortalBooking || portalPreviewing}
        className="btn-ghost h-9 w-9 justify-center p-0 disabled:cursor-not-allowed disabled:opacity-40"
        title={hasPortalBooking ? 'Open customer portal preview' : 'No customer portal booking yet'}
      >
        {portalPreviewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
      </button>
      {customer.phone && (
        <a href={`tel:${customer.phone}`} className="btn-ghost h-9 w-9 justify-center p-0" title={`Call ${fullName(customer)}`} onClick={(event) => event.stopPropagation()}>
          <Phone size={14} />
        </a>
      )}
      {customer.email && (
        <a href={`mailto:${customer.email}`} className="btn-ghost h-9 w-9 justify-center p-0" title={`Email ${fullName(customer)}`} onClick={(event) => event.stopPropagation()}>
          <Mail size={14} />
        </a>
      )}
      <a href={`/messaging?customer=${customer.id}`} className="btn-ghost h-9 w-9 justify-center p-0" title="Open messaging" onClick={(event) => event.stopPropagation()}>
        <MessageSquare size={14} />
      </a>
      <span className="btn-secondary h-9 w-9 justify-center p-0" title="Open customer">
        <ArrowRight size={14} />
      </span>
    </div>
  );
}

function CustomerIdentity({ customer }) {
  const tone = getCustomerTone(customer);
  const ToneIcon = tone.icon;
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{ background: customer.is_trusted ? 'linear-gradient(135deg, #13294B, #22c55e)' : 'linear-gradient(135deg, #13294B, #8B5CF6)' }}
      >
        {initials(customer)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-bold tracking-tight text-[var(--text-primary)] truncate">{fullName(customer)}</p>
          {customer.is_trusted && <Star size={13} className="text-amber-400 shrink-0" fill="currentColor" />}
        </div>
        <p className="text-xs text-[var(--text-tertiary)] truncate">{customer.email || 'No email'}{customer.phone ? ` · ${customer.phone}` : ''}</p>
        <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass(tone.tone)}`}>
          <ToneIcon size={11} />
          {tone.label}
        </span>
      </div>
    </div>
  );
}

function BookingSummary({ customer }) {
  const booking = primaryBooking(customer);
  if (!booking) {
    return (
      <div className="text-sm text-[var(--text-tertiary)]">
        No booking history yet
      </div>
    );
  }
  const label = customer.current_booking ? 'Current' : customer.next_booking ? 'Next' : 'Latest';
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label} booking</p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)] truncate">{vehicleName(booking)}</p>
      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
        <span className="font-mono">{booking.booking_code}</span> · {bookingWindow(booking)}
      </p>
    </div>
  );
}

function CustomerRow({ customer, onOpen, onPortalPreview, portalPreviewing }) {
  return (
    <tr className="cursor-pointer transition-colors hover:bg-[var(--bg-card-hover)]" onClick={() => onOpen(customer.id)}>
      <td className="px-5 py-4">
        <CustomerIdentity customer={customer} />
      </td>
      <td className="px-5 py-4">
        <div className="space-y-2">
          <VerificationRow customer={customer} />
          {customer.risk_flags?.length > 0 && (
            <p className="text-xs text-[var(--text-secondary)]">
              {customer.payment_due_count ? `${customer.payment_due_count} payment blocker${customer.payment_due_count === 1 ? '' : 's'}` : ''}
              {customer.payment_due_count && customer.needs_docs_count ? ' · ' : ''}
              {customer.needs_docs_count ? `${customer.needs_docs_count} documentation gap${customer.needs_docs_count === 1 ? '' : 's'}` : ''}
            </p>
          )}
        </div>
      </td>
      <td className="px-5 py-4 max-w-[260px]">
        <BookingSummary customer={customer} />
      </td>
      <td className="px-5 py-4">
        <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{money(customer.total_revenue || 0)}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{customer.total_rentals || 0} rental{customer.total_rentals === 1 ? '' : 's'}</p>
      </td>
      <td className="px-5 py-4 text-right">
        <QuickActions customer={customer} onPortalPreview={onPortalPreview} portalPreviewing={portalPreviewing} />
      </td>
    </tr>
  );
}

function CustomerCard({ customer, onOpen, onPortalPreview, portalPreviewing }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(customer.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(customer.id);
      }}
      className="w-full text-left rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-card-hover)]"
    >
      <div className="flex items-start justify-between gap-3">
        <CustomerIdentity customer={customer} />
        <QuickActions customer={customer} onPortalPreview={onPortalPreview} portalPreviewing={portalPreviewing} />
      </div>
      <div className="mt-4 space-y-3">
        <VerificationRow customer={customer} />
        <BookingSummary customer={customer} />
        <div className="grid grid-cols-3 gap-3 border-t border-[var(--border-subtle)] pt-3">
          <div>
            <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{customer.total_rentals || 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Rentals</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(customer.total_revenue || 0)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Spent</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{customer.created_at ? format(new Date(customer.created_at), 'MMM yy') : '-'}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Since</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [portalPreviewingId, setPortalPreviewingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.getCustomers({ q, limit: 100 });
        setCustomers(data);
      } catch (e) {
        console.error(e);
        setLoadError(e?.message || 'Could not load customers');
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [q, retryTick]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (filter === 'active') return customer.active_rentals > 0 || customer.upcoming_rentals > 0;
      if (filter === 'payment') return customer.payment_due_count > 0;
      if (filter === 'trusted') return !!customer.is_trusted;
      if (filter === 'docs') return customer.needs_docs_count > 0 || customer.insurance_review_count > 0;
      if (filter === 'sms') return !!customer.sms_opt_out;
      return true;
    });
  }, [customers, filter]);

  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter((customer) => customer.active_rentals > 0 || customer.upcoming_rentals > 0).length,
    payment: customers.filter((customer) => customer.payment_due_count > 0).length,
    docs: customers.filter((customer) => customer.needs_docs_count > 0 || customer.insurance_review_count > 0).length,
    trusted: customers.filter((customer) => customer.is_trusted).length,
    revenue: customers.reduce((sum, customer) => sum + Number(customer.total_revenue || 0), 0),
  }), [customers]);

  const filterCounts = {
    all: stats.total,
    active: stats.active,
    payment: stats.payment,
    trusted: stats.trusted,
    docs: stats.docs,
    sms: customers.filter((customer) => customer.sms_opt_out).length,
  };

  const openCustomer = (id) => navigate(`/customers/${id}`);

  async function openPortalPreview(customer) {
    const previewWindow = window.open('about:blank', '_blank');
    setPortalPreviewingId(customer.id);
    setLoadError(null);
    try {
      const result = await portalPreviewApi.forCustomer(customer.id);
      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.location.href = result.url;
      } else {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      if (previewWindow) previewWindow.close();
      setLoadError(e?.message || 'Could not open customer portal preview');
    } finally {
      setPortalPreviewingId(null);
    }
  }

  return (
    <div className="page-shell lg:p-8 pb-[calc(140px+env(safe-area-inset-bottom,0px))] lg:pb-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-color)]">Customer operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">Customers</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Relationship, verification, payment, and rental readiness in one workspace.
          </p>
        </div>
        <button type="button" className="btn-secondary w-fit" onClick={() => setRetryTick((tick) => tick + 1)}>
          <RefreshCw size={14} /> Refresh
        </button>
      </motion.div>

      <DataError message={loadError} onRetry={() => setRetryTick((tick) => tick + 1)} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={Users} label="Customers" value={stats.total} subtext={`${filteredCustomers.length} in current view`} />
        <StatTile icon={CalendarDays} label="Active / Upcoming" value={stats.active} subtext="Needs operational attention" tone={stats.active ? 'sky' : 'slate'} />
        <StatTile icon={CreditCard} label="Payment Risk" value={stats.payment} subtext="Approved but unpaid" tone={stats.payment ? 'amber' : 'slate'} />
        <StatTile icon={AlertTriangle} label="Doc Gaps" value={stats.docs} subtext="ID, agreement, or insurance" tone={stats.docs ? 'red' : 'slate'} />
        <StatTile icon={DollarSign} label="Lifetime Value" value={money(stats.revenue)} subtext="Loaded customers" tone="emerald" />
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 xl:min-w-[360px]">
            <Search size={15} className="text-[var(--text-tertiary)]" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none"
              placeholder="Search name, email, or phone..."
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 xl:pb-0">
            {FILTERS.map(({ key, label, icon: Icon }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    active ? 'bg-[var(--accent-color)] text-[var(--accent-fg)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-[var(--bg-card-hover)] text-[var(--text-tertiary)]'}`}>
                    {filterCounts[key] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={UserRoundCheck}
          title="No customers match this view"
          description={q || filter !== 'all' ? 'Adjust the search or filter to widen the customer list.' : 'Customers will appear here once bookings come in.'}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] lg:block">
            <div className="scroll-x-contained">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                  <tr>
                    {['Customer', 'Status & Verification', 'Latest / Next Trip', 'Revenue', 'Actions'].map((heading) => (
                      <th key={heading} className={`px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] ${heading === 'Actions' ? 'text-right' : 'text-left'}`}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredCustomers.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      onOpen={openCustomer}
                      onPortalPreview={openPortalPreview}
                      portalPreviewing={portalPreviewingId === customer.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 lg:hidden">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onOpen={openCustomer}
                onPortalPreview={openPortalPreview}
                portalPreviewing={portalPreviewingId === customer.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
