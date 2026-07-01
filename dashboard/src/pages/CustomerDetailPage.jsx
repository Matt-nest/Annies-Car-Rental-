import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, User, Calendar, DollarSign, FileText, CreditCard, MapPin, Home, ShieldCheck, Zap, FolderOpen, KeyRound, Copy, Check, Repeat, Link2, Pause, Play, X, Plus } from 'lucide-react';
import { api } from '../api/client';
import { bookingApi } from '../api/bookingApi';
import StatusBadge from '../components/shared/StatusBadge';
import DocumentsFolder from '../components/bookings/DocumentsFolder';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import { format, formatDistanceToNow } from 'date-fns';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} className="text-[var(--text-tertiary)]" />}
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{title}</h3>
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

/** Small copy-to-clipboard chip used for handing off portal credentials. */
function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — value is still visible to read */ }
  }
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">{label}</p>
      <button
        type="button"
        onClick={copy}
        className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--accent-color)] transition-colors"
        title="Click to copy"
      >
        <span className="font-mono text-sm text-[var(--text-primary)] flex-1 break-all">{value}</span>
        {copied ? <Check size={14} className="text-[#22c55e] shrink-0" /> : <Copy size={14} className="text-[var(--text-tertiary)] shrink-0" />}
      </button>
    </div>
  );
}

/**
 * Portal account management (Phase 2 — migration 008). Admin provisions a login
 * for the customer: username = FirstName+LastInitial (deduped), temp password =
 * their phone number. The renter is forced to set a new password on first login.
 */
function CustomerPortalAccount({ customer }) {
  const [account, setAccount] = useState(undefined); // undefined=loading, null=none, object=exists
  const [creds, setCreds] = useState(null);          // freshly issued { username, tempPassword }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = await bookingApi.getCustomerAccount(customer.id);
        if (!cancelled) setAccount(a);
      } catch (e) {
        if (!cancelled) { setAccount(null); setError(e?.message || 'Failed to load account'); }
      }
    })();
    return () => { cancelled = true; };
  }, [customer.id]);

  async function provision() {
    setBusy(true); setError('');
    try {
      const res = await bookingApi.provisionCustomerAccount(customer.id);
      setCreds({ username: res.username, tempPassword: res.tempPassword });
      setAccount(await bookingApi.getCustomerAccount(customer.id));
    } catch (e) {
      setError(e?.message || 'Failed to create login');
    }
    setBusy(false);
  }

  async function resetPw() {
    setBusy(true); setError('');
    try {
      const res = await bookingApi.resetCustomerAccountPassword(customer.id);
      setCreds({ username: account?.username, tempPassword: res.tempPassword });
      setAccount(await bookingApi.getCustomerAccount(customer.id));
    } catch (e) {
      setError(e?.message || 'Failed to reset password');
    }
    setBusy(false);
  }

  if (account === undefined) {
    return <p className="text-sm text-[var(--text-tertiary)] animate-pulse">Loading account…</p>;
  }

  return (
    <div className="space-y-3">
      {!account ? (
        <>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
            Create a portal login so this customer can manage their rentals, payments, and personal details.
            Username is generated from their name; the temporary password is their phone number.
          </p>
          {!customer.phone && (
            <p className="text-xs text-[#f59e0b]">Add a phone number first — it becomes the temporary password.</p>
          )}
          <button
            type="button"
            onClick={provision}
            disabled={busy || !customer.phone}
            className="btn-primary text-xs"
            style={{ opacity: (busy || !customer.phone) ? 0.5 : 1 }}
          >
            {busy ? 'Creating…' : 'Create portal login'}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Username: <span className="font-mono">{account.username}</span>
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {account.last_login_at
                  ? `Last login ${formatDistanceToNow(new Date(account.last_login_at), { addSuffix: true })}`
                  : 'Has not logged in yet'}
              </p>
            </div>
            <span
              className="badge shrink-0"
              style={{
                background: account.must_change_password ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                color: account.must_change_password ? '#f59e0b' : '#22c55e',
              }}
            >
              {account.must_change_password ? 'Temp password' : 'Password set'}
            </span>
          </div>
          <button
            type="button"
            onClick={resetPw}
            disabled={busy}
            className="btn-ghost text-xs"
            style={{ opacity: busy ? 0.5 : 1 }}
          >
            {busy ? 'Resetting…' : 'Reset password to phone #'}
          </button>
        </>
      )}

      {/* Freshly issued credentials — copyable handoff card */}
      {creds && (
        <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)]">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Share these with the customer. They'll set their own password on first login.
          </p>
          {creds.username && <CopyField label="Username" value={creds.username} />}
          <CopyField label="Temporary password" value={creds.tempPassword} />
        </div>
      )}

      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  );
}

