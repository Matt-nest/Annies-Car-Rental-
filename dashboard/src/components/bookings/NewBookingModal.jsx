import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Copy, Send,
  Car, Calendar, User, Sparkles, ScanLine, ArrowRight, Check, CreditCard, UserPlus,
  PenLine, DollarSign, Printer, FileText, Link2,
} from 'lucide-react';
import { api } from '../../api/client';
import { bookingApi } from '../../api/bookingApi';
import Modal from '../shared/Modal';
import RangeCalendar, { prettyDate, parseYMD } from './RangeCalendar';
import VehiclePickCard from './VehiclePickCard';
import AdminScanStep from './AdminScanStep';
import SignaturePadField from './SignaturePadField';
import StripeCardCharge from './StripeCardCharge';

/**
 * NewBookingModal — one streamlined flow for setting up a rental, forking late on
 * the only two questions that actually change the work:
 *   1. Who captures ID + signature?  → the customer (link) or the admin (in person)
 *   2. How is money collected?       → Stripe (link) or recorded direct-to-admin
 *
 * Spine: Dates → Vehicle (+rate/deposit override) → Add-ons → Customer (contact
 * only) → Method. Then:
 *   • Send link    → optional ID prefill → Review → create + email continue link
 *   • In person    → ID → Signatures → Payment → Review → create (approved) +
 *                    record payment + generate & archive the contract
 * Underneath it reuses the existing payment-recording, contract PDF, and document
 * archive — no parallel systems.
 */

const BASE_STEPS = [
  { key: 'dates',       label: 'Dates',    icon: Calendar },
  { key: 'vehicle',     label: 'Vehicle',  icon: Car },
  { key: 'addons',      label: 'Add-ons',  icon: Sparkles },
  { key: 'customer',    label: 'Customer', icon: User },
  { key: 'fulfillment', label: 'Method',   icon: Send },
];
const LINK_TAIL      = [{ key: 'id', label: 'ID', icon: CreditCard }, { key: 'review', label: 'Review', icon: CheckCircle }];
const INPERSON_TAIL  = [
  { key: 'id',      label: 'ID',      icon: CreditCard },
  { key: 'sign',    label: 'Sign',    icon: PenLine },
  { key: 'payment', label: 'Payment', icon: DollarSign },
  { key: 'review',  label: 'Review',  icon: CheckCircle },
];
const REVIEW_ONLY = [{ key: 'review', label: 'Review', icon: CheckCircle }];

