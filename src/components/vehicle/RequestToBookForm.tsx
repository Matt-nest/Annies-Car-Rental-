import React, { useState } from 'react';
import {
  ArrowRight, ArrowLeft, CheckCircle2, Loader2, AlertCircle, Check,
  Infinity, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle, BookingRequest, DeliveryOption, RateMode } from '../../types';
import { getVehicleDisplayName } from '../../data/vehicles';
import { useTheme } from '../../context/ThemeContext';
import { API_URL, RECAPTCHA_SITE_KEY } from '../../config';
import { calcRentalDays, calcPriceBreakdown, displayPrice } from '../../utils/pricing';
import WeeklyUpsell from './WeeklyUpsell';
import { brand } from '../../config/brand';

interface RequestToBookFormProps {
  vehicle: Vehicle;
  selectedRate?: RateMode;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
// All dates are handled as local 'YYYY-MM-DD' strings to match the booking API
// and to avoid the UTC drift that `toISOString()` introduces.
const pad = (n: number) => String(n).padStart(2, '0');
const toYMD = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const prettyDate = (s: string) => { if (!s) return ''; const d = parseYMD(s); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };

const STEPS = [
  { label: 'Dates' },
  { label: 'Pickup & Delivery' },
  { label: 'Add-ons' },
  { label: 'Your Details' },
  { label: 'Review' },
] as const;

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

// ── Native two-click range calendar ───────────────────────────────────────────
function RangeCalendar({
  startDate, endDate, onSelect,
}: { startDate: string; endDate: string; onSelect: (ymd: string) => void }) {
  const today = new Date();
  const todayYMD = toYMD(today.getFullYear(), today.getMonth(), today.getDate());
  const anchor = startDate ? parseYMD(startDate) : today;
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const canGoPrev = view.y > today.getFullYear() || (view.y === today.getFullYear() && view.m > today.getMonth());
  const goPrev = () => { if (!canGoPrev) return; setView(v => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })); };
  const goNext = () => setView(v => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button" onClick={goPrev} disabled={!canGoPrev}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[var(--bg-card-hover)]"
          style={{ color: 'var(--text-secondary)' }} aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{MONTHS[view.m]} {view.y}</span>
        <button
          type="button" onClick={goNext}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-[var(--bg-card-hover)]"
          style={{ color: 'var(--text-secondary)' }} aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wider py-1" style={{ color: 'var(--text-tertiary)' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const ymd = toYMD(view.y, view.m, day);
          const disabled = ymd < todayYMD;
          const isStart = ymd === startDate;
          const isEnd = ymd === endDate;
          const inRange = !!startDate && !!endDate && ymd > startDate && ymd < endDate;
          const isEdge = isStart || isEnd;
          return (
            <div
              key={ymd}
              className="flex justify-center"
              style={inRange ? { backgroundColor: 'color-mix(in srgb, var(--accent-color) 14%, transparent)' } : undefined}
            >
              <button
                type="button" disabled={disabled} onClick={() => onSelect(ymd)}
                className={`w-9 h-9 text-[13px] flex items-center justify-center rounded-full transition-all duration-200 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                style={{
                  backgroundColor: isEdge ? 'var(--accent)' : 'transparent',
                  color: disabled ? 'var(--text-tertiary)' : isEdge ? 'var(--accent-fg)' : 'var(--text-primary)',
                  opacity: disabled ? 0.3 : 1,
                  fontWeight: isEdge ? 600 : 400,
                  boxShadow: isEdge ? '0 4px 14px color-mix(in srgb, var(--accent-color) 45%, transparent)' : 'none',
                }}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RequestToBookForm({ vehicle, selectedRate = 'daily' }: RequestToBookFormProps) {
  const { theme } = useTheme();

  const DELIVERY_FEES: Record<DeliveryOption, number> = {
    pickup:               0,
    psl_delivery:         39,
    surrounding_delivery: 49,
  };

  const [formData, setFormData] = useState<BookingRequest>({
    firstName: '', lastName: '', phone: '', email: '',
    startDate: '', endDate: '', pickupTime: '10:00', returnTime: '10:00',
    deliveryOption: 'pickup', deliveryAddress: '',
    notes: '',
    unlimitedMiles: false, unlimitedTolls: false,
    vehicleId: vehicle.id, vehicleName: getVehicleDisplayName(vehicle), vehicleDailyRate: vehicle.dailyRate,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [refCode, setRefCode] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Wizard navigation state
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const handleChange =(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  // Calendar two-click highlighter: 1st click sets start, 2nd sets end, 3rd restarts.
  const handleDayClick = (ymd: string) => {
    setErrors(prev => { const n = { ...prev }; delete n.startDate; delete n.endDate; return n; });
    setFormData(prev => {
      if (!prev.startDate || (prev.startDate && prev.endDate)) return { ...prev, startDate: ymd, endDate: '' };
      if (ymd < prev.startDate) return { ...prev, startDate: ymd, endDate: '' };
      return { ...prev, endDate: ymd };
    });
  };

  // Per-step validation gates the "Continue" button.
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!formData.startDate) errs.startDate = 'Select a start date to continue.';
      else if (!formData.endDate) errs.endDate = 'Select an end date to continue.';
    }
    if (s === 1) {
      if (formData.deliveryOption !== 'pickup' && !formData.deliveryAddress.trim()) errs.deliveryAddress = 'Required for delivery';
    }
    if (s === 3) {
      if (!formData.firstName.trim()) errs.firstName = 'Required';
      if (!formData.lastName.trim()) errs.lastName = 'Required';
      if (!formData.phone.trim()) errs.phone = 'Required';
      if (!formData.email.trim()) errs.email = 'Required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => { if (validateStep(step)) { setDir(1); setStep(s => Math.min(s + 1, STEPS.length - 1)); } };
  const back = () => { setDir(-1); setStep(s => Math.max(s - 1, 0)); };

  // Full validation safety-net before the final submit.
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.firstName.trim()) errs.firstName = 'Required';
    if (!formData.lastName.trim()) errs.lastName = 'Required';
    if (!formData.phone.trim()) errs.phone = 'Required';
    if (!formData.email.trim()) errs.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email';
    if (!formData.startDate) errs.startDate = 'Required';
    if (!formData.endDate) errs.endDate = 'Required';
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) errs.endDate = 'Must be after start';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) { setSubmitError('Some required details are missing. Please step back and complete them.'); return; }
    setIsSubmitting(true);
    setSubmitError('');

    // 1. Generate reCAPTCHA token
    let recaptchaToken = '';
    try {
      if ((window as any).grecaptcha) {
        recaptchaToken = await (window as any).grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit_booking' });
      }
    } catch (err) {
      console.warn('reCAPTCHA generation failed:', err);
    }

    // 2. Map frontend fields to backend API format
    const bookingPayload = {
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      vehicle_code: vehicle.id,
      pickup_date: formData.startDate,
      return_date: formData.endDate,
      pickup_time: formData.pickupTime,
      return_time: formData.returnTime,
      delivery_type: formData.deliveryOption,
      delivery_address: formData.deliveryOption !== 'pickup' ? formData.deliveryAddress.trim() : undefined,
      special_requests: formData.notes.trim() || undefined,
      unlimited_miles: formData.unlimitedMiles || undefined,
      unlimited_tolls: formData.unlimitedTolls || undefined,
      rate_preference: selectedRate,
      source: 'website',
    };

    try {
      // Try the backend API first
      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-recaptcha-token': recaptchaToken,
        },
        body: JSON.stringify(bookingPayload),
      });

      if (response.ok) {
        const result = await response.json();
        setRefCode(result.booking_code);
        setIsSuccess(true);
      } else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 409) {
          setSubmitError('Those dates are no longer available for this vehicle. Please choose different dates.');
        } else if (response.status === 404) {
          setSubmitError(`This vehicle isn't available for online booking right now. Please call us at ${brand.phone}.`);
        } else {
          throw new Error(errData.error || 'Booking submission failed');
        }
      }
    } catch (err) {
      console.error('[Booking Submit Error]', err);
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setSubmitError('Unable to reach our server. Please check your internet connection and try again.');
      } else {
        setSubmitError(`Something went wrong submitting your request. Please try again or call us at ${brand.phone}.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if rental is weekly (miles included, hide add-on)
  const rentalDays = calcRentalDays(formData.startDate, formData.endDate);
  const isWeeklyRental = rentalDays >= 7;
  const milesIncludedInWeekly = isWeeklyRental && (vehicle.weeklyUnlimitedMileage !== false);

  // Price estimate using accurate weekly block math
  const priceEstimate = (() => {
    if (!formData.startDate || !formData.endDate || rentalDays <= 0) return null;
    const deliveryFee = DELIVERY_FEES[formData.deliveryOption];
    const mileageFee = milesIncludedInWeekly ? 0 : (formData.unlimitedMiles ? 100 : 0);
    const tollFee = formData.unlimitedTolls ? 20 : 0;
    const bd = calcPriceBreakdown({
      dailyRate: vehicle.dailyRate,
      discountPct: vehicle.weeklyDiscountPercent ?? 15,
      unlimitedMileageEnabled: vehicle.weeklyUnlimitedMileage !== false,
      startDate: formData.startDate,
      endDate: formData.endDate,
      deliveryFee,
      mileageFee,
      tollFee,
    });
    if (!bd) return null;
    return { days: bd.rentalDays, subtotal: bd.subtotal, deliveryFee, mileageFee, tollFee, tax: bd.tax, total: bd.total, rateType: bd.rateType, savingsVsDaily: bd.savingsVsDaily };
  })();

  const formatTime = (t: string) => {
    const hr = parseInt(t.split(':')[0]);
    const m = t.split(':')[1];
    return `${hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  const deliveryLabel = (opt: DeliveryOption) =>
    opt === 'pickup' ? `Pickup · ${brand.location.city}`
      : opt === 'psl_delivery' ? `Delivery · ${brand.location.city} area`
        : 'Delivery · Surrounding areas';

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
    color: 'var(--text-primary)',
  };

  const inputClass = (field: string) =>
    `w-full px-4 min-h-[52px] flex items-center rounded-xl border text-[15px] focus:outline-none transition-all placeholder:opacity-55 appearance-none ${
      errors[field] ? 'border-red-500/60 focus:border-red-400' : ''
    }`;

  const inputBorder = (field: string): React.CSSProperties => ({
    borderColor: errors[field] ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
  });

  const isDark = theme === 'dark';

  // Card surface. Dark mode keeps the original subtle look; light mode gets a
  // stronger frosted-glass panel (near-opaque white) so navy text stays readable.
  const glassCard: React.CSSProperties = isDark
    ? { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)', backdropFilter: 'blur(12px)' }
    : {
        background: 'linear-gradient(155deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))',
        borderColor: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(26px) saturate(165%)',
        WebkitBackdropFilter: 'blur(26px) saturate(165%)',
        boxShadow: '0 28px 70px -28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.95)',
      };

  // Inner panels. Dark mode keeps the original tokens; light mode gets a
  // stronger navy-tinted surface with a clearer border for contrast.
  const subPanel: React.CSSProperties = isDark
    ? { backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }
    : { backgroundColor: 'rgba(0,0,0,0.05)', borderColor: 'rgba(0,0,0,0.12)' };

  // Monthly path - bypass booking flow entirely, show call/text card
  if (selectedRate === 'monthly') {
    return (
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="p-6 space-y-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--accent-color)' }}>
            Monthly Rental
          </p>
          {vehicle.monthlyDisplayPrice ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light">${vehicle.monthlyDisplayPrice.toLocaleString()}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>/ mo</span>
            </div>
          ) : (
            <span className="text-2xl font-light">Custom pricing</span>
          )}
          <p className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}><Infinity size={12} className="shrink-0" /> Unlimited mileage included</p>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Monthly rentals are arranged directly with us. Reach out and we'll tailor a rate to your stay length, mileage, and pickup details.
          </p>

          <a
            href={`tel:${brand.phone.replace(/[^\d+]/g, '')}`}
            className="group w-full py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Call Us <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
          </a>
          <a
            href={`sms:${brand.phone.replace(/[^\d+]/g, '')}`}
            className="w-full py-3.5 rounded-full font-medium border transition-all duration-300 active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-primary)' }}
          >
            Text Us
          </a>

          <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Available 7 days a week · {brand.phone}
          </p>
        </div>
      </div>
    );
  }

  // ── Cool confirmation UI ────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-3xl border p-8 text-center space-y-6 overflow-hidden"
        style={glassCard}
      >
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent-color), transparent 70%)', opacity: isDark ? 0.3 : 0.45 }}
        />
        <div className="relative">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', boxShadow: '0 8px 30px color-mix(in srgb, var(--accent-color) 45%, transparent)' }}
          >
            <CheckCircle2 size={32} />
          </motion.div>
          <h3 className="text-2xl font-medium mt-6">Request Received</h3>
          <p className="leading-relaxed max-w-sm mx-auto mt-2" style={{ color: 'var(--text-secondary)' }}>
            Your booking reference is <strong className="font-mono tracking-wider">{refCode}</strong>. You'll need this to complete your booking. We'll review your request and get back to you shortly.
          </p>
          <div
            className="rounded-xl border p-4 space-y-2 text-sm mt-6 text-left"
            style={subPanel}
          >
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-tertiary)' }}>Reference</span>
              <span className="font-mono font-bold tracking-wider">{refCode}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-tertiary)' }}>Vehicle</span>
              <span className="font-medium">{getVehicleDisplayName(vehicle)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-tertiary)' }}>Dates</span>
              <span className="font-medium">{prettyDate(formData.startDate)} – {prettyDate(formData.endDate)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-tertiary)' }}>Status</span>
              <span
                className="px-3 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold"
                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
              >
                Under Review
              </span>
            </div>
          </div>
          <p className="text-xs mt-6" style={{ color: 'var(--text-tertiary)' }}>
            You'll receive a call or text within a few hours during business hours.
          </p>
          <a
            href={`/booking-status?code=${refCode}`}
            className="inline-block text-sm underline transition-opacity hover:opacity-70 mt-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            Check booking status anytime →
          </a>
        </div>
      </motion.div>
    );
  }

  // ── Step transition variants ────────────────────────────────────────────────
  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 36 : -36, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -36 : 36, opacity: 0 }),
  };

  const fieldLabel = 'text-[10px] uppercase tracking-widest mb-1 block ml-1';

  // ── Step bodies ─────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // STEP 0 — DATES
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>When do you need it?</h3>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Tap your start date, then your end date.</p>
            </div>

            <RangeCalendar startDate={formData.startDate} endDate={formData.endDate} onSelect={handleDayClick} />

            {formData.startDate && (
              <div
                className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-sm py-2.5 px-3 rounded-xl border"
                style={subPanel}
              >
                <CalendarIcon size={14} style={{ color: 'var(--accent-color)' }} />
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{prettyDate(formData.startDate)}</span>
                <ArrowRight size={13} style={{ color: 'var(--text-tertiary)' }} />
                <span className="font-medium" style={{ color: formData.endDate ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                  {formData.endDate ? prettyDate(formData.endDate) : 'End date'}
                </span>
                {formData.endDate && rentalDays > 0 && (
                  <span style={{ color: 'var(--text-tertiary)' }}>· {rentalDays} day{rentalDays !== 1 ? 's' : ''}</span>
                )}
              </div>
            )}

            {(errors.startDate || errors.endDate) && (
              <p className="text-red-400 text-xs text-center">{errors.startDate || errors.endDate}</p>
            )}

            <AnimatePresence>
              {formData.startDate && formData.endDate && (
                <WeeklyUpsell
                  startDate={formData.startDate}
                  endDate={formData.endDate}
                  dailyRate={vehicle.dailyRate}
                  weeklyDiscountPercent={vehicle.weeklyDiscountPercent ?? 15}
                  unlimitedMileageEnabled={vehicle.weeklyUnlimitedMileage !== false}
                />
              )}
            </AnimatePresence>
          </div>
        );

      // STEP 1 — TIMES + PICKUP / DELIVERY
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Pickup & delivery</h3>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Choose your times and how you'd like to get the car.</p>
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Check-In Time</label>
                <select name="pickupTime" value={formData.pickupTime} onChange={handleChange} className={inputClass('pickupTime')} style={{ ...inputStyle, ...inputBorder('pickupTime') }}>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                </select>
              </div>
              <div>
                <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Check-Out Time</label>
                <select name="returnTime" value={formData.returnTime} onChange={handleChange} className={inputClass('returnTime')} style={{ ...inputStyle, ...inputBorder('returnTime') }}>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                </select>
              </div>
            </div>

            {/* Pickup or Delivery */}
            <div>
              <label className="text-[10px] uppercase tracking-widest mb-2 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Pickup or Delivery?</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: 'pickup',               label: "I'll Pick It Up", sub: brand.location.city,         price: null },
                  { val: 'psl_delivery',         label: 'Deliver to Me',   sub: `${brand.location.city} area`, price: '$39' },
                  { val: 'surrounding_delivery', label: 'Deliver to Me',   sub: 'Surrounding areas',          price: '$49' },
                ] as const).map(({ val, label, sub, price }) => {
                  const active = formData.deliveryOption === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, deliveryOption: val, deliveryAddress: '' }))}
                      className="py-3 px-2 rounded-xl text-sm border transition-all duration-300 cursor-pointer flex flex-col items-center gap-0.5"
                      style={{
                        backgroundColor: active ? 'var(--accent)' : 'var(--bg-card-hover)',
                        color: active ? 'var(--accent-fg)' : 'var(--text-secondary)',
                        borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                      }}
                    >
                      <span className="font-medium text-[13px] leading-tight text-center">{label}</span>
                      <span className="text-[11px] opacity-75 text-center">{sub}</span>
                      {price ? (
                        <span className={`text-[11px] font-semibold mt-0.5 ${active ? 'opacity-90' : ''}`}>{price}</span>
                      ) : (
                        <span className={`text-[11px] font-semibold mt-0.5 ${active ? 'opacity-90' : 'text-green-600'}`}>Free</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {formData.deliveryOption === 'surrounding_delivery' && (
                <p className="text-[11px] mt-2 ml-1" style={{ color: 'var(--text-tertiary)' }}>
                  Includes Stuart, Jensen Beach, Fort Pierce, Palm City, and nearby areas.
                </p>
              )}

              {formData.deliveryOption !== 'pickup' && (
                <div className="mt-3">
                  <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Delivery Address</label>
                  <input
                    type="text"
                    value={formData.deliveryAddress}
                    onChange={e => { setFormData(prev => ({ ...prev, deliveryAddress: e.target.value })); if (errors.deliveryAddress) setErrors(prev => { const n = { ...prev }; delete n.deliveryAddress; return n; }); }}
                    placeholder="Street address, city, ZIP"
                    className={inputClass('deliveryAddress')}
                    style={{ ...inputStyle, ...inputBorder('deliveryAddress') }}
                  />
                  {errors.deliveryAddress && <p className="text-red-400 text-xs mt-1 ml-1">{errors.deliveryAddress}</p>}
                </div>
              )}
            </div>
          </div>
        );

      // STEP 2 — ADD-ONS
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Optional add-ons</h3>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Make your trip easier. Skip any you don't need.</p>
            </div>

            <div className="space-y-2">
              {!milesIncludedInWeekly && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, unlimitedMiles: !prev.unlimitedMiles }))}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 cursor-pointer text-left"
                  style={{
                    backgroundColor: formData.unlimitedMiles ? 'color-mix(in srgb, var(--accent-color) 8%, transparent)' : (theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                    borderColor: formData.unlimitedMiles ? 'var(--accent)' : 'var(--border-subtle)',
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Unlimited Miles</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>No mileage cap for your entire rental</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold" style={{ color: 'var(--accent-color)' }}>$100</span>
                    <div
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: formData.unlimitedMiles ? 'var(--accent)' : 'transparent',
                        borderColor: formData.unlimitedMiles ? 'var(--accent)' : 'var(--border-subtle)',
                        color: formData.unlimitedMiles ? 'var(--accent-fg)' : 'transparent',
                      }}
                    >
                      {formData.unlimitedMiles && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                </button>
              )}
              {milesIncludedInWeekly && (
                <div
                  className="flex items-center gap-2 p-3.5 rounded-xl border text-sm"
                  style={{ ...subPanel, color: 'var(--text-secondary)' }}
                >
                  <Infinity size={15} style={{ color: 'var(--accent-color)' }} />
                  Unlimited miles are included free with your weekly rate.
                </div>
              )}

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, unlimitedTolls: !prev.unlimitedTolls }))}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 cursor-pointer text-left"
                style={{
                  backgroundColor: formData.unlimitedTolls ? 'color-mix(in srgb, var(--accent-color) 8%, transparent)' : (theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                  borderColor: formData.unlimitedTolls ? 'var(--accent)' : 'var(--border-subtle)',
                }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Unlimited Tolls</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>All toll charges covered for your trip</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold" style={{ color: 'var(--accent-color)' }}>$20</span>
                  <div
                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: formData.unlimitedTolls ? 'var(--accent)' : 'transparent',
                      borderColor: formData.unlimitedTolls ? 'var(--accent)' : 'var(--border-subtle)',
                      color: formData.unlimitedTolls ? 'var(--accent-fg)' : 'transparent',
                    }}
                  >
                    {formData.unlimitedTolls && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>
              </button>
            </div>
          </div>
        );

      // STEP 3 — YOUR DETAILS + ID
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Your details</h3>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>So we can confirm your booking and send your quote.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>First Name</label>
                <input id="firstName" type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" className={inputClass('firstName')} style={{ ...inputStyle, ...inputBorder('firstName') }} />
                {errors.firstName && <p className="text-red-400 text-xs mt-1 ml-1">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Last Name</label>
                <input id="lastName" type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Smith" className={inputClass('lastName')} style={{ ...inputStyle, ...inputBorder('lastName') }} />
                {errors.lastName && <p className="text-red-400 text-xs mt-1 ml-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="phone" className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Mobile Phone</label>
              <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="(772) 555-0100" className={inputClass('phone')} style={{ ...inputStyle, ...inputBorder('phone') }} />
              {errors.phone && <p className="text-red-400 text-xs mt-1 ml-1">{errors.phone}</p>}
            </div>

            <div>
              <label htmlFor="email" className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Email Address</label>
              <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" className={inputClass('email')} style={{ ...inputStyle, ...inputBorder('email') }} />
              {errors.email && <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>}
            </div>
          </div>
        );

      // STEP 4 — REVIEW + CONSENT + SUBMIT
      case 4:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Review your request</h3>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Everything look right? Submit to request availability.</p>
            </div>

            {/* Summary */}
            <div className="rounded-xl border overflow-hidden" style={subPanel}>
              {[
                { k: 'Dates', v: `${prettyDate(formData.startDate)} – ${prettyDate(formData.endDate)} · ${rentalDays} day${rentalDays !== 1 ? 's' : ''}` },
                { k: 'Times', v: `${formatTime(formData.pickupTime)} → ${formatTime(formData.returnTime)}` },
                { k: 'Method', v: deliveryLabel(formData.deliveryOption) },
                ...(formData.deliveryOption !== 'pickup' && formData.deliveryAddress ? [{ k: 'Address', v: formData.deliveryAddress }] : []),
                { k: 'Driver', v: `${formData.firstName} ${formData.lastName}` },
                { k: 'Contact', v: formData.phone },
                ...((formData.unlimitedMiles && !milesIncludedInWeekly) || formData.unlimitedTolls
                  ? [{ k: 'Add-ons', v: [formData.unlimitedMiles && !milesIncludedInWeekly ? 'Unlimited Miles' : null, formData.unlimitedTolls ? 'Unlimited Tolls' : null].filter(Boolean).join(', ') }]
                  : []),
              ].map((row, i) => (
                <div
                  key={row.k}
                  className="flex justify-between gap-4 px-4 py-2.5 text-sm"
                  style={i > 0 ? { borderTop: '1px solid var(--border-subtle)' } : undefined}
                >
                  <span className="shrink-0" style={{ color: 'var(--text-tertiary)' }}>{row.k}</span>
                  <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>{row.v}</span>
                </div>
              ))}
            </div>

            {/* Price estimate */}
            {priceEstimate && (
              <div
                className="rounded-xl border p-4 space-y-2 text-sm"
                style={subPanel}
              >
                <p className="text-[10px] uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Estimated Total: {priceEstimate.days} day{priceEstimate.days !== 1 ? 's' : ''}
                </p>
                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                  <span>Rental ({priceEstimate.days} day{priceEstimate.days !== 1 ? 's' : ''})</span>
                  <span>${displayPrice(priceEstimate.subtotal).toLocaleString()}</span>
                </div>
                {priceEstimate.deliveryFee > 0 && (
                  <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                    <span>Delivery fee</span>
                    <span>${displayPrice(priceEstimate.deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                  <span>FL Sales Tax (7%)</span>
                  <span>${displayPrice(priceEstimate.tax)}</span>
                </div>
                {priceEstimate.mileageFee > 0 && (
                  <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                    <span>Unlimited Miles</span>
                    <span>${displayPrice(priceEstimate.mileageFee)}</span>
                  </div>
                )}
                {priceEstimate.tollFee > 0 && (
                  <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                    <span>Unlimited Tolls</span>
                    <span>${displayPrice(priceEstimate.tollFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-2" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}>
                  <span>Estimated Total</span>
                  <span>${displayPrice(priceEstimate.total).toLocaleString()}</span>
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  Final price confirmed at approval. No charge until approved.
                </p>
              </div>
            )}

            {/* SMS consent disclosure - required for Twilio A2P 10DLC campaign approval.
                Twilio reviewers verify this disclosure exists directly above the submit
                button. Do not remove or hide without updating the A2P consent text. */}
            <div
              className="rounded-xl border p-3.5 text-[12px] leading-relaxed"
              style={{ ...subPanel, color: 'var(--text-secondary)' }}
            >
              By submitting this booking, you consent to receive SMS messages from
              {' '}{brand.name} about your rental, including confirmations, reminders,
              and updates. Message and data rates may apply. Message frequency varies.
              Reply STOP to opt out or HELP for help. See our{' '}
              <a href="/privacy" className="underline" style={{ color: 'var(--text-primary)' }}>Privacy Policy</a>
              {' '}and{' '}
              <a href="/terms" className="underline" style={{ color: 'var(--text-primary)' }}>Terms of Service</a>
              {' '}for details.
            </div>

            {submitError && (
              <div
                className="flex items-start gap-3 p-4 rounded-xl border text-sm"
                style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ── Wizard shell ────────────────────────────────────────────────────────────
  return (
    <div
      className="relative rounded-3xl border overflow-hidden"
      style={glassCard}
    >
      {/* Soft accent light effect */}
      <div
        className="pointer-events-none absolute -top-20 -right-12 h-44 w-44 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--accent-color), transparent 70%)', opacity: isDark ? 0.25 : 0.45 }}
      />
      {/* Secondary cool light — adds glass depth in light mode only */}
      {!isDark && (
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent-color), transparent 70%)', opacity: 0.2 }}
        />
      )}

      <div className="relative">
        {/* Header: rate + progress */}
        <div className="p-5 sm:p-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-semibold block mb-1" style={{ color: 'var(--accent-color)' }}>
                {selectedRate === 'weekly' ? 'Weekly rate' : 'From'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-light" style={{ color: 'var(--text-primary)' }}>
                  ${selectedRate === 'weekly' ? displayPrice(vehicle.weeklyRate) : displayPrice(vehicle.dailyRate)}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>/ {selectedRate === 'weekly' ? 'week' : 'day'}</span>
              </div>
            </div>
            {selectedRate === 'weekly' && (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>${displayPrice(vehicle.dailyRate)} / day</span>
            )}
          </div>

          <div className="flex gap-1.5 mb-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-500"
                style={{ backgroundColor: i <= step ? 'var(--accent)' : 'var(--border-subtle)' }}
              />
            ))}
          </div>
          <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
            Step {step + 1} of {STEPS.length} · {STEPS[step].label}
          </p>
        </div>

        {/* Step body */}
        <div className="p-5 sm:p-6">
          <div className="min-h-[330px]">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer nav */}
          <div className="flex items-center gap-3 pt-5">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                disabled={isSubmitting}
                className="py-3.5 px-5 rounded-full font-medium border transition-all duration-300 active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="group flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Continue <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
                className={`group flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" size={18} /> Submitting...</>
                ) : (
                  <>Request Availability <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" /></>
                )}
              </button>
            )}
          </div>

          {step === STEPS.length - 1 && (
            <p className="text-center text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
              No charge until your request is approved
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
