import { useState, useEffect } from 'react';
import { Loader2, Copy, Check, ExternalLink } from 'lucide-react';
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
  const [firstName, setFirstName] = useState(initialCustomer?.firstName || '');
  const [lastName, setLastName] = useState(initialCustomer?.lastName || '');
  const [email, setEmail] = useState(initialCustomer?.email || '');
  const [phone, setPhone] = useState(initialCustomer?.phone || '');
  const [vehicleCode, setVehicleCode] = useState('');
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState(addDays(new Date().toISOString().slice(0, 10), 30));
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [portalNotes, setPortalNotes] = useState('');
  const [unlimitedMiles, setUnlimitedMiles] = useState(true);

  useEffect(() => {
    if (!open) return;
    setError('');
    setResult(null);
    setCopied('');
    if (initialCustomer) {
      setFirstName(initialCustomer.firstName || '');
      setLastName(initialCustomer.lastName || '');
      setEmail(initialCustomer.email || '');
      setPhone(initialCustomer.phone || '');
    }
    api.getVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, [open, initialCustomer]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!vehicleCode || !monthlyAmount) {
      setError('Vehicle and monthly amount are required.');
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
        special_requests: 'Long-term portal onboarding',
      });
      setResult(res);
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

  function handleClose() {
    setResult(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Onboard Long-Term Renter" maxWidth="max-w-lg">
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Booking <span className="font-mono font-semibold text-[var(--text-primary)]">{result.booking_code}</span> created and marked long-term.
            Send the renter their links below — they sign in with booking code + email.
          </p>
          {[
            { key: 'portal', label: 'Customer portal', url: result.portal_url || `${brand.siteUrl}/portal?code=${result.booking_code}` },
            { key: 'continue', label: 'Finish booking wizard', url: result.continue_url },
          ].map(({ key, label, url }) => (
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
          ))}
          <button type="button" className="btn-primary w-full justify-center" onClick={handleClose}>Done</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <InlineBanner message={error} onDismiss={() => setError('')} />
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
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Vehicle</label>
            <select className="input" required value={vehicleCode} onChange={e => setVehicleCode(e.target.value)}>
              <option value="">Select vehicle…</option>
              {vehicles.filter(v => v.status !== 'retired').map(v => (
                <option key={v.id} value={v.vehicle_code}>
                  {v.year} {v.make} {v.model} ({v.vehicle_code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input className="input" type="date" required value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Initial end date</label>
              <input className="input" type="date" required value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Monthly rent ($)</label>
            <input className="input" type="number" step="0.01" min="1" required placeholder="e.g. 899" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} />
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Sets the rental total for this billing period. Extend or add a payment plan from the booking.</p>
          </div>
          <div>
            <label className="label">Internal notes</label>
            <textarea className="input resize-none" rows={2} placeholder="Contract terms, renewal date, etc." value={portalNotes} onChange={e => setPortalNotes(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" checked={unlimitedMiles} onChange={e => setUnlimitedMiles(e.target.checked)} />
            Unlimited mileage
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1 justify-center" onClick={handleClose}>Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Create & get links'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
