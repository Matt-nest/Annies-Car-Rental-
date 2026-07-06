import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Copy, Send,
  Car, Calendar, User, Sparkles, ScanLine, ArrowRight, Check, CreditCard, UserPlus, DollarSign, Percent
} from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../shared/Modal';
import RangeCalendar, { prettyDate, parseYMD } from './RangeCalendar';
import VehiclePickCard from './VehiclePickCard';
import AdminScanStep from './AdminScanStep';

const STEPS = [
  { key: 'dates',    label: 'Dates',    icon: Calendar },
  { key: 'vehicle',  label: 'Vehicle',  icon: Car },
  { key: 'addons',   label: 'Add-ons',  icon: Sparkles },
  { key: 'customer', label: 'Customer', icon: User },
  { key: 'id',       label: 'ID',       icon: CreditCard },
  { key: 'review',   label: 'Review',   icon: CheckCircle },
];

const DELIVERY_OPTIONS = [
  { value: 'pickup',               label: 'Customer pickup', fee: 0 },
  { value: 'psl_delivery',         label: 'Local delivery', fee: 39 },
  { value: 'surrounding_delivery', label: 'Airport / surrounding delivery', fee: 49 },
];

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const formatTime = (t) => { const hr = parseInt(t.split(':')[0]); const m = t.split(':')[1]; return `${hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr)}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };
const TAX_RATE = 0.07;

function calcRentalDays(pickupDate, returnDate) {
  if (!pickupDate || !returnDate || returnDate < pickupDate) return 0;
  const pickup = new Date(`${pickupDate}T12:00:00Z`);
  const ret = new Date(`${returnDate}T12:00:00Z`);
  return Math.max(1, Math.ceil((ret - pickup) / (1000 * 60 * 60 * 24)) + 1);
}

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const fieldLabel = 'text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block';
const currentTheme = () => (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? 'dark' : 'light';

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
  const [dir, setDir] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const theme = currentTheme();

  // Dates & logistics
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [pickupTime, setPickupTime] = useState('10:00');
  const [returnTime, setReturnTime] = useState('10:00');
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Vehicle
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [weeklyDiscountPct, setWeeklyDiscountPct] = useState(15);
  const [exactPriceEnabled, setExactPriceEnabled] = useState(false);
  const [exactPrice, setExactPrice] = useState('');

  // Add-ons
  const [unlimitedMiles, setUnlimitedMiles] = useState(false);
  const [unlimitedTolls, setUnlimitedTolls] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');

  // Customer contact
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // ID & details (optional pre-fill)
  const [idMode, setIdMode] = useState(null); // null | 'fill' | 'skip'
  const [showScanner, setShowScanner] = useState(true);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [dob, setDob] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrZip, setAddrZip] = useState('');
  const [licensePhotoPaths, setLicensePhotoPaths] = useState([]);

  function reset() {
    setStep(0); setDir(1); setError(''); setSubmitting(false); setResult(null); setCopied(false);
    setPickupDate(''); setReturnDate(''); setPickupTime('10:00'); setReturnTime('10:00');
    setDeliveryType('pickup'); setDeliveryAddress('');
    setVehicles([]); setVehicleId('');
    setWeeklyDiscountPct(15); setExactPriceEnabled(false); setExactPrice('');
    setUnlimitedMiles(false); setUnlimitedTolls(false); setSpecialRequests('');
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setIdMode(null); setShowScanner(true);
    setLicenseNumber(''); setLicenseState(''); setLicenseExpiry(''); setDob('');
    setAddrLine1(''); setAddrCity(''); setAddrState(''); setAddrZip(''); setLicensePhotoPaths([]);
  }

  // Refetch available vehicles whenever valid dates are set.
  useEffect(() => {
    if (!open) return;
    if (!pickupDate || !returnDate || returnDate <= pickupDate) { setVehicles([]); return; }
    let cancelled = false;
    setVehiclesLoading(true);
    api.getAvailableVehicles(pickupDate, returnDate)
      .then(data => { if (!cancelled) setVehicles(Array.isArray(data) ? data : []); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load vehicles'); })
      .finally(() => { if (!cancelled) setVehiclesLoading(false); });
    return () => { cancelled = true; };
  }, [open, pickupDate, returnDate]);

  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === vehicleId) || null, [vehicles, vehicleId]);

  useEffect(() => {
    if (!selectedVehicle) return;
    setWeeklyDiscountPct(Number(selectedVehicle.weekly_discount_percent ?? selectedVehicle.weeklyDiscountPercent ?? 15));
    setExactPriceEnabled(false);
    setExactPrice('');
  }, [selectedVehicle]);

  const pricingPreview = useMemo(() => {
    if (!selectedVehicle || !pickupDate || !returnDate || returnDate < pickupDate) return null;
    const rentalDays = calcRentalDays(pickupDate, returnDate);
    const dailyRate = Number(selectedVehicle.daily_rate || selectedVehicle.dailyRate || 0);
    if (!rentalDays || !dailyRate) return null;

    const discountPct = Math.min(50, Math.max(0, Number(weeklyDiscountPct) || 0));
    const weeklyRate = Number(((dailyRate * 7) * (1 - discountPct / 100)).toFixed(2));
    const fullWeeks = rentalDays >= 7 ? Math.floor(rentalDays / 7) : 0;
    const remainderDays = rentalDays >= 7 ? rentalDays % 7 : rentalDays;
    const weeklySubtotal = rentalDays >= 7
      ? Number(((fullWeeks * weeklyRate) + (remainderDays * dailyRate)).toFixed(2))
      : Number((rentalDays * dailyRate).toFixed(2));
    const deliveryFee = DELIVERY_OPTIONS.find(o => o.value === deliveryType)?.fee || 0;
    const mileageFee = rentalDays >= 7 ? 0 : (unlimitedMiles ? 100 : 0);
    const tollFee = unlimitedTolls ? 20 : 0;
    const taxAmount = Number(((weeklySubtotal + deliveryFee) * TAX_RATE).toFixed(2));
    const calculatedTotal = Number((weeklySubtotal + deliveryFee + mileageFee + tollFee + taxAmount).toFixed(2));
    const exactTotal = exactPriceEnabled ? Number(exactPrice) : null;
    const finalTotal = exactPriceEnabled && Number.isFinite(exactTotal) && exactTotal > 0
      ? Number(exactTotal.toFixed(2))
      : calculatedTotal;

    return {
      rentalDays,
      dailyRate,
      discountPct,
      weeklyRate,
      fullWeeks,
      remainderDays,
      subtotal: weeklySubtotal,
      deliveryFee,
      mileageFee,
      tollFee,
      taxAmount,
      calculatedTotal,
      finalTotal,
      adjustment: Number((finalTotal - calculatedTotal).toFixed(2)),
      rateType: rentalDays >= 7 ? (remainderDays ? 'weekly + daily' : 'weekly') : 'daily',
      savings: rentalDays >= 7 ? Number(((dailyRate * rentalDays) - weeklySubtotal).toFixed(2)) : 0,
    };
  }, [selectedVehicle, pickupDate, returnDate, weeklyDiscountPct, deliveryType, unlimitedMiles, unlimitedTolls, exactPriceEnabled, exactPrice]);

  const bookingName = `${firstName} ${lastName}`.trim();

  // Two-click range: 1st sets start, 2nd sets end, 3rd restarts.
  function handleDayClick(ymd) {
    setError('');
    if (!pickupDate || (pickupDate && returnDate)) { setPickupDate(ymd); setReturnDate(''); return; }
    if (ymd < pickupDate) { setPickupDate(ymd); setReturnDate(''); return; }
    setReturnDate(ymd);
  }

  // Apply scanned/OCR'd fields into the editable ID fields.
  function applyScan(p) {
    if (p.firstName) setFirstName(p.firstName);
    if (p.lastName) setLastName(p.lastName);
    if (p.license?.number) setLicenseNumber(p.license.number);
    if (p.license?.state) setLicenseState(p.license.state);
    if (p.license?.expiry) setLicenseExpiry(p.license.expiry);
    if (p.dob) setDob(p.dob);
    if (p.address?.line1) setAddrLine1(p.address.line1);
    if (p.address?.city) setAddrCity(p.address.city);
    if (p.address?.state) setAddrState(p.address.state);
    if (p.address?.zip) setAddrZip(p.address.zip);
    setShowScanner(false);
  }

  function canAdvance() {
    setError('');
    if (step === 0) {
      if (!pickupDate || !returnDate) { setError('Pick both pickup and return dates.'); return false; }
      if (returnDate <= pickupDate) { setError('Return must be after pickup.'); return false; }
      if (!pickupTime || !returnTime) { setError('Pick both pickup and return times.'); return false; }
      if (deliveryType !== 'pickup' && !deliveryAddress.trim()) { setError('Delivery address required for delivery options.'); return false; }
    } else if (step === 1) {
      if (!vehicleId) { setError('Select a vehicle.'); return false; }
      if (exactPriceEnabled && (!Number(exactPrice) || Number(exactPrice) <= 0)) {
        setError('Enter a valid exact rental total or turn off the override.');
        return false;
      }
    } else if (step === 3) {
      if (!firstName.trim() || !lastName.trim()) { setError('First and last name required.'); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Valid email required.'); return false; }
      if (!phone.trim()) { setError('Phone required.'); return false; }
    } else if (step === 4) {
      if (idMode === null) { setError("Choose whether you'll add the customer's ID now, or let them add it on their link."); return false; }
    }
    return true;
  }

  function goNext() { if (canAdvance()) { setDir(1); setStep(s => Math.min(s + 1, STEPS.length - 1)); } }
  function goBack() { setError(''); setDir(-1); setStep(s => Math.max(0, s - 1)); }

  function buildPrefill() {
    if (idMode !== 'fill') return null;
    const hasLicense = !!licenseNumber.trim();
    const hasAddress = !!(addrLine1.trim() && addrCity.trim());
    const steps = [];
    if (hasLicense) steps.push('scan', 'license');
    if (hasAddress) steps.push('address');
    if (!steps.length) return null;
    return {
      license: hasLicense ? { number: licenseNumber.trim(), state: licenseState.trim(), expiry: licenseExpiry } : undefined,
      dob: dob || undefined,
      address: hasAddress ? { line1: addrLine1.trim(), city: addrCity.trim(), state: addrState.trim(), zip: addrZip.trim() } : undefined,
      license_photo_paths: licensePhotoPaths.length ? licensePhotoPaths : undefined,
      steps,
    };
  }

  const prefillSteps = useMemo(() => buildPrefill()?.steps || [], // eslint-disable-line react-hooks/exhaustive-deps
    [idMode, licenseNumber, licenseState, licenseExpiry, dob, addrLine1, addrCity, addrState, addrZip, licensePhotoPaths]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const prefill = buildPrefill();
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        vehicle_code: selectedVehicle?.vehicle_code || vehicleId,
        pickup_date: pickupDate,
        return_date: returnDate,
        pickup_time: pickupTime,
        return_time: returnTime,
        delivery_type: deliveryType,
        delivery_address: deliveryType !== 'pickup' ? deliveryAddress.trim() : undefined,
        unlimited_miles: !!unlimitedMiles,
        unlimited_tolls: !!unlimitedTolls,
        admin_weekly_discount_percent: Math.min(50, Math.max(0, Number(weeklyDiscountPct) || 0)),
        admin_total_cost_override: exactPriceEnabled ? Number(exactPrice) : undefined,
        special_requests: specialRequests.trim() || undefined,
        ...(prefill ? { agreement_prefill: prefill } : {}),
      };
      const res = await api.createAdminBooking(payload);
      setResult({ ...res, prefilledSteps: prefill?.steps || [] });
      onCreated?.();
    } catch (e) {
      setError(e.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() { reset(); onClose?.(); }

  function copyContinueUrl() {
    if (!result?.continue_url) return;
    navigator.clipboard.writeText(result.continue_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  /* ── Success screen ── */
  if (result) {
    const skipped = result.prefilledSteps?.length;
    return (
      <Modal open={open} onClose={handleClose} title="Booking Created" maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl"
            style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <CheckCircle size={20} className="text-emerald-500 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-[var(--text-primary)]">Booking <span className="font-mono">{result.booking_code}</span> created.</p>
              <p className="text-[var(--text-secondary)] mt-0.5">A continue-booking link was emailed to {email}.</p>
            </div>
          </div>

          {skipped ? (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ backgroundColor: 'var(--accent-glow)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <ScanLine size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} />
              <span>The customer's link will skip the ID steps you filled in — they only need to review insurance, sign, and pay.</span>
            </div>
          ) : null}

          <div>
            <label className={fieldLabel}>Continue-booking link (does not expire)</label>
            <div className="flex gap-2">
              <input readOnly value={result.continue_url} className="input flex-1 font-mono text-xs" onFocus={e => e.target.select()} />
              <button type="button" onClick={copyContinueUrl} className="btn-ghost px-3" style={{ border: '1px solid var(--border-subtle)' }}>
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

  const variants = {
    enter: (d) => ({ x: d > 0 ? 28 : -28, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d) => ({ x: d > 0 ? -28 : 28, opacity: 0 }),
  };

  /* ── Wizard ── */
  return (
    <Modal open={open} onClose={handleClose} title="New Booking" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <StepperHeader step={step} />

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="min-h-[340px]">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>

              {/* Step 0 — Dates & pickup */}
              {step === 0 && (
                <div className="space-y-4">
                  <RangeCalendar startDate={pickupDate} endDate={returnDate} onSelect={handleDayClick} />
                  {pickupDate && (
                    <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-sm py-2.5 px-3 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
                      <Calendar size={14} style={{ color: 'var(--accent-color)' }} />
                      <span className="font-medium text-[var(--text-primary)]">{prettyDate(pickupDate)}</span>
                      <ArrowRight size={13} style={{ color: 'var(--text-tertiary)' }} />
                      <span className="font-medium" style={{ color: returnDate ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {returnDate ? prettyDate(returnDate) : 'Return date'}
                      </span>
                      {returnDate && pricingPreview && <span className="text-[var(--text-tertiary)]">· {pricingPreview.rentalDays} day{pricingPreview.rentalDays !== 1 ? 's' : ''}</span>}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={fieldLabel}>Pickup time</label>
                      <select className="input w-full" value={pickupTime} onChange={e => setPickupTime(e.target.value)}>
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={fieldLabel}>Return time</label>
                      <select className="input w-full" value={returnTime} onChange={e => setReturnTime(e.target.value)}>
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>Pickup / delivery</label>
                    <select className="input w-full" value={deliveryType} onChange={e => { setDeliveryType(e.target.value); if (e.target.value === 'pickup') setDeliveryAddress(''); }}>
                      {DELIVERY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {deliveryType !== 'pickup' && (
                      <input className="input w-full mt-2" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Delivery address" />
                    )}
                  </div>
                </div>
              )}

              {/* Step 1 — Vehicle */}
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Available for {prettyDate(pickupDate)} – {prettyDate(returnDate)}{pricingPreview ? ` · ${pricingPreview.rentalDays} day${pricingPreview.rentalDays !== 1 ? 's' : ''}` : ''}.
                  </p>
                  {vehiclesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] py-6 justify-center">
                      <Loader2 size={14} className="animate-spin" /> Checking availability…
                    </div>
                  ) : vehicles.length === 0 ? (
                    <div className="text-xs text-[var(--text-tertiary)] italic p-3 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px dashed var(--border-subtle)' }}>
                      No vehicles available for those dates. Go back and adjust the dates.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {vehicles.map(v => (
                        <VehiclePickCard key={v.id} vehicle={v} selected={vehicleId === v.id} onSelect={setVehicleId} />
                      ))}
                    </div>
                  )}

                  {selectedVehicle && pricingPreview && (
                    <div className="p-3 rounded-xl space-y-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Percent size={15} style={{ color: 'var(--accent-color)' }} />
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">Weekly discount</p>
                            <p className="text-xs text-[var(--text-tertiary)]">Applies automatically to rentals of 7+ days.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={weeklyDiscountPct}
                            onChange={e => setWeeklyDiscountPct(e.target.value)}
                          />
                          <input
                            type="number"
                            min="0"
                            max="50"
                            className="input w-16 text-right"
                            value={weeklyDiscountPct}
                            onChange={e => setWeeklyDiscountPct(e.target.value)}
                          />
                          <span className="text-xs text-[var(--text-tertiary)]">%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <span className="text-[var(--text-tertiary)]">Daily rate</span>
                          <p className="font-bold text-[var(--text-primary)] tabular-nums">{money(pricingPreview.dailyRate)}/day</p>
                        </div>
                        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <span className="text-[var(--text-tertiary)]">Weekly rate</span>
                          <p className="font-bold text-[var(--text-primary)] tabular-nums">{money(pricingPreview.weeklyRate)}/week</p>
                        </div>
                        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <span className="text-[var(--text-tertiary)]">Rental length</span>
                          <p className="font-bold text-[var(--text-primary)]">{pricingPreview.rentalDays} days ({pricingPreview.rateType})</p>
                        </div>
                        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <span className="text-[var(--text-tertiary)]">Weekly savings</span>
                          <p className="font-bold text-emerald-500 tabular-nums">{money(pricingPreview.savings)}</p>
                        </div>
                      </div>

                      <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                        <input type="checkbox" checked={exactPriceEnabled} onChange={e => setExactPriceEnabled(e.target.checked)} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">Set exact rental total</p>
                          <p className="text-xs text-[var(--text-tertiary)]">Manual quote for this booking before deposit and insurance.</p>
                        </div>
                      </label>

                      {exactPriceEnabled && (
                        <div>
                          <label className={fieldLabel}>Exact rental total</label>
                          <div className="relative">
                            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              className="input w-full pl-8"
                              value={exactPrice}
                              onChange={e => setExactPrice(e.target.value)}
                              placeholder={pricingPreview.calculatedTotal.toFixed(2)}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <span className="text-xs text-[var(--text-tertiary)]">Customer checkout rental total</span>
                        <span className="text-base font-bold text-[var(--text-primary)] tabular-nums">{money(pricingPreview.finalTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 — Add-ons */}
              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-secondary)]">Optional. The customer picks insurance on their link.</p>
                  {[
                    { state: unlimitedMiles, set: setUnlimitedMiles, title: 'Unlimited miles', sub: 'Removes the per-day mileage cap. Free on weekly bookings.' },
                    { state: unlimitedTolls, set: setUnlimitedTolls, title: 'Unlimited tolls', sub: 'No per-mile toll passthroughs.' },
                  ].map(({ state, set, title, sub }) => (
                    <button key={title} type="button" onClick={() => set(v => !v)}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer text-left"
                      style={{ backgroundColor: state ? 'var(--accent-glow)' : 'var(--bg-card)', borderColor: state ? 'var(--accent-color)' : 'var(--border-subtle)' }}>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                        <p className="text-[11px] mt-0.5 text-[var(--text-tertiary)]">{sub}</p>
                      </div>
                      <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0"
                        style={{ backgroundColor: state ? 'var(--accent-color)' : 'transparent', borderColor: state ? 'var(--accent-color)' : 'var(--border-subtle)', color: state ? 'var(--accent-fg)' : 'transparent' }}>
                        {state && <Check size={12} strokeWidth={3} />}
                      </div>
                    </button>
                  ))}
                  <div>
                    <label className={fieldLabel}>Special requests (optional)</label>
                    <textarea className="input w-full" rows={3} value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 3 — Customer contact */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={fieldLabel}>First name</label>
                      <input className="input w-full" value={firstName} onChange={e => setFirstName(e.target.value)} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Last name</label>
                      <input className="input w-full" value={lastName} onChange={e => setLastName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>Email</label>
                    <input type="email" className="input w-full" value={email} onChange={e => setEmail(e.target.value)} placeholder="customer@example.com" />
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">If this email exists, the booking attaches to that customer.</p>
                  </div>
                  <div>
                    <label className={fieldLabel}>Phone</label>
                    <input className="input w-full" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(772) 555-0100" />
                  </div>
                </div>
              )}

              {/* Step 4 — ID & details (optional) */}
              {step === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Customer ID &amp; details</h3>
                    <p className="text-[13px] mt-0.5 text-[var(--text-secondary)]">
                      Have the customer's license and address handy? Capture them now and their link skips these steps. Otherwise they'll add it themselves.
                    </p>
                  </div>

                  {/* Gate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" onClick={() => setIdMode('fill')}
                      className="p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5"
                      style={{ backgroundColor: idMode === 'fill' ? 'var(--accent-glow)' : 'var(--bg-card)', borderColor: idMode === 'fill' ? 'var(--accent-color)' : 'var(--border-subtle)' }}>
                      <ScanLine size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-color)' }} />
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">I have the ID now</p>
                        <p className="text-[11px] mt-0.5 text-[var(--text-tertiary)]">Scan or enter it — customer skips these steps.</p>
                      </div>
                    </button>
                    <button type="button" onClick={() => setIdMode('skip')}
                      className="p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5"
                      style={{ backgroundColor: idMode === 'skip' ? 'var(--accent-glow)' : 'var(--bg-card)', borderColor: idMode === 'skip' ? 'var(--accent-color)' : 'var(--border-subtle)' }}>
                      <UserPlus size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Customer adds it</p>
                        <p className="text-[11px] mt-0.5 text-[var(--text-tertiary)]">They'll scan &amp; enter it on their link.</p>
                      </div>
                    </button>
                  </div>

                  {idMode === 'skip' && (
                    <div className="text-xs text-[var(--text-tertiary)] p-3 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px dashed var(--border-subtle)' }}>
                      The customer will scan their license, confirm their address, sign, and pay on the continue link.
                    </div>
                  )}

                  {idMode === 'fill' && (
                    <div className="space-y-4">
                      {showScanner && (
                        <AdminScanStep
                          onApply={applyScan}
                          onPhotoPath={(p) => setLicensePhotoPaths(prev => prev.includes(p) ? prev : [...prev, p])}
                          onManual={() => setShowScanner(false)}
                          bookingName={bookingName}
                          theme={theme}
                        />
                      )}
                      {!showScanner && (
                        <button type="button" onClick={() => setShowScanner(true)}
                          className="w-full min-h-[44px] py-2.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium cursor-pointer"
                          style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-color)' }}>
                          <ScanLine size={15} /> Scan a license
                        </button>
                      )}

                      {/* Editable fields */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={fieldLabel}>First name</label>
                            <input className="input w-full" value={firstName} onChange={e => setFirstName(e.target.value)} />
                          </div>
                          <div>
                            <label className={fieldLabel}>Last name</label>
                            <input className="input w-full" value={lastName} onChange={e => setLastName(e.target.value)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={fieldLabel}>License #</label>
                            <input className="input w-full" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={fieldLabel}>State</label>
                              <input className="input w-full" maxLength={2} value={licenseState} onChange={e => setLicenseState(e.target.value.toUpperCase())} placeholder="FL" />
                            </div>
                            <div>
                              <label className={fieldLabel}>Expiry</label>
                              <input type="date" className="input w-full" value={licenseExpiry} onChange={e => setLicenseExpiry(e.target.value)} />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className={fieldLabel}>Date of birth</label>
                          <input type="date" className="input w-full" value={dob} onChange={e => setDob(e.target.value)} />
                        </div>
                        <div>
                          <label className={fieldLabel}>Address</label>
                          <input className="input w-full" value={addrLine1} onChange={e => setAddrLine1(e.target.value)} placeholder="Street address" />
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <input className="input w-full" value={addrCity} onChange={e => setAddrCity(e.target.value)} placeholder="City" />
                            <input className="input w-full" maxLength={2} value={addrState} onChange={e => setAddrState(e.target.value.toUpperCase())} placeholder="State" />
                            <input className="input w-full" value={addrZip} onChange={e => setAddrZip(e.target.value)} placeholder="ZIP" />
                          </div>
                        </div>
                        {licensePhotoPaths.length > 0 && (
                          <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                            <Check size={12} className="text-emerald-500" /> ID photo on file
                          </p>
                        )}
                        <p className="text-[11px] text-[var(--text-tertiary)]">
                          Leave blank what you don't have — the customer fills the rest. Signature is always done by the customer on their link.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5 — Review */}
              {step === 5 && (
                <div className="space-y-3 text-sm">
                  <div className="p-3 rounded-xl space-y-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <Row k="Vehicle" v={selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : '—'} />
                    <Row k="Pickup" v={`${prettyDate(pickupDate)} ${formatTime(pickupTime)}`} />
                    <Row k="Return" v={`${prettyDate(returnDate)} ${formatTime(returnTime)}`} />
                    <Row k="Customer" v={bookingName || '—'} />
                    <Row k="Email" v={email} />
                    <Row k="Phone" v={phone} />
                    <Row k="Delivery" v={DELIVERY_OPTIONS.find(o => o.value === deliveryType)?.label} />
                    {(unlimitedMiles || unlimitedTolls) && (
                      <Row k="Add-ons" v={[unlimitedMiles && 'Unlimited miles', unlimitedTolls && 'Unlimited tolls'].filter(Boolean).join(', ')} />
                    )}
                  </div>

                  {pricingPreview && (
                    <div className="p-3 rounded-xl space-y-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <Row k="Rental days" v={`${pricingPreview.rentalDays} days (${pricingPreview.rateType})`} />
                      <Row k="Weekly discount" v={`${pricingPreview.discountPct}% (${money(pricingPreview.weeklyRate)}/week)`} />
                      <Row k="Calculated total" v={money(pricingPreview.calculatedTotal)} />
                      {exactPriceEnabled && (
                        <Row k="Exact price adjustment" v={`${pricingPreview.adjustment >= 0 ? '+' : ''}${money(pricingPreview.adjustment)}`} />
                      )}
                      <div className="flex justify-between pt-2 mt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <span className="font-semibold text-[var(--text-primary)]">Rental total sent to checkout</span>
                        <span className="font-bold text-[var(--text-primary)] tabular-nums">{money(pricingPreview.finalTotal)}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Deposit and customer-selected insurance are added in the customer checkout wizard.</p>
                    </div>
                  )}

                  <div className="p-3 rounded-xl flex items-start gap-2"
                    style={{ backgroundColor: prefillSteps.length ? 'var(--accent-glow)' : 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
                    {prefillSteps.length ? <ScanLine size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} /> : <User size={16} className="shrink-0 mt-0.5 text-[var(--text-tertiary)]" />}
                    <span className="text-[var(--text-secondary)] text-[13px]">
                      {prefillSteps.length
                        ? `You pre-filled the customer's ID — their link skips the ${prefillSteps.includes('address') ? 'license & address' : 'license'} steps. They'll review insurance, sign, and pay.`
                        : 'The customer will add their license, address, sign the agreement, and pay on the continue link.'}
                    </span>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button type="button" disabled={step === 0 || submitting} onClick={goBack} className="btn-ghost"
            style={{ border: '1px solid var(--border-subtle)', opacity: step === 0 ? 0.4 : 1 }}>
            <ChevronLeft size={14} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={goNext} className="btn-primary">Next <ChevronRight size={14} /></button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Send size={14} /> Create booking &amp; send link</>}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--text-tertiary)] shrink-0">{k}</span>
      <span className="text-[var(--text-secondary)] text-right">{v}</span>
    </div>
  );
}