/**
 * Recurring rentals (Phase 4c — migration 008). Admin creates a long-term plan
 * that auto-charges a saved card or hands the renter a reusable Square link.
 */
const INTERVAL_NOUN = { weekly: 'week', biweekly: '2 weeks', monthly: 'month' };
const PLAN_STATUS_COLOR = {
  active: '#22c55e', paused: '#f59e0b', past_due: '#ef4444', cancelled: '#6b7280',
};

function CustomerRecurringRentals({ customerId }) {
  const [plans, setPlans] = useState(null);
  const [cards, setCards] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [p, c] = await Promise.all([
        bookingApi.getCustomerRecurring(customerId),
        bookingApi.getCustomerSavedCards(customerId).catch(() => []),
      ]);
      setPlans(p || []);
      setCards(c || []);
    } catch (e) {
      setError(e?.message || 'Failed to load plans');
      setPlans([]);
    }
  }
  useEffect(() => { load(); }, [customerId]);

  async function run(fn) {
    setError('');
    try { await fn(); load(); } catch (e) { setError(e?.message || 'Action failed'); }
  }

  if (plans === null) return <p className="text-sm text-[var(--text-tertiary)] animate-pulse">Loading plans…</p>;

  return (
    <div className="space-y-3">
      {plans.length === 0 && !creating && (
        <p className="text-sm text-[var(--text-tertiary)]">No recurring plans yet.</p>
      )}

      {plans.map((p) => (
        <div key={p.id} className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                ${Number(p.amount).toLocaleString()} / {INTERVAL_NOUN[p.interval] || p.interval}
                {p.interval_count > 1 ? ` ×${p.interval_count}` : ''}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {p.collection_method === 'auto_charge' ? 'Auto-charges saved card' : 'Reusable payment link'}
                {p.next_charge_date && ` · next ${p.next_charge_date}`}
              </p>
            </div>
            <span className="badge shrink-0" style={{ background: `${PLAN_STATUS_COLOR[p.status]}1a`, color: PLAN_STATUS_COLOR[p.status] }}>
              {p.status.replace('_', ' ')}
            </span>
          </div>

          {p.collection_method === 'send_link' && p.square_payment_link_url && (
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(p.square_payment_link_url)}
              className="flex items-center gap-1.5 text-xs text-[var(--accent-color)]"
              title="Copy payment link"
            >
              <Link2 size={13} /> Copy payment link
            </button>
          )}

          {/* Unpaid cycles — admin reconciliation (mainly send_link / past-due) */}
          {(p.charges || []).filter((c) => c.status !== 'paid' && c.status !== 'skipped').slice(0, 4).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-xs pt-1">
              <span className="text-[var(--text-tertiary)]">
                {c.period_start} · ${Number(c.amount).toLocaleString()} · {c.status}
              </span>
              <button
                onClick={() => run(() => bookingApi.markRecurringChargePaid(c.id))}
                className="btn-ghost text-[11px] flex items-center gap-1 text-[#22c55e]"
                title="Mark this cycle paid"
              >
                <Check size={12} /> Mark paid
              </button>
            </div>
          ))}

          {p.status !== 'cancelled' && (
            <div className="flex gap-2 pt-1">
              {p.status === 'paused' ? (
                <button onClick={() => run(() => bookingApi.resumeRecurring(p.id))} className="btn-ghost text-xs flex items-center gap-1">
                  <Play size={12} /> Resume
                </button>
              ) : (
                <button onClick={() => run(() => bookingApi.pauseRecurring(p.id))} className="btn-ghost text-xs flex items-center gap-1">
                  <Pause size={12} /> Pause
                </button>
              )}
              <button onClick={() => { if (window.confirm('Cancel this plan? This cannot be undone.')) run(() => bookingApi.cancelRecurring(p.id)); }} className="btn-ghost text-xs text-[#ef4444]">
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      {error && <p className="text-xs text-[#ef4444]">{error}</p>}

      {creating ? (
        <NewPlanForm
          customerId={customerId}
          cards={cards}
          onCancel={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      ) : (
        <button onClick={() => setCreating(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={14} /> New recurring plan
        </button>
      )}
    </div>
  );
}

function NewPlanForm({ customerId, cards, onCancel, onCreated }) {
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState('monthly');
  const [intervalCount, setIntervalCount] = useState(1);
  const [collectionMethod, setCollectionMethod] = useState(cards.length ? 'auto_charge' : 'send_link');
  const [squareCardId, setSquareCardId] = useState(cards[0]?.id || '');
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!Number(amount) || Number(amount) <= 0) { setError('Enter an amount'); return; }
    if (collectionMethod === 'auto_charge' && !squareCardId) { setError('Pick a saved card or use a payment link'); return; }
    setBusy(true);
    try {
      await bookingApi.createRecurring({
        customerId,
        amount: Number(amount),
        interval,
        intervalCount: Number(intervalCount) || 1,
        collectionMethod,
        squareCardId: collectionMethod === 'auto_charge' ? squareCardId : undefined,
        startDate: startDate || undefined,
        notes: notes || undefined,
      });
      onCreated();
    } catch (e) {
      setError(e?.message || 'Could not create plan');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">New recurring plan</p>
        <button onClick={onCancel}><X size={16} className="text-[var(--text-tertiary)]" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-[var(--text-tertiary)] block mb-1">Amount ($)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input text-sm w-full" placeholder="1200" />
        </div>
        <div>
          <label className="text-[11px] text-[var(--text-tertiary)] block mb-1">Every</label>
          <select value={interval} onChange={(e) => setInterval(e.target.value)} className="input text-sm w-full">
            <option value="weekly">Week</option>
            <option value="biweekly">2 weeks</option>
            <option value="monthly">Month</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-[var(--text-tertiary)] block mb-1">Billing</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCollectionMethod('auto_charge')}
            disabled={!cards.length}
            className={`flex-1 text-xs py-2 rounded-lg border ${collectionMethod === 'auto_charge' ? 'border-[var(--accent-color)] text-[var(--text-primary)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}
            style={{ opacity: cards.length ? 1 : 0.5 }}
          >
            Auto-charge card
          </button>
          <button
            type="button"
            onClick={() => setCollectionMethod('send_link')}
            className={`flex-1 text-xs py-2 rounded-lg border ${collectionMethod === 'send_link' ? 'border-[var(--accent-color)] text-[var(--text-primary)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}
          >
            Reusable link
          </button>
        </div>
        {!cards.length && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-1">No saved cards — the customer can add one in their portal to enable auto-charge.</p>
        )}
      </div>

      {collectionMethod === 'auto_charge' && cards.length > 0 && (
        <div>
          <label className="text-[11px] text-[var(--text-tertiary)] block mb-1">Card to charge</label>
          <select value={squareCardId} onChange={(e) => setSquareCardId(e.target.value)} className="input text-sm w-full">
            {cards.map((c) => <option key={c.id} value={c.id}>{c.brand} •••• {c.last4}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-[var(--text-tertiary)] block mb-1">Start date (optional)</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input text-sm w-full" />
        </div>
        <div>
          <label className="text-[11px] text-[var(--text-tertiary)] block mb-1">Note (optional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="input text-sm w-full" placeholder="e.g. Camry monthly" />
        </div>
      </div>

      {error && <p className="text-xs text-[#ef4444]">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost text-xs">Cancel</button>
        <button onClick={submit} disabled={busy} className="btn-primary text-xs" style={{ opacity: busy ? 0.5 : 1 }}>
          {busy ? 'Creating…' : 'Create plan'}
        </button>
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
  const [customer, setCustomer] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const c = await api.getCustomer(id);
        setCustomer(c);
        setNotes(c.notes || '');
      } catch (e) { console.error('[CustomerDetail] Failed to load customer:', e); }
      try {
        const b = await api.getCustomerBookings(id);
        setBookings(b || []);
      } catch (e) { console.error('[CustomerDetail] Failed to load bookings:', e); }
      setLoading(false);
    }
    load();
  }, [id]);

  // Collect all agreements across bookings for this customer
  const agreements = customer?.bookings?.flatMap(b => {
    const ra = b.rental_agreements;
    const arr = Array.isArray(ra) ? ra : ra ? [ra] : [];
    return arr.map(ag => ({ ...ag, booking_code: b.booking_code, booking_id: b.id }));
  }) || [];

  async function saveNotes() {
    if (notes !== (customer.notes || '')) {
      await api.updateCustomer(id, { notes }).catch(console.error);
    }
  }

  if (loading) return <SkeletonDashboard />;
  if (!customer) return <div className="p-6 text-[var(--text-secondary)]">Customer not found</div>;

  const totalSpent = bookings
    .filter(b => ['completed', 'active', 'returned', 'confirmed'].includes(b.status))
    .reduce((sum, b) => sum + Number(b.total_cost || 0), 0);
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/customers')} className="btn-ghost py-1.5 px-2">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            {customer.first_name} {customer.last_name}
          </h1>
          <p className="text-xs text-[var(--text-tertiary)]">
            Customer since {format(new Date(customer.created_at), 'MMMM yyyy')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{bookings.length}</p>
          <p className="text-xs text-[var(--text-secondary)]">Total Rentals</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-[#22c55e]">${totalSpent.toLocaleString()}</p>
          <p className="text-xs text-[var(--text-secondary)]">Total Spent</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            {completedCount}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Completed</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Contact Info */}
        <Section title="Contact" icon={User}>
          <div className="space-y-3">
            <a href={`tel:${customer.phone}`} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors">
              <div className="w-8 h-8 bg-[var(--bg-card)] rounded-lg flex items-center justify-center">
                <Phone size={14} className="text-[var(--text-secondary)]" />
              </div>
              {customer.phone}
            </a>
            <a href={`mailto:${customer.email}`} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors">
              <div className="w-8 h-8 bg-[var(--bg-card)] rounded-lg flex items-center justify-center">
                <Mail size={14} className="text-[var(--text-secondary)]" />
              </div>
              {customer.email}
            </a>
          </div>
          {customer.driver_license_number && (
            <div className="pt-3 border-t border-[var(--border-subtle)] grid sm:grid-cols-2 gap-3">
              <Field label="DL Number" value={customer.driver_license_number} />
              <Field label="DL State" value={customer.driver_license_state} />
              <Field label="DL Expiry" value={customer.driver_license_expiry} />
            </div>
          )}
          {customer.id_photo_url && (
            <CustomerIdPhoto url={customer.id_photo_url} onView={setLightboxUrl} />
          )}
          {customer.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {customer.tags.map(t => (
                <span key={t} className="badge bg-[var(--bg-card)] text-[var(--text-secondary)]">{t}</span>
              ))}
            </div>
          )}
        </Section>

        {/* Address & Personal Info */}
        <Section title="Personal Details" icon={Home}>
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
        <Section title="Internal Notes" icon={User}>
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
        <Section title="Trust Status" icon={ShieldCheck}>
          <CustomerTrustToggle customer={customer} onChange={setCustomer} />
        </Section>

        {/* Portal login (Phase 2 — migration 008) */}
        <Section title="Portal Login" icon={KeyRound}>
          <CustomerPortalAccount customer={customer} />
        </Section>
      </div>

      {/* Recurring rentals — long-term private rentals (Phase 4c) */}
      <Section title="Recurring Rentals" icon={Repeat}>
        <CustomerRecurringRentals customerId={id} />
      </Section>

      {/* Documents — every contract + invoice ever generated for this customer */}
      <Section title="Documents" icon={FolderOpen}>
        <DocumentsFolder customerId={id} showBookingCode />
      </Section>

      {/* Booking History */}
      <Section title={`Booking History (${bookings.length})`} icon={Calendar}>
        {bookings.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {['Booking', 'Vehicle', 'Dates', 'Status', 'Total'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-[var(--text-tertiary)] px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {bookings.map(b => (
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
                      {format(new Date(b.pickup_date), 'MMM d')} → {format(new Date(b.return_date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={b.status} /></td>
                    <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">${Number(b.total_cost || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

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
