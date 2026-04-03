import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Vehicle, BookingRequest } from '../types';
import { getVehicleDisplayName } from '../data/vehicles';
import { useTheme } from '../App';

// Backend API for booking submissions
const API_URL = import.meta.env.VITE_API_URL || 'https://annies-car-rental-backend.onrender.com/api/v1';
const API_KEY = import.meta.env.VITE_API_KEY || 'annies-rental-api-key-2026';

// GHL webhook as fallback if backend is unreachable
const GHL_FALLBACK_URL = 'https://services.leadconnectorhq.com/hooks/kP7owzBOHxXk0Ch6wiZT/webhook-trigger/ivjo1qPItO8lTrMJ5icB';

function generateFallbackRefCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

interface RequestToBookFormProps {
  vehicle: Vehicle;
}

export default function RequestToBookForm({ vehicle }: RequestToBookFormProps) {
  const { theme } = useTheme();

  const [formData, setFormData] = useState<BookingRequest>({
    firstName: '', lastName: '', phone: '', email: '',
    startDate: '', endDate: '', pickupTime: '10:00', returnTime: '10:00',
    pickupLocation: '', insuranceNeeded: 'not-sure', notes: '',
    vehicleId: vehicle.id, vehicleName: getVehicleDisplayName(vehicle), vehicleDailyRate: vehicle.dailyRate,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [refCode, setRefCode] = useState('');
  const [submitError, setSubmitError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError('');

    // Map frontend fields to backend API format
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
      pickup_location: formData.pickupLocation.trim() || 'Port St. Lucie',
      insurance_provider: formData.insuranceNeeded === 'yes' ? 'bonzah' : formData.insuranceNeeded === 'no' ? 'none' : undefined,
      special_requests: formData.notes.trim() || undefined,
      source: 'website',
    };

    try {
      // Try the backend API first
      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify(bookingPayload),
      });

      if (response.ok) {
        const result = await response.json();
        setRefCode(result.booking_code);
        setIsSuccess(true);
      } else {
        const errData = await response.json().catch(() => ({}));
        // If it's a vehicle-not-found error, fall back to GHL
        if (response.status === 404 || response.status === 409) {
          await submitToGHLFallback();
        } else {
          throw new Error(errData.error || 'Booking submission failed');
        }
      }
    } catch {
      // Backend unreachable — fall back to GHL direct
      try {
        await submitToGHLFallback();
      } catch {
        setSubmitError('Something went wrong submitting your request. Please try again or call us at (772) 985-6667.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fallback: submit directly to GHL if backend is down or vehicle not in DB yet
  async function submitToGHLFallback() {
    const params = new URLSearchParams({
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      vehicle_requested: formData.vehicleName,
      pickup_date: formData.startDate,
      return_date: formData.endDate,
      booking_reference_code: generateFallbackRefCode(),
    });
    const response = await fetch(GHL_FALLBACK_URL + '?' + params.toString());
    if (!response.ok) throw new Error('GHL fallback failed');
    const code = params.get('booking_reference_code') || generateFallbackRefCode();
    setRefCode(code);
    setIsSuccess(true);
  }

  const formatTime = (t: string) => {
    const hr = parseInt(t.split(':')[0]);
    const m = t.split(':')[1];
    return `${hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

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

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border p-8 text-center space-y-6"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          <CheckCircle2 size={32} />
        </div>
        <h3 className="text-2xl font-medium">Request Received</h3>
        <p className="leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Your booking reference is <strong className="font-mono tracking-wider">{refCode}</strong>. You'll need this to complete your booking. We'll review your request and get back to you shortly.
        </p>
        <div
          className="rounded-xl border p-4 space-y-2 text-sm"
          style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }}
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
            <span className="font-medium">{formData.startDate} — {formData.endDate}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-tertiary)' }}>Status</span>
            <span
              className="px-3 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
            >
              Under Review
            </span>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          You'll receive a call or text within a few hours during business hours.
        </p>
      </motion.div>
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Price header */}
      <div className="p-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-light">${vehicle.dailyRate}</span>
            <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>/ day</span>
          </div>
          {vehicle.weeklyRate && (
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>${vehicle.weeklyRate} / week</span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 sm:space-y-5">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>First Name</label>
            <input id="firstName" type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" className={inputClass('firstName')} style={{ ...inputStyle, ...inputBorder('firstName') }} />
            {errors.firstName && <p className="text-red-400 text-xs mt-1 ml-1">{errors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="lastName" className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Last Name</label>
            <input id="lastName" type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Smith" className={inputClass('lastName')} style={{ ...inputStyle, ...inputBorder('lastName') }} />
            {errors.lastName && <p className="text-red-400 text-xs mt-1 ml-1">{errors.lastName}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Mobile Phone</label>
          <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="(772) 555-0100" className={inputClass('phone')} style={{ ...inputStyle, ...inputBorder('phone') }} />
          {errors.phone && <p className="text-red-400 text-xs mt-1 ml-1">{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="email" className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Email Address</label>
          <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" className={inputClass('email')} style={{ ...inputStyle, ...inputBorder('email') }} />
          {errors.email && <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Start Date</label>
            <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className={inputClass('startDate')} style={{ ...inputStyle, ...inputBorder('startDate') }} />
            {errors.startDate && <p className="text-red-400 text-xs mt-1 ml-1">{errors.startDate}</p>}
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>End Date</label>
            <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} className={inputClass('endDate')} style={{ ...inputStyle, ...inputBorder('endDate') }} />
            {errors.endDate && <p className="text-red-400 text-xs mt-1 ml-1">{errors.endDate}</p>}
          </div>
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Pickup Time</label>
            <select name="pickupTime" value={formData.pickupTime} onChange={handleChange} className={inputClass('pickupTime')} style={{ ...inputStyle, ...inputBorder('pickupTime') }}>
              {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Return Time</label>
            <select name="returnTime" value={formData.returnTime} onChange={handleChange} className={inputClass('returnTime')} style={{ ...inputStyle, ...inputBorder('returnTime') }}>
              {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="pickupLocation" className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Preferred Pickup Location</label>
          <input id="pickupLocation" type="text" name="pickupLocation" value={formData.pickupLocation} onChange={handleChange} placeholder="Address or area" className={inputClass('pickupLocation')} style={{ ...inputStyle, ...inputBorder('pickupLocation') }} />
        </div>

        {/* Insurance */}
        <div>
          <label className="text-[10px] uppercase tracking-widest mb-2 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Insurance Needed?</label>
          <div className="grid grid-cols-3 gap-2">
            {([['yes', 'Yes'], ['no', 'No'], ['not-sure', 'Not Sure']] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, insuranceNeeded: val }))}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all duration-300 cursor-pointer"
                style={{
                  backgroundColor: formData.insuranceNeeded === val ? 'var(--accent)' : 'var(--bg-card-hover)',
                  color: formData.insuranceNeeded === val ? 'var(--accent-fg)' : 'var(--text-secondary)',
                  borderColor: formData.insuranceNeeded === val ? 'var(--accent)' : 'var(--border-subtle)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Notes (optional)</label>
          <textarea
            id="notes"
            name="notes" value={formData.notes} onChange={handleChange}
            placeholder="Special requests, questions, etc." rows={3}
            className={`${inputClass('notes')} resize-none`}
            style={{ ...inputStyle, ...inputBorder('notes') }}
          />
        </div>

        <input type="hidden" name="vehicle_id" value={vehicle.id} />
        <input type="hidden" name="vehicle_name" value={getVehicleDisplayName(vehicle)} />
        <input type="hidden" name="vehicle_daily_rate" value={vehicle.dailyRate} />

        <button
          type="submit"
          disabled={isSubmitting}
          className={`group w-full py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 ${
            isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
          }`}
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {isSubmitting ? (
            <><Loader2 className="animate-spin" size={18} /> Submitting...</>
          ) : (
            <>Request Availability <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" /></>
          )}
        </button>

        {submitError && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl border text-sm"
            style={{
              backgroundColor: 'rgba(239,68,68,0.08)',
              borderColor: 'rgba(239,68,68,0.25)',
              color: '#ef4444',
            }}
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
          No charge until your request is approved
        </p>
      </form>
    </div>
  );
}
