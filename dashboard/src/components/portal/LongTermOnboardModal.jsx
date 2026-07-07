import { useState, useEffect } from 'react';
import { Loader2, Copy, Check, ExternalLink, Search, User } from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../shared/Modal';
import InlineBanner from '../shared/InlineBanner';
import brand from '../../config/brand';

function addDays(ymd, days) {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function LongTermOnboardModal({ open, onClose, onCreated, initialCustomer }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState('');

  const [vehicles, setVehicles] = useState([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerHits, setCustomerHits] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleCode, setVehicleCode] = useState('');
  const [pickupDate, setPickupDate] = useState(addDays(new Date().toISOString().slice(0, 10), -30));
  const [returnDate, setReturnDate] = useState(addDays(new Date().toISOString().slice(0, 10), 30));
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [portalNotes, setPortalNotes] = useState('');
  const [unlimitedMiles, setUnlimitedMiles] = useState(true);
  const [alreadyHasVehicle, setAlreadyHasVehicle] = useState(true);

  useEffect(() => {
    if (!open) return;
    setError('');
    setResult(null);
    setCopied('');
    setCustomerQuery('');
    setCustomerHits([]);
    if (initialCustomer) {
      setFirstName(initialCustomer.firstName || '');
      setLastName(initialCustomer.lastName || '');
      setEmail(initialCustomer.email || '');
      setPhone(initialCustomer.phone || '');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
    }
    setAlreadyHasVehicle(true);
    setPickupDate(addDays(new Date().toISOString().slice(0, 10), -30));
    api.getVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, [open, initialCustomer]);

  useEffect(() => {
    if (!open || customerQuery.trim().length < 2) {
      setCustomerHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingCustomers(true);
      try {
        const data = await api.getCustomers({ q: customerQuery.trim(), limit: 8 });
        setCustomerHits(Array.isArray(data) ? data : []);
      } catch {
        setCustomerHits([]);
      }
      setSearchingCustomers(false);
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery, open]);

  function pickCustomer(c) {
    setFirstName(c.first_name || '');
    setLastName(c.last_name || '');
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setCustomerQuery('');
    setCustomerHits([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!vehicleCode || !monthlyAmount) {
      setError('Vehicle and monthly amount are required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required — renters sign into the portal with booking code + email.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.createAdminBooking({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        vehicle_code: vehicleCode,
        pickup_date: pickupDate,
        return_date: returnDate,
        pickup_time: '10:00',
        return_time: '10:00',
        rate_preference: 'monthly',
        rental_type: 'long_term',
        portal_notes: portalNotes.trim() || undefined,
        admin_total_cost_override: Number(monthlyAmount),
        unlimited_miles: unlimitedMiles,
        skip_availability_check: alreadyHasVehicle,
        mark_active: alreadyHasVehicle,
        special_requests: 'Long-term portal onboarding',
      });
      setResult({ ...res, customer_email: email.trim() });
      onCreated?.();
    } catch (err) {
      setError(err?.data?.error || err.message || 'Onboarding failed');
    }
    setSubmitting(false);
  }

  function copyText(key, text) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  function loginInstructions() {
    if (!result) return '';
    const portal = result.portal_url || `${brand.siteUrl}/portal?code=${result.booking_code}`;
    return `Your ${brand.name} portal login:\n\nBooking code: ${result.booking_code}\nEmail: ${result.customer_email}\n\nPortal link: ${portal}\n\nGo to the portal link, enter your booking code and email to sign in.`;
  }

  function handleClose() {
    setResult(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Onboard Long-Term Renter" maxWidth="max-w-lg">
      {result ? (
        <div className="space-y-4">
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <p className="text-sm font-semibold text-[#22c55e]">Renter is in the system</p>
            <p className="text-xs text-[var(--text-secondary)]">
              They did not need an existing booking code — we created one for them. Send the credentials below.
            </p>
          </div>

          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Portal login (send to renter)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase text-[var(--text-tertiary)]">Booking code</p>
                <p className="text-lg font-mono font-bold text-[var(--accent-color)]">{result.booking_code}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-tertiary)]">Email</p>
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{result.customer_email}</p>
              </div>
            </div>
            <button type="button" className="btn-primary w-full justify-center text-sm" onClick={() => copyText('all', loginInstructions())}>
              {copied === 'all' ? <><Check size={14} /> Copied login instructions</> : <><Copy size={14} /> Copy login instructions</>}
            </button>
          </div>

          {[
            { key: 'portal', label: 'Portal link', url: result.portal_url || `${brand.siteUrl}/portal?code=${result.booking_code}` },
            { key: 'continue', label: 'Finish paperwork (if needed)', url: result.continue_url },
          ].map(({ key, label, url }) => url ? (
            <div key={key} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
              <div className="flex gap-2">
                <input className="input text-xs font-mono flex-1" readOnly value={url} />
                <button type="button" className="btn-secondary shrink-0" onClick={() => copyText(key, url)}>
                  {copied === key ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <a href={url} target="_blank" rel="noreferrer" className="btn-ghost shrink-0">
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ) : null)}

          <button type="button" className="btn-secondary w-full justify-center" onClick={handleClose}>Done</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            For renters <strong>not</strong> in the system yet — no booking code needed. We create their record, vehicle assignment, and portal login.
          </p>
          <InlineBanner message={error} onDismiss={() => setError('')} />

          <div>
            <label className="label">Find existing customer (optional)</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                className="input pl-9"
                placeholder="Search name, email, or phone…"
                value={customerQuery}
                onChange={e => setCustomerQuery(e.target.value)}
              />
            </div>
            {searchingCustomers && <p className="text-xs text-[var(--text-tertiary)] mt-1">Searching…</p>}
            {customerHits.length > 0 && (
              <div className="mt-1 card divide-y max-h-40 overflow-y-auto">
                {customerHits.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-elevated)] flex items-center gap-2"
                    onClick={() => pickCustomer(c)}
                  >
                    <User size={14} className="text-[var(--text-tertiary)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-[var(--text-tertiary)] truncate">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input className="input" required value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" required value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email (portal login)</label>
              <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Vehicle they are driving</label>
            <select className="input" required value={vehicleCode} onChange={e => setVehicleCode(e.target.value)}>
              <option value="">Select vehicle…</option>
              {vehicles.filter(v => v.status !== 'retired').map(v => (
                <option key={v.id} value={v.vehicle_code}>
                  {v.year} {v.make} {v.model} ({v.vehicle_code})
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" className="mt-1" checked={alreadyHasVehicle} onChange={e => setAlreadyHasVehicle(e.target.checked)} />
            <span>
              <strong>Renter already has this vehicle</strong> — skip availability check and mark rental active now (typical for existing long-term renters).
            </span>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Rental started</label>
              <input className="input" type="date" required value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Current period ends</label>
              <input className="input" type="date" required value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Monthly rent ($)</label>
            <input className="input" type="number" step="0.01" min="1" required placeholder="e.g. 899" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Internal notes</label>
            <textarea className="input resize-none" rows={2} placeholder="Contract terms, renewal date, gate code…" value={portalNotes} onChange={e => setPortalNotes(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" checked={unlimitedMiles} onChange={e => setUnlimitedMiles(e.target.checked)} />
            Unlimited mileage
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1 justify-center" onClick={handleClose}>Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Create portal access'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
