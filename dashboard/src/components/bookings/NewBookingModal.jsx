import { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Copy, Send, Car, Calendar, User, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../shared/Modal';

const STEPS = [
  { key: 'vehicle',   label: 'Vehicle',   icon: Car },
  { key: 'dates',     label: 'Dates',     icon: Calendar },
  { key: 'customer',  label: 'Customer',  icon: User },
  { key: 'addons',    label: 'Add-ons',   icon: Sparkles },
  { key: 'review',    label: 'Review',    icon: CheckCircle },
];

const DELIVERY_OPTIONS = [
  { value: 'pickup',          label: 'Customer pickup' },
  { value: 'home_delivery',   label: 'Home delivery' },
  { value: 'airport_pickup',  label: 'Airport pickup' },
];

function StepperHeader({ step }) {
  return (
    <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < step;
        const active = i === step;
        return (
          <div key={s.key} className="flex items-center gap-1.5 shrink-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
              style={{
                backgroundColor: done ? '#22c55e' : active ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                color: done ? '#fff' : active ? 'var(--accent-fg)' : 'var(--text-tertiary)',
                border: !done && !active ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              {done ? <CheckCircle size={13} /> : <Icon size={13} />}
            </div>
            <span
              className="text-xs font-medium hidden sm:block"
              style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="w-4 h-px mx-0.5" style={{ backgroundColor: done ? '#22c55e' : 'var(--border-subtle)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NewBookingModal({ open, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { booking_code, continue_url } once created
  const [copied, setCopied] = useState(false);

  // Form state
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [pickupTime, setPickupTime] = useState('10:00');
  const [returnTime, setReturnTime] = useState('10:00');
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unlimitedMiles, setUnlimitedMiles] = useState(false);
  const [unlimitedTolls, setUnlimitedTolls] = useState(false);
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  function reset() {
    setStep(0);
    setError('');
    setSubmitting(false);
    setResult(null);
    setCopied(false);
    setPickupDate(''); setReturnDate('');
    setPickupTime('10:00'); setReturnTime('10:00');
    setVehicles([]); setVehicleId('');
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setUnlimitedMiles(false); setUnlimitedTolls(false);
    setDeliveryType('pickup'); setDeliveryAddress(''); setSpecialRequests('');
  }

  // Whenever the user enters dates, refetch the available-vehicles list.
  useEffect(() => {
    if (!open) return;
    if (!pickupDate || !returnDate) { setVehicles([]); return; }
    if (returnDate <= pickupDate) { setVehicles([]); return; }
    let cancelled = false;
    setVehiclesLoading(true);
    api.getAvailableVehicles(pickupDate, returnDate)
      .then(data => { if (!cancelled) setVehicles(Array.isArray(data) ? data : []); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load vehicles'); })
      .finally(() => { if (!cancelled) setVehiclesLoading(false); });
    return () => { cancelled = true; };
  }, [open, pickupDate, returnDate]);

  const selectedVehicle = useMemo(
    () => vehicles.find(v => v.id === vehicleId) || null,
    [vehicles, vehicleId]
  );

  function canAdvance() {
    setError('');
    if (step === 0) {
      if (!vehicleId) { setError('Select a vehicle.'); return false; }
    } else if (step === 1) {
      if (!pickupDate || !returnDate) { setError('Pick both pickup and return dates.'); return false; }
      if (returnDate <= pickupDate) { setError('Return must be after pickup.'); return false; }
      if (!pickupTime || !returnTime) { setError('Pick both pickup and return times.'); return false; }
    } else if (step === 2) {
      if (!firstName || !lastName) { setError('First and last name required.'); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Valid email required.'); return false; }
      if (!phone) { setError('Phone required.'); return false; }
      if (deliveryType !== 'pickup' && !deliveryAddress.trim()) {
        setError('Delivery address required for delivery options.');
        return false;
      }
    }
    return true;
  }

  // Note the order of steps in this UI: Dates is step 1, Vehicle is step 0.
  // Vehicle list depends on dates, so step 0 prompts the user to pick dates first.
  // We hide the vehicle list when dates aren't valid yet.

  async function handleSubmit() {
    if (!canAdvance()) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim(),
        phone:      phone.trim(),
        vehicle_code: selectedVehicle?.vehicle_code || vehicleId,
        pickup_date: pickupDate,
        return_date: returnDate,
        pickup_time: pickupTime,
        return_time: returnTime,
        delivery_type: deliveryType,
        delivery_address: deliveryType !== 'pickup' ? deliveryAddress.trim() : undefined,
        unlimited_miles: !!unlimitedMiles,
        unlimited_tolls: !!unlimitedTolls,
        special_requests: specialRequests.trim() || undefined,
      };
      const res = await api.createAdminBooking(payload);
      setResult(res);
      onCreated?.();
    } catch (e) {
      setError(e.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    reset();
    onClose?.();
  }

  function copyContinueUrl() {
    if (!result?.continue_url) return;
    navigator.clipboard.writeText(result.continue_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  /* ── Success screen ── */
  if (result) {
    return (
      <Modal open={open} onClose={handleClose} title="Booking Created">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl"
            style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <CheckCircle size={20} className="text-emerald-500 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-[var(--text-primary)]">Booking <span className="font-mono">{result.booking_code}</span> created.</p>
              <p className="text-[var(--text-secondary)] mt-0.5">An email with the continue-booking link has been sent to {email}.</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">
              Continue-booking link (does not expire)
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={result.continue_url}
                className="input flex-1 font-mono text-xs"
                onFocus={e => e.target.select()}
              />
              <button type="button" onClick={copyContinueUrl} className="btn-ghost px-3"
                style={{ border: '1px solid var(--border-subtle)' }}>
                <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="button" onClick={handleClose} className="btn-primary">Done</button>
          </div>
        </div>
      </Modal>
    );
  }

  /* ── Wizard ── */
  return (
    <Modal open={open} onClose={handleClose} title="New Booking">
      <div className="space-y-4">
        <StepperHeader step={step} />

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 0 — Vehicle */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Pick a vehicle. The list reflects availability for the dates entered in the next step — set those first if you need to filter.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Pickup date</label>
                <input type="date" className="input w-full" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Return date</label>
                <input type="date" className="input w-full" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
              </div>
            </div>

            {(!pickupDate || !returnDate || returnDate <= pickupDate) ? (
              <div className="text-xs text-[var(--text-tertiary)] italic p-3 rounded-xl"
                style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px dashed var(--border-subtle)' }}>
                Enter valid pickup &amp; return dates to see available vehicles.
              </div>
            ) : vehiclesLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                <Loader2 size={14} className="animate-spin" /> Checking availability…
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-xs text-[var(--text-tertiary)] italic p-3 rounded-xl"
                style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px dashed var(--border-subtle)' }}>
                No vehicles available for those dates.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {vehicles.map(v => {
                  const selected = vehicleId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehicleId(v.id)}
                      className="w-full text-left p-3 rounded-xl transition-all"
                      style={{
                        backgroundColor: selected ? 'var(--accent-glow)' : 'var(--bg-card)',
                        border: selected ? '2px solid var(--accent-color)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{v.year} {v.make} {v.model}</p>
                          <p className="text-xs text-[var(--text-tertiary)] font-mono">{v.vehicle_code}</p>
                        </div>
                        {v.daily_rate && (
                          <p className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
                            ${Number(v.daily_rate).toFixed(0)}<span className="text-xs font-normal text-[var(--text-tertiary)]">/day</span>
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 1 — Dates / times */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Pickup date</label>
                <input type="date" className="input w-full" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Return date</label>
                <input type="date" className="input w-full" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Pickup time</label>
                <input type="time" className="input w-full" value={pickupTime} onChange={e => setPickupTime(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Return time</label>
                <input type="time" className="input w-full" value={returnTime} onChange={e => setReturnTime(e.target.value)} />
              </div>
            </div>
            {selectedVehicle && (
              <p className="text-xs text-[var(--text-tertiary)]">
                Selected: <span className="font-semibold text-[var(--text-secondary)]">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</span>
              </p>
            )}
          </div>
        )}

        {/* Step 2 — Customer */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">First name</label>
                <input className="input w-full" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Last name</label>
                <input className="input w-full" value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Email</label>
              <input type="email" className="input w-full" value={email} onChange={e => setEmail(e.target.value)} placeholder="customer@example.com" />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">If this email exists, the booking attaches to that customer.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Phone</label>
              <input className="input w-full" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(772) 555-0100" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Delivery</label>
              <select className="input w-full" value={deliveryType} onChange={e => setDeliveryType(e.target.value)}>
                {DELIVERY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {deliveryType !== 'pickup' && (
                <input
                  className="input w-full mt-2"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Delivery address"
                />
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Add-ons */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Optional add-ons. The customer will pick insurance themselves on the continue link.
            </p>
            <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <input type="checkbox" checked={unlimitedMiles} onChange={e => setUnlimitedMiles(e.target.checked)} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Unlimited miles</p>
                <p className="text-xs text-[var(--text-tertiary)]">Removes the 200 mi/day cap. Free on weekly bookings.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <input type="checkbox" checked={unlimitedTolls} onChange={e => setUnlimitedTolls(e.target.checked)} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Unlimited tolls</p>
                <p className="text-xs text-[var(--text-tertiary)]">No per-mile toll passthroughs.</p>
              </div>
            </label>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">Special requests (optional)</label>
              <textarea className="input w-full" rows={3} value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-xl space-y-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Vehicle</span><span className="font-semibold text-[var(--text-primary)]">{selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Pickup</span><span className="text-[var(--text-secondary)] tabular-nums">{pickupDate} {pickupTime}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Return</span><span className="text-[var(--text-secondary)] tabular-nums">{returnDate} {returnTime}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Customer</span><span className="text-[var(--text-secondary)]">{firstName} {lastName}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Email</span><span className="text-[var(--text-secondary)]">{email}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Phone</span><span className="text-[var(--text-secondary)]">{phone}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Delivery</span><span className="text-[var(--text-secondary)]">{DELIVERY_OPTIONS.find(o => o.value === deliveryType)?.label}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Unlimited miles</span><span className="text-[var(--text-secondary)]">{unlimitedMiles ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Unlimited tolls</span><span className="text-[var(--text-secondary)]">{unlimitedTolls ? 'Yes' : 'No'}</span></div>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              The customer will receive an email with a link to add insurance, sign the agreement, and pay.
              Payment will auto-approve and confirm this booking.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            type="button"
            disabled={step === 0 || submitting}
            onClick={() => { setError(''); setStep(s => Math.max(0, s - 1)); }}
            className="btn-ghost"
            style={{ border: '1px solid var(--border-subtle)', opacity: step === 0 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => { if (canAdvance()) setStep(s => s + 1); }}
              className="btn-primary"
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Send size={14} /> Create &amp; send link</>}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