const DELIVERY_OPTIONS = [
  { value: 'pickup',               label: 'Pickup at our lot' },
  { value: 'psl_delivery',         label: 'Delivery — Port St. Lucie (+$39)' },
  { value: 'surrounding_delivery', label: 'Delivery — surrounding area (+$49)' },
];
const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'card', label: 'Card (external terminal)' },
];

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const formatTime = (t) => { const hr = parseInt(t.split(':')[0]); const m = t.split(':')[1]; return `${hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr)}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };
const currentTheme = () => (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? 'dark' : 'light';
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Surface backend validation `details` (e.g. "email is required") instead of a bare "Validation failed".
const errMsg = (e, fallback) => {
  const d = e?.data?.details;
  if (Array.isArray(d) && d.length) return `${e.message}: ${d.join(', ')}`;
  return e?.message || fallback;
};

const fieldLabel = 'text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block';

function StepperHeader({ steps, step }) {
  return (
    <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
      {steps.map((s, i) => {
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
            <span className="text-xs font-medium hidden sm:block" style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
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

  // Vehicle + rate/deposit override
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [customRate, setCustomRate] = useState('');     // daily rate ($); '' = vehicle standard
  const [customDeposit, setCustomDeposit] = useState(''); // deposit ($); '' = vehicle standard

  // Add-ons
  const [unlimitedMiles, setUnlimitedMiles] = useState(false);
  const [unlimitedTolls, setUnlimitedTolls] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');

  // Customer contact
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Fulfillment fork
  const [fulfillment, setFulfillment] = useState(null); // null | 'link' | 'in_person'

  // ID & details (shared by both forks)
  const [idMode, setIdMode] = useState(null); // link path gate: null | 'fill' | 'skip'
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

  // In-person signatures
  const [signatureMode, setSignatureMode] = useState('digital'); // 'digital' | 'wet'
  const [customerSignature, setCustomerSignature] = useState(null);
  const [ownerSignature, setOwnerSignature] = useState(null);

  // In-person payment
  const [payStatus, setPayStatus] = useState('paid'); // 'paid' | 'stripe' | 'pending'
  const [payMethod, setPayMethod] = useState('cash');
  const [payAmount, setPayAmount] = useState('');
  const [payReference, setPayReference] = useState('');

  // Full-fee quote for the Review receipt (mirrors createBooking pricing).
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  function reset() {
    setStep(0); setDir(1); setError(''); setSubmitting(false); setResult(null); setCopied(false);
    setPickupDate(''); setReturnDate(''); setPickupTime('10:00'); setReturnTime('10:00');
    setDeliveryType('pickup'); setDeliveryAddress('');
    setVehicles([]); setVehicleId(''); setCustomRate(''); setCustomDeposit('');
    setUnlimitedMiles(false); setUnlimitedTolls(false); setSpecialRequests('');
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setFulfillment(null);
    setIdMode(null); setShowScanner(true);
    setLicenseNumber(''); setLicenseState(''); setLicenseExpiry(''); setDob('');
    setAddrLine1(''); setAddrCity(''); setAddrState(''); setAddrZip(''); setLicensePhotoPaths([]);
    setSignatureMode('digital'); setCustomerSignature(null); setOwnerSignature(null);
    setPayStatus('paid'); setPayMethod('cash'); setPayAmount(''); setPayReference('');
    setQuote(null); setQuoteLoading(false);
  }

  // Dynamic step list — base spine, then a tail chosen by fulfillment.
  const steps = useMemo(() => {
    if (fulfillment === 'in_person') return [...BASE_STEPS, ...INPERSON_TAIL];
    if (fulfillment === 'link') return [...BASE_STEPS, ...LINK_TAIL];
    return [...BASE_STEPS, ...REVIEW_ONLY];
  }, [fulfillment]);
  const stepKey = steps[step]?.key;

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

  // Seed the override fields with the vehicle's standard rate/deposit on select.
  useEffect(() => {
    if (!selectedVehicle) return;
    setCustomRate(selectedVehicle.daily_rate != null ? String(selectedVehicle.daily_rate) : '');
    setCustomDeposit(selectedVehicle.deposit_amount != null ? String(selectedVehicle.deposit_amount) : '');
  }, [vehicleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stdRate = selectedVehicle?.daily_rate != null ? Number(selectedVehicle.daily_rate) : null;
  const stdDeposit = selectedVehicle?.deposit_amount != null ? Number(selectedVehicle.deposit_amount) : null;
  const effectiveRate = customRate !== '' && !Number.isNaN(Number(customRate)) ? Number(customRate) : stdRate;
  const rateChanged = stdRate != null && effectiveRate != null && Number(effectiveRate) !== Number(stdRate);
  const depositChanged = stdDeposit != null && customDeposit !== '' && Number(customDeposit) !== Number(stdDeposit);

  const rentalDays = useMemo(() => {
    if (!pickupDate || !returnDate || returnDate <= pickupDate) return 0;
    return Math.round((parseYMD(returnDate) - parseYMD(pickupDate)) / 86400000);
  }, [pickupDate, returnDate]);

  const estimate = useMemo(() => {
    if (effectiveRate == null || rentalDays <= 0) return null;
    return Number(effectiveRate) * rentalDays;
  }, [effectiveRate, rentalDays]);

  const bookingName = `${firstName} ${lastName}`.trim();

  // Default the in-person payment amount to the rough estimate once we have one.
  useEffect(() => {
    if (stepKey === 'payment' && payAmount === '' && estimate != null) setPayAmount(String(estimate));
  }, [stepKey, estimate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the real fee breakdown when the Review step opens (single source of
  // truth — same computeRentalPricing the backend uses on create).
  useEffect(() => {
    if (stepKey !== 'review' || !selectedVehicle) return;
    let cancelled = false;
    setQuoteLoading(true); setQuote(null);
    bookingApi.adminQuote({
      vehicle_code: selectedVehicle.vehicle_code || vehicleId,
      pickup_date: pickupDate,
      return_date: returnDate,
      delivery_type: deliveryType,
      unlimited_miles: !!unlimitedMiles,
      unlimited_tolls: !!unlimitedTolls,
      ...overridePayload(),
    })
      .then(q => { if (!cancelled) setQuote(q); })
      .catch(() => { if (!cancelled) setQuote(null); })
      .finally(() => { if (!cancelled) setQuoteLoading(false); });
    return () => { cancelled = true; };
  }, [stepKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDayClick(ymd) {
    setError('');
    if (!pickupDate || (pickupDate && returnDate)) { setPickupDate(ymd); setReturnDate(''); return; }
    if (ymd < pickupDate) { setPickupDate(ymd); setReturnDate(''); return; }
    setReturnDate(ymd);
  }

  function applyScan(p) {
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

  const hasLicense = !!licenseNumber.trim();
  const hasAddress = !!(addrLine1.trim() && addrCity.trim());

  // Link path: agreement_prefill from whatever the admin captured.
  function buildPrefill() {
    if (idMode !== 'fill') return null;
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

  // Common override fields for createAdminBooking. Only send overrides when changed.
  function overridePayload() {
    return {
      ...(rateChanged ? { custom_daily_rate: Number(customRate) } : {}),
      ...(depositChanged ? { custom_deposit_amount: Number(customDeposit) } : {}),
    };
  }
  function baseBookingPayload() {
    return {
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
      special_requests: specialRequests.trim() || undefined,
      ...overridePayload(),
    };
  }

  function canAdvance() {
    setError('');
    if (stepKey === 'dates') {
      if (!pickupDate || !returnDate) { setError('Pick both pickup and return dates.'); return false; }
      if (returnDate <= pickupDate) { setError('Return must be after pickup.'); return false; }
      if (deliveryType !== 'pickup' && !deliveryAddress.trim()) { setError('Delivery address required for delivery options.'); return false; }
    } else if (stepKey === 'vehicle') {
      if (!vehicleId) { setError('Select a vehicle.'); return false; }
      if (customRate !== '' && (Number.isNaN(Number(customRate)) || Number(customRate) < 0)) { setError('Enter a valid daily rate.'); return false; }
      if (customDeposit !== '' && (Number.isNaN(Number(customDeposit)) || Number(customDeposit) < 0)) { setError('Enter a valid deposit.'); return false; }
    } else if (stepKey === 'customer') {
      if (!firstName.trim() || !lastName.trim()) { setError('First and last name required.'); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('A valid email is required (for the receipt/contract copy and link).'); return false; }
      if (!phone.trim()) { setError('Phone is required.'); return false; }
    } else if (stepKey === 'fulfillment') {
      if (!fulfillment) { setError('Choose how you’re completing this booking.'); return false; }
    } else if (stepKey === 'id' && fulfillment === 'link') {
      if (idMode === null) { setError("Choose whether you'll add the customer's ID now, or let them add it on their link."); return false; }
    } else if (stepKey === 'sign') {
      if (signatureMode === 'digital' && !customerSignature) { setError('Capture the customer’s signature, or switch to print & sign on paper.'); return false; }
    } else if (stepKey === 'payment') {
      if (payStatus === 'paid') {
        if (!payAmount || Number.isNaN(Number(payAmount)) || Number(payAmount) <= 0) { setError('Enter the amount the customer paid.'); return false; }
      }
    }
    return true;
  }

  function goNext() { if (canAdvance()) { setDir(1); setStep(s => Math.min(s + 1, steps.length - 1)); } }
  function goBack() { setError(''); setDir(-1); setStep(s => Math.max(0, s - 1)); }

  async function handleSubmitLink() {
    if (submitting) return;
    setSubmitting(true); setError('');
    try {
      const prefill = buildPrefill();
      const res = await api.createAdminBooking({
        ...baseBookingPayload(),
        fulfillment: 'link',
        ...(prefill ? { agreement_prefill: prefill } : {}),
      });
      setResult({ mode: 'link', ...res, prefilledSteps: prefill?.steps || [] });
      onCreated?.();
    } catch (e) {
      setError(errMsg(e, 'Failed to create booking'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitInPerson() {
    if (submitting) return;
    setSubmitting(true); setError('');
    try {
      // 1. Create the booking (already-approved, no customer emails).
      const res = await api.createAdminBooking({ ...baseBookingPayload(), fulfillment: 'in_person' });
      const bookingId = res.booking_id;

      // 2. Record the direct payment, if collected. (Stripe-over-phone is handled
      //    on the success screen — it needs the booking to exist first.)
      let paymentRecorded = false;
      if (payStatus === 'paid' && Number(payAmount) > 0) {
        await api.recordPayment(bookingId, {
          payment_type: 'rental',
          amount: Number(payAmount),
          method: payMethod,
          reference_id: payReference.trim() || undefined,
          notes: 'In-person admin booking',
        });
        paymentRecorded = true;
      }

      // 3. Generate + archive the contract.
      const agRes = await bookingApi.adminGenerateAgreement(bookingId, {
        address_line1: addrLine1.trim() || undefined,
        city: addrCity.trim() || undefined,
        state: addrState.trim() || undefined,
        zip: addrZip.trim() || undefined,
        date_of_birth: dob || undefined,
        driver_license_number: licenseNumber.trim() || undefined,
        driver_license_state: licenseState.trim() || undefined,
        driver_license_expiry: licenseExpiry || undefined,
        customer_signature_data: signatureMode === 'digital' ? customerSignature : null,
        owner_signature_data: signatureMode === 'digital' ? ownerSignature : null,
        signature_mode: signatureMode,
        license_photo_paths: licensePhotoPaths.length ? licensePhotoPaths : undefined,
      });

      setResult({
        mode: 'in_person',
        booking_id: bookingId,
        booking_code: res.booking_code,
        document: agRes.document || null,
        signature_mode: signatureMode,
        paymentRecorded,
        payAmount: paymentRecorded ? Number(payAmount) : 0,
        payMethod,
        needsStripe: payStatus === 'stripe',  // collect the card on the success screen
        stripeCharged: false,
      });
      onCreated?.();
    } catch (e) {
      setError(errMsg(e, 'Failed to complete booking'));
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadContract(documentId) {
    try {
      const { url } = await bookingApi.downloadDocument(documentId);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e.message || 'Could not open the contract.');
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

  /* ── Success screens ── */
  if (result?.mode === 'link') {
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

  if (result?.mode === 'in_person') {
    const wet = result.signature_mode === 'wet';
    return (
      <Modal open={open} onClose={handleClose} title="Booking Completed" maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl"
            style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <CheckCircle size={20} className="text-emerald-500 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-[var(--text-primary)]">Booking <span className="font-mono">{result.booking_code}</span> created & approved.</p>
              <p className="text-[var(--text-secondary)] mt-0.5">
                {result.stripeCharged ? 'Card charged successfully. '
                  : result.needsStripe ? 'Enter the card below to charge. '
                  : result.paymentRecorded ? `${money(result.payAmount)} recorded via ${result.payMethod}. `
                  : 'No payment recorded yet. '}
                Contract generated and filed in the customer's documents.
              </p>
            </div>
          </div>

          {result.needsStripe && !result.stripeCharged && (
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Take payment over the phone</p>
              <StripeCardCharge bookingCode={result.booking_code} onSuccess={() => setResult(r => ({ ...r, stripeCharged: true }))} />
            </div>
          )}

          {wet && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px dashed var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <Printer size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} />
              <span>Print the contract below and have both parties sign on paper. The signed copy is on file in the customer's documents.</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {result.document && (
              <button type="button" onClick={() => downloadContract(result.document.id)} className="btn-primary">
                <FileText size={14} /> {wet ? 'Open contract to print' : 'Download contract'}
              </button>
            )}
            <a href={`/bookings/${result.booking_id}`} className="btn-ghost" style={{ border: '1px solid var(--border-subtle)' }}>
              Open booking <ArrowRight size={14} />
            </a>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
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
  const isLast = step === steps.length - 1;

  /* ── Wizard ── */
  return (
    <Modal open={open} onClose={handleClose} title="New Booking" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <StepperHeader steps={steps} step={step} />

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="min-h-[340px]">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={stepKey} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>

              {/* Dates */}
              {stepKey === 'dates' && (
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
                      {returnDate && rentalDays > 0 && <span className="text-[var(--text-tertiary)]">· {rentalDays} day{rentalDays !== 1 ? 's' : ''}</span>}
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

              {/* Vehicle + rate/deposit override */}
              {stepKey === 'vehicle' && (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Available for {prettyDate(pickupDate)} – {prettyDate(returnDate)}{rentalDays > 0 ? ` · ${rentalDays} day${rentalDays !== 1 ? 's' : ''}` : ''}.
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

                  {selectedVehicle && (
                    <div className="p-3 rounded-xl space-y-3" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={fieldLabel}>Daily rate</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">$</span>
                            <input className="input w-full pl-6" inputMode="decimal" value={customRate} onChange={e => setCustomRate(e.target.value)} />
                          </div>
                          <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                            {stdRate != null ? `Standard ${money(stdRate)}/day` : 'Standard rate'}{rateChanged ? ' · custom' : ''}
                          </p>
                        </div>
                        <div>
                          <label className={fieldLabel}>Deposit</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">$</span>
                            <input className="input w-full pl-6" inputMode="decimal" value={customDeposit} onChange={e => setCustomDeposit(e.target.value)} placeholder={stdDeposit != null ? String(stdDeposit) : 'Standard'} />
                          </div>
                          <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                            {stdDeposit != null ? `Standard ${money(stdDeposit)}` : 'Vehicle standard'}{depositChanged ? ' · custom' : ''}
                          </p>
                        </div>
                      </div>
                      {estimate != null && (
                        <div className="flex justify-between items-center text-sm pt-1">
                          <span className="text-[var(--text-tertiary)]">Est. rental ({rentalDays} day{rentalDays !== 1 ? 's' : ''}{rateChanged ? ', custom rate' : ''})</span>
                          <span className="font-bold tabular-nums text-[var(--text-primary)]">{money(estimate)}</span>
                        </div>
                      )}
                      <p className="text-[11px] text-[var(--text-tertiary)]">Final tax & weekly discounts are computed on creation.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Add-ons */}
              {stepKey === 'addons' && (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-secondary)]">Optional — leave everything off if the customer doesn't need add-ons. Insurance is chosen separately.</p>
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
                </div>
              )}

              {/* Customer — contact only */}
              {stepKey === 'customer' && (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-secondary)]">Just enough to reach them. License & address come from the ID scan or the customer's link — no need to re-type them here.</p>
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
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Where the receipt/contract copy (and the link, if you send one) go. If this email exists, the booking attaches to that customer.</p>
                  </div>
                  <div>
                    <label className={fieldLabel}>Phone</label>
                    <input className="input w-full" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(772) 555-0100" />
                  </div>
                </div>
              )}

              {/* Fulfillment fork */}
              {stepKey === 'fulfillment' && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">How are you completing this booking?</h3>
                    <p className="text-[13px] mt-0.5 text-[var(--text-secondary)]">This decides the remaining steps.</p>
                  </div>
                  <button type="button" onClick={() => setFulfillment('link')}
                    className="w-full p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3"
                    style={{ backgroundColor: fulfillment === 'link' ? 'var(--accent-glow)' : 'var(--bg-card)', borderColor: fulfillment === 'link' ? 'var(--accent-color)' : 'var(--border-subtle)' }}>
                    <Link2 size={20} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-color)' }} />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Send the customer a link</p>
                      <p className="text-[12px] mt-0.5 text-[var(--text-tertiary)]">They scan their ID, sign, and pay online with a card (Stripe). You can pre-fill their ID to skip steps.</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => setFulfillment('in_person')}
                    className="w-full p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3"
                    style={{ backgroundColor: fulfillment === 'in_person' ? 'var(--accent-glow)' : 'var(--bg-card)', borderColor: fulfillment === 'in_person' ? 'var(--accent-color)' : 'var(--border-subtle)' }}>
                    <PenLine size={20} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-color)' }} />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Complete it in person</p>
                      <p className="text-[12px] mt-0.5 text-[var(--text-tertiary)]">Scan their ID, capture signatures (or print to sign), record how they paid you directly, and generate the contract now.</p>
                    </div>
                  </button>
                </div>
              )}

              {/* ID — link path (gate) */}
              {stepKey === 'id' && fulfillment === 'link' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Customer ID &amp; details</h3>
                    <p className="text-[13px] mt-0.5 text-[var(--text-secondary)]">
                      Have their license &amp; address handy? Capture them now and the link skips those steps. Otherwise they'll add it themselves.
                    </p>
                  </div>
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
                    <IdFields
                      {...{ showScanner, setShowScanner, applyScan, setLicensePhotoPaths, bookingName, theme,
                        licenseNumber, setLicenseNumber, licenseState, setLicenseState, licenseExpiry, setLicenseExpiry,
                        dob, setDob, addrLine1, setAddrLine1, addrCity, setAddrCity, addrState, setAddrState, addrZip, setAddrZip,
                        licensePhotoPaths }}
                      footnote="Leave blank what you don't have — the customer fills the rest. Signature is always done by the customer on their link."
                    />
                  )}
                </div>
              )}

              {/* ID — in-person path (always capture) */}
              {stepKey === 'id' && fulfillment === 'in_person' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Scan the customer's ID</h3>
                    <p className="text-[13px] mt-0.5 text-[var(--text-secondary)]">
                      Scan or enter their license &amp; address. Leave blank what you don't have — the contract can still be generated and signed.
                    </p>
                  </div>
                  <IdFields
                    {...{ showScanner, setShowScanner, applyScan, setLicensePhotoPaths, bookingName, theme,
                      licenseNumber, setLicenseNumber, licenseState, setLicenseState, licenseExpiry, setLicenseExpiry,
                      dob, setDob, addrLine1, setAddrLine1, addrCity, setAddrCity, addrState, setAddrState, addrZip, setAddrZip,
                      licensePhotoPaths }}
                    footnote="These fields fill the rental contract. Anything left blank prints as a blank line to complete by hand."
                  />
                </div>
              )}

              {/* Signatures — in-person */}
              {stepKey === 'sign' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Signatures</h3>
                    <p className="text-[13px] mt-0.5 text-[var(--text-secondary)]">Sign on this device now, or print the contract and sign on paper.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { mode: 'digital', icon: PenLine, title: 'Sign on this device', sub: 'Customer + you sign here now.' },
                      { mode: 'wet', icon: Printer, title: 'Print & sign on paper', sub: 'Generate a blank contract to sign by hand.' },
                    ].map(({ mode, icon: Icon, title, sub }) => (
                      <button key={mode} type="button" onClick={() => setSignatureMode(mode)}
                        className="p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5"
                        style={{ backgroundColor: signatureMode === mode ? 'var(--accent-glow)' : 'var(--bg-card)', borderColor: signatureMode === mode ? 'var(--accent-color)' : 'var(--border-subtle)' }}>
                        <Icon size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-color)' }} />
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                          <p className="text-[11px] mt-0.5 text-[var(--text-tertiary)]">{sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {signatureMode === 'digital' ? (
                    <div className="space-y-4">
                      <SignaturePadField label="Customer signature" onChange={setCustomerSignature} hint="Have the customer sign above." />
                      <SignaturePadField label="Your counter-signature (optional)" onChange={setOwnerSignature} hint="Sign to fully execute the contract now, or counter-sign later." />
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--text-tertiary)] p-3 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px dashed var(--border-subtle)' }}>
                      The contract will generate with blank signature lines. Print it from the next screen and have both parties sign.
                    </div>
                  )}
                </div>
              )}

              {/* Payment — in-person */}
              {stepKey === 'payment' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">How did the customer pay?</h3>
                    <p className="text-[13px] mt-0.5 text-[var(--text-secondary)]">Record a direct payment (paid to you), or mark it as owed for now.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { v: 'paid', title: 'Paid me directly', sub: 'Cash, Zelle, Venmo, etc.' },
                      { v: 'stripe', title: 'Charge a card now', sub: 'Take the card over the phone (Stripe).' },
                      { v: 'pending', title: 'Not paid yet', sub: 'Record what’s owed later.' },
                    ].map(({ v, title, sub }) => (
                      <button key={v} type="button" onClick={() => setPayStatus(v)}
                        className="p-3.5 rounded-xl border text-left transition-all cursor-pointer"
                        style={{ backgroundColor: payStatus === v ? 'var(--accent-glow)' : 'var(--bg-card)', borderColor: payStatus === v ? 'var(--accent-color)' : 'var(--border-subtle)' }}>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                        <p className="text-[11px] mt-0.5 text-[var(--text-tertiary)]">{sub}</p>
                      </button>
                    ))}
                  </div>
                  {payStatus === 'stripe' && (
                    <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
                      style={{ backgroundColor: 'var(--accent-glow)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <CreditCard size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} />
                      <span>After you create the booking, a secure card form opens so you can enter the customer’s card and charge the rental total + deposit on the spot.</span>
                    </div>
                  )}
                  {payStatus === 'paid' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={fieldLabel}>Method</label>
                          <select className="input w-full" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                            {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={fieldLabel}>Amount paid</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">$</span>
                            <input className="input w-full pl-6" inputMode="decimal" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className={fieldLabel}>Reference (optional)</label>
                        <input className="input w-full" value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="Zelle confirmation #, etc." />
                      </div>
                      {estimate != null && (
                        <p className="text-[11px] text-[var(--text-tertiary)]">Estimated rental total {money(estimate)} (before tax/fees). Adjust the amount to what was actually collected.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Review */}
              {stepKey === 'review' && (
                <div className="space-y-3 text-sm">
                  <div className="p-3 rounded-xl space-y-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <Row k="Vehicle" v={selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : '—'} />
                    <Row k="Pickup" v={`${prettyDate(pickupDate)} ${formatTime(pickupTime)}`} />
                    <Row k="Return" v={`${prettyDate(returnDate)} ${formatTime(returnTime)}`} />
                    <Row k="Daily rate" v={`${money(effectiveRate)}${rateChanged ? ' (custom)' : ''}`} />
                    {(customDeposit !== '' || stdDeposit != null) && (
                      <Row k="Deposit" v={`${money(customDeposit !== '' ? Number(customDeposit) : stdDeposit)}${depositChanged ? ' (custom)' : ''}`} />
                    )}
                    <Row k="Customer" v={bookingName || '—'} />
                    {email && <Row k="Email" v={email} />}
                    {phone && <Row k="Phone" v={phone} />}
                    <Row k="Delivery" v={DELIVERY_OPTIONS.find(o => o.value === deliveryType)?.label} />
                    {(unlimitedMiles || unlimitedTolls) && (
                      <Row k="Add-ons" v={[unlimitedMiles && 'Unlimited miles', unlimitedTolls && 'Unlimited tolls'].filter(Boolean).join(', ')} />
                    )}
                  </div>

                  {/* Receipt — real fees from the server quote (same math as create) */}
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Receipt</p>
                    {quoteLoading ? (
                      <div className="flex items-center gap-2 text-[var(--text-tertiary)] py-2"><Loader2 size={14} className="animate-spin" /> Calculating totals…</div>
                    ) : quote ? (
                      <div className="space-y-1">
                        {(quote.line_items || []).map((li, i) => (
                          <Row key={i} k={li.label} v={`${li.amount < 0 ? '−' : ''}${money(Math.abs(li.amount))}`} />
                        ))}
                        <div className="border-t my-1.5" style={{ borderColor: 'var(--border-subtle)' }} />
                        <div className="flex justify-between gap-4 text-sm font-semibold text-[var(--text-primary)]">
                          <span>Rental total{quote.rate_overridden ? ' (custom rate)' : ''}</span>
                          <span className="tabular-nums">{money(quote.total_cost)}</span>
                        </div>
                        <Row k={`Security deposit${quote.deposit_overridden ? ' (custom)' : ''}`} v={money(quote.deposit_amount)} />
                        <div className="flex justify-between gap-4 text-sm font-bold text-[var(--text-primary)] pt-0.5">
                          <span>{fulfillment === 'in_person' && payStatus === 'stripe' ? 'Card charge (total + deposit)' : 'Total + deposit'}</span>
                          <span className="tabular-nums">{money(quote.total_with_deposit)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[var(--text-tertiary)] text-xs">Couldn’t load totals — they’ll be finalized on create.</p>
                    )}
                  </div>

                  {fulfillment === 'in_person' ? (
                    <div className="p-3 rounded-xl space-y-1" style={{ backgroundColor: 'var(--accent-glow)', border: '1px solid var(--border-subtle)' }}>
                      <Row k="Method" v="Complete in person (approved on create)" />
                      <Row k="Signatures" v={signatureMode === 'digital' ? `On device${ownerSignature ? ' · fully executed' : ' · customer only'}` : 'Print & sign on paper'} />
                      <Row k="Payment" v={
                        payStatus === 'paid' ? `${money(Number(payAmount || 0))} via ${PAY_METHODS.find(m => m.value === payMethod)?.label}`
                        : payStatus === 'stripe' ? 'Charge card after create (Stripe)'
                        : 'Not paid yet'} />
                      <Row k="Contract" v="Generated & filed in customer documents" />
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl flex items-start gap-2"
                      style={{ backgroundColor: prefillSteps.length ? 'var(--accent-glow)' : 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
                      {prefillSteps.length ? <ScanLine size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} /> : <User size={16} className="shrink-0 mt-0.5 text-[var(--text-tertiary)]" />}
                      <span className="text-[var(--text-secondary)] text-[13px]">
                        {prefillSteps.length
                          ? `You pre-filled the customer's ID — their link skips the ${prefillSteps.includes('address') ? 'license & address' : 'license'} steps. They'll review insurance, sign, and pay.`
                          : 'The customer will add their license, address, sign the agreement, and pay on the continue link.'}
                      </span>
                    </div>
                  )}
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
          {!isLast ? (
            <button type="button" onClick={goNext} className="btn-primary">Next <ChevronRight size={14} /></button>
          ) : fulfillment === 'in_person' ? (
            <button type="button" onClick={handleSubmitInPerson} disabled={submitting} className="btn-primary">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Working…</> : <><FileText size={14} /> Create &amp; generate contract</>}
            </button>
          ) : (
            <button type="button" onClick={handleSubmitLink} disabled={submitting} className="btn-primary">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Send size={14} /> Create booking &amp; send link</>}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Shared editable ID block (scanner + fields), used by both forks.
function IdFields({
  showScanner, setShowScanner, applyScan, setLicensePhotoPaths, bookingName, theme,
  licenseNumber, setLicenseNumber, licenseState, setLicenseState, licenseExpiry, setLicenseExpiry,
  dob, setDob, addrLine1, setAddrLine1, addrCity, setAddrCity, addrState, setAddrState, addrZip, setAddrZip,
  licensePhotoPaths, footnote,
}) {
  // While the scanner is up, show ONLY the scan UI (it has its own "Enter details
  // by hand" button → collapses the scanner). The editable fields appear once the
  // scanner is collapsed — either after a successful scan (pre-filled) or when the
  // admin chooses manual entry — so the step isn't a wall of empty inputs.
  if (showScanner) {
    return (
      <AdminScanStep
        onApply={applyScan}
        onPhotoPath={(p) => setLicensePhotoPaths(prev => prev.includes(p) ? prev : [...prev, p])}
        onManual={() => setShowScanner(false)}
        bookingName={bookingName}
        theme={theme}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setShowScanner(true)}
        className="w-full min-h-[44px] py-2.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium cursor-pointer"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-color)' }}>
        <ScanLine size={15} /> Scan a license instead
      </button>
      <div className="space-y-3">
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
        <p className="text-[11px] text-[var(--text-tertiary)]">{footnote}</p>
      </div>
    </div>
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
