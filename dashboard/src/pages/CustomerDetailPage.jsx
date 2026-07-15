import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Home,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ReceiptText,
  ScanLine,
  Send,
  Shield,
  ShieldCheck,
  Star,
  User,
  WalletCards,
  XCircle,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { portalPreviewApi } from '../api/portalPreview';
import { useAuth } from '../auth/AuthProvider';
import StatusBadge from '../components/shared/StatusBadge';
import CustomerDeleteSection from '../components/customers/CustomerDeleteSection';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import { format } from 'date-fns';
import { formatDateOnly } from '../lib/dates';

function Section({ title, icon: Icon, description, children, action }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={15} className="text-[var(--text-tertiary)]" />}
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{title}</h3>
          </div>
          {description && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="text-sm text-[var(--text-primary)] font-medium">{value || '—'}</p>
    </div>
  );
}

function money(value, maximumFractionDigits = 0) {
  return Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  });
}

function customerName(customer) {
  return `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Customer';
}

function initials(customer) {
  const first = customer?.first_name?.[0] || '?';
  const last = customer?.last_name?.[0] || '';
  return `${first}${last}`.toUpperCase();
}

function agreementFor(booking) {
  const agreement = booking?.rental_agreements;
  return Array.isArray(agreement) ? agreement[0] : agreement;
}

function bookingVehicle(booking) {
  const vehicle = booking?.vehicles || booking?.vehicle || {};
  if (typeof vehicle === 'string') return vehicle;
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_code || 'Vehicle not assigned';
}

function bookingTotal(booking) {
  return Number(booking?.total_cost ?? booking?.total_amount ?? 0);
}

function completedRentalPaid(booking) {
  const payments = Array.isArray(booking?.payments) ? booking.payments : [];
  return payments.some((payment) =>
    payment.payment_type === 'rental' &&
    ['completed', 'paid', 'succeeded'].includes(payment.status)
  );
}

function paidTotal(booking) {
  const payments = Array.isArray(booking?.payments) ? booking.payments : [];
  return payments
    .filter((payment) => ['completed', 'paid', 'succeeded'].includes(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function StatusChip({ icon: Icon, label, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    slate: 'bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function MetricCard({ label, value, subtext, icon: Icon, tone = 'slate' }) {
  const toneColor = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-700 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    sky: 'text-sky-700 dark:text-sky-400',
    slate: 'text-[var(--text-primary)]',
  }[tone] || 'text-[var(--text-primary)]';
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon size={17} className={toneColor} />
        <p className={`text-2xl font-bold tabular-nums ${toneColor}`}>{value}</p>
      </div>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      {subtext && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtext}</p>}
    </div>
  );
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimelineDate(value) {
  const date = validDate(value);
  return date ? format(date, 'MMM d, h:mm a') : 'Date unknown';
}

function compactText(value, max = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'No message body saved.';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function paymentTypeLabel(type) {
  const labels = {
    rental: 'Rental payment',
    deposit: 'Deposit',
    refund: 'Refund',
    insurance: 'Insurance',
    extension: 'Extension',
    installment: 'Installment',
  };
  return labels[type] || String(type || 'Payment').replace(/_/g, ' ');
}

function methodLabel(method) {
  if (!method) return 'Method not saved';
  return String(method).replace(/_/g, ' ');
}

function paymentTone(payment) {
  if (Number(payment?.amount || 0) < 0 || payment?.payment_type === 'refund') return 'red';
  if (['completed', 'paid', 'succeeded'].includes(payment?.status)) return 'emerald';
  if (['pending', 'requires_payment_method', 'processing'].includes(payment?.status)) return 'amber';
  return 'slate';
}

function TimelineEmpty({ icon: Icon, title, description }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/45 p-4 text-center">
      <Icon size={18} className="mx-auto text-[var(--text-tertiary)]" />
      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">{description}</p>
    </div>
  );
}

function PaymentTimelineCard({ payments, onOpenBooking }) {
  const netPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const completedCount = payments.filter(payment => ['completed', 'paid', 'succeeded'].includes(payment.status)).length;

  return (
    <Section
      title="Payment Timeline"
      icon={ReceiptText}
      description="Recent charges, deposits, refunds, and manual payments for this customer."
      action={<Link to="/payments" className="btn-secondary text-xs">Payment center</Link>}
    >
      {payments.length === 0 ? (
        <TimelineEmpty
          icon={CreditCard}
          title="No payment activity yet"
          description="Payments, deposits, and refunds will appear here after a booking is paid or adjusted."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Net ledger</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">{money(netPaid, 2)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Completed rows</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">{completedCount}</p>
            </div>
          </div>

          <div className="space-y-2">
            {payments.slice(0, 6).map((payment) => {
              const tone = paymentTone(payment);
              const toneClass = {
                emerald: 'bg-emerald-500',
                amber: 'bg-amber-500',
                red: 'bg-red-500',
                slate: 'bg-slate-400',
              }[tone] || 'bg-slate-400';
              return (
                <button
                  type="button"
                  key={payment.id || `${payment.booking_id}-${payment.created_at}`}
                  onClick={() => payment.booking_id && onOpenBooking(payment.booking_id)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-left transition-colors hover:bg-[var(--bg-card-hover)]"
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${toneClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {paymentTypeLabel(payment.payment_type)}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                            {payment.booking_code || 'Booking'} · {methodLabel(payment.method)}
                          </p>
                        </div>
                        <p className={`shrink-0 text-sm font-bold tabular-nums ${Number(payment.amount || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--text-primary)]'}`}>
                          {money(payment.amount, 2)}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusChip icon={CheckCircle2} label={payment.status || 'recorded'} tone={tone} />
                        {payment.vehicle_label && <span className="text-[11px] rounded-full bg-[var(--bg-card-hover)] px-2 py-1 text-[var(--text-secondary)]">{payment.vehicle_label}</span>}
                        <span className="text-[11px] rounded-full bg-[var(--bg-card-hover)] px-2 py-1 text-[var(--text-secondary)]">
                          {formatTimelineDate(payment.paid_at || payment.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Section>
  );
}

function MessageTimelineCard({ messages, loading, error, customerId }) {
  const recentMessages = [...messages]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 6);

  return (
    <Section
      title="Message Timeline"
      icon={MessageSquare}
      description="Latest SMS and email touches tied to this customer."
      action={<Link to={`/messaging?customer=${customerId}`} className="btn-secondary text-xs">Open thread</Link>}
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-[var(--bg-primary)]" />
          ))}
        </div>
      ) : error ? (
        <TimelineEmpty icon={AlertTriangle} title="Messages could not load" description={error} />
      ) : recentMessages.length === 0 ? (
        <TimelineEmpty
          icon={MessageSquare}
          title="No messages yet"
          description="SMS and email conversations will appear here once the customer sends or receives a message."
        />
      ) : (
        <div className="space-y-2">
          {recentMessages.map((message) => {
            const outbound = message.direction === 'outbound';
            const Icon = outbound ? Send : Inbox;
            return (
              <Link
                key={message.id || `${message.direction}-${message.created_at}`}
                to={`/messaging?customer=${customerId}`}
                className="block rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 transition-colors hover:bg-[var(--bg-card-hover)]"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-lg border p-2 ${outbound ? 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {outbound ? 'Sent' : 'Received'} {String(message.channel || 'message').toUpperCase()}
                        </p>
                        {message.subject && (
                          <p className="mt-0.5 truncate text-xs font-medium text-[var(--text-secondary)]">{message.subject}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-[11px] text-[var(--text-tertiary)]">{formatTimelineDate(message.created_at)}</p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{compactText(message.body)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function getCustomerAction(customer, bookings) {
  const paymentDue = bookings.find((booking) => booking.status === 'approved' && !completedRentalPaid(booking));
  if (paymentDue) {
    return {
      tone: 'amber',
      icon: CreditCard,
      title: 'Collect payment',
      description: `${paymentDue.booking_code} is approved but not paid. Open the booking or send the continue link before pickup.`,
      booking: paymentDue,
    };
  }

  const needsInsurance = bookings.find((booking) => ['pending_review', 'bind_failed', 'rejected'].includes(booking.insurance_status));
  if (needsInsurance) {
    return {
      tone: 'red',
      icon: Shield,
      title: 'Review insurance',
      description: `${needsInsurance.booking_code} needs an insurance decision or reconciliation.`,
      booking: needsInsurance,
    };
  }

  const needsAgreement = bookings.find((booking) => ['approved', 'confirmed'].includes(booking.status) && !agreementFor(booking)?.customer_signed_at);
  if (needsAgreement) {
    return {
      tone: 'violet',
      icon: FileText,
      title: 'Agreement needed',
      description: `${needsAgreement.booking_code} is missing the customer agreement/signature.`,
      booking: needsAgreement,
    };
  }

  const active = bookings.find((booking) => booking.status === 'active' || booking.status === 'ready_for_pickup');
  if (active) {
    return {
      tone: 'emerald',
      icon: Calendar,
      title: active.status === 'active' ? 'Monitor active rental' : 'Ready for pickup',
      description: `${active.booking_code} is ${active.status.replace(/_/g, ' ')}. Watch timing, messages, photos, and return readiness.`,
      booking: active,
    };
  }

  return {
    tone: customer?.is_trusted ? 'emerald' : 'slate',
    icon: customer?.is_trusted ? BadgeCheck : User,
    title: customer?.is_trusted ? 'Trusted customer' : 'No urgent action',
    description: customer?.is_trusted
      ? 'Future bookings can auto-approve unless you remove trusted status.'
      : 'No active payment, document, insurance, or rental blocker is visible.',
    booking: null,
  };
}

/**
 * Trusted-customer toggle. When ON, future bookings from this customer skip
 * pending_approval and go straight to `approved` (see bookingService.createBooking).
 * Insurance + payment + agreement wizard still required — we're only skipping
 * the manual admin approval step.
 */
function CustomerTrustToggle({ customer, onChange }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  const isTrusted = !!customer.is_trusted;

  async function handleToggle(nextValue, withNote) {
    setSaving(true);
    setError('');
    try {
      const updated = await api.setCustomerTrust(customer.id, nextValue, withNote || null);
      onChange({ ...customer, ...updated });
      setShowNote(false);
      setNote('');
    } catch (err) {
      setError(err?.message || 'Failed to update');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {isTrusted ? 'Trusted — auto-approve bookings' : 'Not trusted — manual approval required'}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
            {isTrusted
              ? 'New bookings from this customer skip the pending queue. They still complete the agreement + payment wizard before pickup.'
              : 'New bookings land in your pending-approval queue for manual review.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isTrusted) handleToggle(false);
            else setShowNote(true);
          }}
          disabled={saving}
          className="relative shrink-0"
          style={{
            width: 42, height: 24, borderRadius: 12,
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer', padding: 0,
            background: isTrusted ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'var(--bg-card, rgba(255,255,255,0.06))',
            boxShadow: isTrusted ? '0 2px 8px rgba(34,197,94,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.15)',
            transition: 'background 0.25s, box-shadow 0.25s',
            opacity: saving ? 0.6 : 1,
          }}
          aria-pressed={isTrusted}
          aria-label="Toggle trusted customer"
        >
          <span style={{
            position: 'absolute', top: 2, width: 20, height: 20,
            borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
            left: isTrusted ? 20 : 2,
          }} />
        </button>
      </div>

      {isTrusted && customer.trusted_at && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <Zap size={12} className="text-[#22c55e]" />
          <span>Trusted since {new Date(customer.trusted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          {customer.trusted_note && (
            <span className="italic">· "{customer.trusted_note}"</span>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-[#ef4444]">{error}</p>
      )}

      {showNote && !isTrusted && (
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            Why trust this customer? (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. 5 successful rentals, no incidents"
            className="input text-sm w-full"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowNote(false); setNote(''); }}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleToggle(true, note.trim())}
              disabled={saving}
              className="btn-primary text-xs"
              style={{ opacity: saving ? 0.5 : 1 }}
            >
              {saving ? 'Saving…' : 'Mark trusted'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerLicensePhotos({ paths, legacyUrl, onView }) {
  const [signedUrls, setSignedUrls] = useState({});

  useEffect(() => {
    if (!paths?.length) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const path of paths) {
        try {
          const signed = await api.getSignedUrl('id-photos', path);
          next[path] = signed.url;
        } catch { /* skip */ }
      }
      if (!cancelled) setSignedUrls(next);
    })();
    return () => { cancelled = true; };
  }, [paths]);

  if (!paths?.length && !legacyUrl) return null;

  return (
    <div className="pt-3 border-t border-[var(--border-subtle)]">
      <p className="text-xs text-[var(--text-tertiary)] mb-2">License photos on file</p>
      <div className="flex flex-wrap gap-2">
        {(paths || []).map(path => (
          signedUrls[path] ? (
            <button key={path} onClick={() => onView(signedUrls[path])} className="cursor-pointer">
              <img src={signedUrls[path]} alt="License" className="h-28 w-auto rounded-lg border border-[var(--border-subtle)] object-cover hover:opacity-80" />
            </button>
          ) : (
            <div key={path} className="h-28 w-36 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-center">
              <span className="text-xs animate-pulse text-[var(--text-secondary)]">Loading…</span>
            </div>
          )
        ))}
        {legacyUrl && !paths?.length && <CustomerIdPhoto url={legacyUrl} onView={onView} />}
      </div>
    </div>
  );
}

function CustomerIdPhoto({ url, onView }) {
  const [resolvedUrl, setResolvedUrl] = useState(null);

  useEffect(() => {
    if (!url) return;
    if (url.startsWith('http')) {
      setResolvedUrl(url);
      return;
    }
    // Storage path — resolve via signed URL
    let cancelled = false;
    (async () => {
      try {
        const signed = await api.getSignedUrl('id-photos', url);
        if (!cancelled) setResolvedUrl(signed.url);
      } catch { if (!cancelled) setResolvedUrl(null); }
    })();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className="pt-3 border-t border-[var(--border-subtle)]">
      <p className="text-xs text-[var(--text-tertiary)] mb-2">Photo ID</p>
      {resolvedUrl ? (
        <button onClick={() => onView(resolvedUrl)} className="cursor-pointer">
          <img
            src={resolvedUrl}
            alt="Customer photo ID"
            className="h-28 w-auto rounded-lg border border-[var(--border-subtle)] object-cover hover:opacity-80 hover:shadow-md transition-all"
          />
        </button>
      ) : (
        <div className="h-28 w-36 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-center">
          <span className="text-xs animate-pulse text-[var(--text-secondary)]">Loading…</span>
        </div>
      )}
      <p className="text-xs text-[var(--text-tertiary)] mt-1">Click to enlarge</p>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState('');
  const [notes, setNotes] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [portalPreviewing, setPortalPreviewing] = useState(false);
  const [portalPreviewError, setPortalPreviewError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessagesLoading(true);
      setMessagesError('');
      try {
        const c = await api.getCustomer(id);
        setCustomer(c);
        setNotes(c.notes || '');
      } catch (e) { console.error('[CustomerDetail] Failed to load customer:', e); }
      try {
        const b = await api.getCustomerBookings(id);
        setBookings(b || []);
      } catch (e) { console.error('[CustomerDetail] Failed to load bookings:', e); }
      try {
        const m = await api.getMessages(id);
        setMessages(m || []);
      } catch (e) {
        console.error('[CustomerDetail] Failed to load messages:', e);
        setMessagesError(e?.message || 'Message history is unavailable right now.');
      } finally {
        setMessagesLoading(false);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function saveNotes() {
    if (notes !== (customer.notes || '')) {
      await api.updateCustomer(id, { notes }).catch(console.error);
    }
  }

  async function openPortalPreview() {
    const previewWindow = window.open('about:blank', '_blank');
    setPortalPreviewing(true);
    setPortalPreviewError('');
    try {
      const result = await portalPreviewApi.forCustomer(id);
      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.location.href = result.url;
      } else {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      if (previewWindow) previewWindow.close();
      setPortalPreviewError(e?.message || 'Could not open customer portal preview');
    } finally {
      setPortalPreviewing(false);
    }
  }

  if (loading) return <SkeletonDashboard />;
  if (!customer) return <div className="p-6 text-[var(--text-secondary)]">Customer not found</div>;

  const allBookings = bookings.length ? bookings : (customer.bookings || []);
  const agreements = allBookings.flatMap(b => {
    const ra = b.rental_agreements;
    const arr = Array.isArray(ra) ? ra : ra ? [ra] : [];
    return arr.map(ag => ({ ...ag, booking_code: b.booking_code, booking_id: b.id }));
  });
  const latestAgreement = agreements[0] || null;
  const latestSignedAgreement = agreements.find(ag => ag.customer_signed_at) || latestAgreement;
  const allLicensePaths = [...new Set(agreements.flatMap(ag => ag.license_photo_paths || []))];

  const totalSpent = Number(customer.total_revenue || 0) || allBookings
    .filter(b => ['completed', 'active', 'returned', 'confirmed', 'approved'].includes(b.status))
    .reduce((sum, b) => sum + bookingTotal(b), 0);
  const completedCount = allBookings.filter(b => b.status === 'completed').length;
  const activeBooking = allBookings.find(b => b.status === 'active' || b.status === 'ready_for_pickup') || null;
  const nextBooking = [...allBookings]
    .filter(b => ['approved', 'confirmed', 'ready_for_pickup'].includes(b.status))
    .sort((a, b) => String(a.pickup_date || '').localeCompare(String(b.pickup_date || '')))[0] || null;
  const latestBooking = allBookings[0] || null;
  const featuredBooking = activeBooking || nextBooking || latestBooking;
  const action = getCustomerAction(customer, allBookings);
  const ActionIcon = action.icon;
  const paymentDueCount = allBookings.filter(b => b.status === 'approved' && !completedRentalPaid(b)).length;
  const paidAcrossBookings = allBookings.reduce((sum, b) => sum + paidTotal(b), 0);
  const docStatus = {
    id: !!(customer.id_photo_url || customer.driver_license_number || latestSignedAgreement?.driver_license_number),
    agreement: agreements.some(ag => !!ag.customer_signed_at),
    insurance: agreements.some(ag => ag.insurance_company || ag.insurance_policy_number) ||
      allBookings.some(b => b.insurance_provider === 'bonzah' && ['active', 'verified'].includes(b.insurance_status)),
    sms: !customer.sms_opt_out,
  };
  const latestReview = customer.reviews?.[0] || null;
  const paymentEvents = allBookings
    .flatMap(booking => asArray(booking.payments).map(payment => ({
      ...payment,
      booking_id: payment.booking_id || booking.id,
      booking_code: booking.booking_code,
      vehicle_label: bookingVehicle(booking),
    })))
    .sort((a, b) => String(b.paid_at || b.created_at || '').localeCompare(String(a.paid_at || a.created_at || '')));

  return (
    <div className="page-shell lg:p-8 pb-[calc(140px+env(safe-area-inset-bottom,0px))] lg:pb-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => navigate('/customers')} className="btn-ghost py-1.5 px-2">
          <ArrowLeft size={16} />
          Back to customers
        </button>
        <div className="hidden items-center gap-2 sm:flex">
          <button type="button" onClick={openPortalPreview} disabled={portalPreviewing} className="btn-secondary">
            {portalPreviewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            View Portal
          </button>
          {customer.phone && <a href={`tel:${customer.phone}`} className="btn-secondary"><Phone size={14} /> Call</a>}
          {customer.email && <a href={`mailto:${customer.email}`} className="btn-secondary"><Mail size={14} /> Email</a>}
          <a href={`/messaging?customer=${customer.id}`} className="btn-primary"><MessageSquare size={14} /> Message</a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:hidden">
        <button type="button" onClick={openPortalPreview} disabled={portalPreviewing} className="btn-secondary">
          {portalPreviewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          View Portal
        </button>
        {customer.phone && <a href={`tel:${customer.phone}`} className="btn-secondary"><Phone size={14} /> Call</a>}
        {customer.email && <a href={`mailto:${customer.email}`} className="btn-secondary"><Mail size={14} /> Email</a>}
        <a href={`/messaging?customer=${customer.id}`} className="btn-primary"><MessageSquare size={14} /> Message</a>
      </div>

      {portalPreviewError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-[var(--danger-color)]">
          {portalPreviewError}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
              style={{ background: customer.is_trusted ? 'linear-gradient(135deg, #13294B, #22c55e)' : 'linear-gradient(135deg, #13294B, #8B5CF6)' }}
            >
              {initials(customer)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{customerName(customer)}</h1>
                {customer.is_trusted && <StatusChip icon={Star} label="Trusted" tone="emerald" />}
                {customer.sms_opt_out && <StatusChip icon={MessageSquare} label="SMS opt-out" tone="amber" />}
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Customer since {customer.created_at ? format(new Date(customer.created_at), 'MMMM yyyy') : 'unknown'} · {customer.email || 'No email'}{customer.phone ? ` · ${customer.phone}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusChip icon={docStatus.id ? CheckCircle2 : XCircle} label={docStatus.id ? 'ID on file' : 'ID missing'} tone={docStatus.id ? 'emerald' : 'red'} />
                <StatusChip icon={docStatus.insurance ? ShieldCheck : AlertTriangle} label={docStatus.insurance ? 'Insurance on file' : 'Insurance missing'} tone={docStatus.insurance ? 'emerald' : 'amber'} />
                <StatusChip icon={docStatus.agreement ? FileText : AlertTriangle} label={docStatus.agreement ? 'Agreement signed' : 'Agreement missing'} tone={docStatus.agreement ? 'emerald' : 'violet'} />
                <StatusChip icon={customer.stripe_customer_id ? WalletCards : CreditCard} label={customer.stripe_customer_id ? 'Saved payment profile' : 'No saved payment profile'} tone={customer.stripe_customer_id ? 'sky' : 'slate'} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 xl:w-[380px]">
            <div className="flex items-start gap-3">
              <div className={`rounded-xl border p-2 ${action.tone === 'red' ? 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400' : action.tone === 'amber' ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400' : action.tone === 'violet' ? 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
                <ActionIcon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Next action</p>
                <h2 className="mt-1 text-base font-bold text-[var(--text-primary)]">{action.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{action.description}</p>
                {action.booking && (
                  <button type="button" className="btn-primary mt-3 text-xs" onClick={() => navigate(`/bookings/${action.booking.id}`)}>
                    Open {action.booking.booking_code}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Calendar} label="Total Rentals" value={allBookings.length} subtext={`${completedCount} completed`} />
        <MetricCard icon={DollarSign} label="Lifetime Spend" value={money(totalSpent)} subtext={`${money(paidAcrossBookings, 2)} paid ledger`} tone="emerald" />
        <MetricCard icon={CreditCard} label="Payment Blockers" value={paymentDueCount} subtext="Approved but unpaid" tone={paymentDueCount ? 'amber' : 'slate'} />
        <MetricCard icon={ShieldCheck} label="Documents" value={`${Object.values(docStatus).filter(Boolean).length}/4`} subtext="ID, insurance, agreement, SMS" tone={Object.values(docStatus).every(Boolean) ? 'emerald' : 'amber'} />
        <MetricCard icon={ReceiptText} label="Reviews" value={customer.reviews?.length || 0} subtext={latestReview?.rating ? `${latestReview.rating}/5 latest rating` : 'No review history'} tone={latestReview?.rating >= 4 ? 'emerald' : 'slate'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <PaymentTimelineCard payments={paymentEvents} onOpenBooking={(bookingId) => navigate(`/bookings/${bookingId}`)} />
        <MessageTimelineCard messages={messages} loading={messagesLoading} error={messagesError} customerId={customer.id} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-5">
        <div className="space-y-5">
        {/* Contact Info */}
        <Section title="Contact & Identity" icon={User} description="Core customer details used across bookings, agreements, insurance, and messaging.">
          <div className="space-y-3">
            <a href={`tel:${customer.phone}`} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors">
              <div className="w-8 h-8 bg-[var(--bg-card)] rounded-lg flex items-center justify-center">
                <Phone size={14} className="text-[var(--text-secondary)]" />
              </div>
              {customer.phone || 'No phone on file'}
            </a>
            <a href={`mailto:${customer.email}`} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors">
              <div className="w-8 h-8 bg-[var(--bg-card)] rounded-lg flex items-center justify-center">
                <Mail size={14} className="text-[var(--text-secondary)]" />
              </div>
              {customer.email || 'No email on file'}
            </a>
          </div>
          {customer.driver_license_number && (
            <div className="pt-3 border-t border-[var(--border-subtle)] grid sm:grid-cols-2 gap-3">
              <Field label="DL Number" value={customer.driver_license_number} />
              <Field label="DL State" value={customer.driver_license_state} />
              <Field label="DL Expiry" value={customer.driver_license_expiry} />
            </div>
          )}
          {customer.id_photo_url && !allLicensePaths.length && (
            <CustomerIdPhoto url={customer.id_photo_url} onView={setLightboxUrl} />
          )}
          <CustomerLicensePhotos paths={allLicensePaths} onView={setLightboxUrl} />
          {customer.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {customer.tags.map(t => (
                <span key={t} className="badge bg-[var(--bg-card)] text-[var(--text-secondary)]">{t}</span>
              ))}
            </div>
          )}
        </Section>

        <Section title="Address & Personal" icon={Home}>
          {(customer.address_line1 || customer.city) ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Address</p>
                <p className="text-sm text-[var(--text-primary)]">
                  {customer.address_line1}
                  {customer.city && `, ${customer.city}`}
                  {customer.state && `, ${customer.state}`}
                  {' '}{customer.zip}
                </p>
              </div>
              {customer.date_of_birth && (
                <Field label="Date of Birth" value={customer.date_of_birth} />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-tertiary)]">Address will appear once the customer completes a rental agreement.</p>
            </div>
          )}
        </Section>

        {/* Notes */}
        <Section title="Internal Notes" icon={User} description="Private operator notes. Auto-saves on blur.">
          <textarea
            className="input resize-none text-sm"
            rows={5}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add private notes about this customer…"
          />
          <p className="text-xs text-[var(--text-tertiary)]">Notes auto-save when you click away.</p>
        </Section>

        {/* Trust status (Phase 1 — migration 019) */}
        <Section title="Trust Status" icon={ShieldCheck} description="Controls whether future bookings from this customer skip manual approval.">
          <CustomerTrustToggle customer={customer} onChange={setCustomer} />
        </Section>
        </div>

        <div className="space-y-5">
        {featuredBooking && (
          <Section
            title={activeBooking ? 'Current Rental' : nextBooking ? 'Next Rental' : 'Latest Booking'}
            icon={Car}
            action={<StatusBadge status={featuredBooking.status} />}
          >
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)]">{bookingVehicle(featuredBooking)}</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  <span className="font-mono">{featuredBooking.booking_code}</span> · {formatDateOnly(featuredBooking.pickup_date, 'MMM d')} to {formatDateOnly(featuredBooking.return_date, 'MMM d')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rental Total" value={money(bookingTotal(featuredBooking), 2)} />
                <Field label="Paid" value={money(paidTotal(featuredBooking), 2)} />
                <Field label="Deposit" value={money(featuredBooking.deposit_amount || 0, 2)} />
                <Field label="Insurance" value={featuredBooking.insurance_status || '—'} />
              </div>
              <div className="grid gap-2">
                <StatusChip icon={completedRentalPaid(featuredBooking) ? CheckCircle2 : CreditCard} label={completedRentalPaid(featuredBooking) ? 'Rental paid' : 'Payment not complete'} tone={completedRentalPaid(featuredBooking) ? 'emerald' : 'amber'} />
                <StatusChip icon={agreementFor(featuredBooking)?.customer_signed_at ? FileText : AlertTriangle} label={agreementFor(featuredBooking)?.customer_signed_at ? 'Agreement signed' : 'Agreement not signed'} tone={agreementFor(featuredBooking)?.customer_signed_at ? 'emerald' : 'violet'} />
              </div>
              <button type="button" className="btn-primary w-full justify-center" onClick={() => navigate(`/bookings/${featuredBooking.id}`)}>
                Open booking
              </button>
            </div>
          </Section>
        )}

        {latestAgreement && (latestAgreement.insurance_company || latestAgreement.license_scan_metadata) && (
          <Section title="Insurance & ID Scan" icon={Shield} description={`Latest source: ${latestAgreement.booking_code || 'agreement'}`}>
            {latestAgreement.insurance_company && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Insurance Company" value={latestAgreement.insurance_company} />
                <Field label="Policy #" value={latestAgreement.insurance_policy_number} />
                <Field label="Expiry" value={latestAgreement.insurance_expiry} />
                <Field label="Agent" value={latestAgreement.insurance_agent_name} />
                <Field label="Agent Phone" value={latestAgreement.insurance_agent_phone} />
                <Field label="Insured Vehicle" value={latestAgreement.insurance_vehicle_description} />
              </div>
            )}
            {latestAgreement.license_scan_metadata && (
              <div className={latestAgreement.insurance_company ? 'pt-3 border-t border-[var(--border-subtle)]' : ''}>
                <p className="text-xs text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                  <ScanLine size={12} /> Latest scan ({latestAgreement.booking_code})
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Scan ID" value={latestAgreement.license_scan_metadata.scan_id} />
                  <Field label="Method" value={latestAgreement.license_scan_metadata.method} />
                  <Field label="Name on ID" value={latestAgreement.license_scan_metadata.scanned_name} />
                  <Field label="Name Match" value={latestAgreement.license_scan_metadata.name_match || '—'} />
                </div>
              </div>
            )}
          </Section>
        )}
        {latestReview && (
          <Section title="Latest Review" icon={Star}>
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-amber-400">
                {Array.from({ length: Math.max(0, Math.min(5, Number(latestReview.rating || 0))) }).map((_, index) => (
                  <Star key={index} size={14} fill="currentColor" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{latestReview.comment || latestReview.body || 'No written review text.'}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{latestReview.created_at ? format(new Date(latestReview.created_at), 'MMM d, yyyy') : 'Review date unknown'}</p>
            </div>
          </Section>
        )}
        </div>
      </div>

      {/* Booking History */}
      <Section title={`Booking History (${allBookings.length})`} icon={Calendar} description="Full rental history with payment, document, and insurance signals.">
        {allBookings.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No bookings yet.</p>
        ) : (
          <div className="scroll-x-contained max-w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {['Booking', 'Vehicle', 'Dates', 'Status', 'Paid', 'Docs'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-[var(--text-tertiary)] px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {allBookings.map(b => (
                  <tr
                    key={b.id}
                    className="hover:bg-[var(--bg-card)] cursor-pointer transition-colors"
                    onClick={() => navigate(`/bookings/${b.id}`)}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-secondary)]">{b.booking_code}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                      {b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)] text-xs">
                      {formatDateOnly(b.pickup_date, 'MMM d')} → {formatDateOnly(b.return_date)}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={b.status} /></td>
                    <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">{money(paidTotal(b), 2)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <StatusChip icon={agreementFor(b)?.customer_signed_at ? CheckCircle2 : XCircle} label="Agreement" tone={agreementFor(b)?.customer_signed_at ? 'emerald' : 'slate'} />
                        <StatusChip icon={['active', 'verified'].includes(b.insurance_status) ? CheckCircle2 : Clock} label={b.insurance_status || 'Insurance'} tone={['active', 'verified'].includes(b.insurance_status) ? 'emerald' : 'slate'} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <CustomerDeleteSection
        customer={customer}
        canDelete={hasRole('owner', 'admin')}
        onDeleted={() => navigate('/customers')}
      />

      {/* Photo Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
          onKeyDown={e => e.key === 'Escape' && setLightboxUrl(null)}
          role="dialog"
          aria-label="Photo viewer"
          tabIndex={-1}
        >
          <img
            src={lightboxUrl}
            alt="Customer photo ID — full size"
            className="max-h-[85vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-6 right-6 text-white/70 hover:text-white text-2xl font-bold transition-colors"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close photo viewer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
