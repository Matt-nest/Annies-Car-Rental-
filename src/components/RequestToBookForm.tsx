import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Vehicle, BookingRequest } from '../types';
import { getVehicleDisplayName } from '../data/vehicles';
import { useTheme } from '../App';

const WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/kP7owzBOHxXk0Ch6wiZT/webhook-trigger/ivjo1qPItO8lTrMJ5icB';

function generateRefCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function calculateRentalTotal(startDate: string, endDate: string, dailyRate: number, weeklyRate?: number): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (days <= 0) return dailyRate;
  if (days >= 7 && weeklyRate) {
    const fullWeeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    return (fullWeeks * weeklyRate) + (remainingDays * dailyRate);
  }
  return days * dailyRate;
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

    const code = generateRefCode();
    const rentalTotal = calculateRentalTotal(
      formData.startDate,
      formData.endDate,
      vehicle.dailyRate,
      vehicle.weeklyRate,
    );

    try {
      const params = new URLSearchParams({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          email: formData.email,
          vehicle_requested: formData.vehicleName,
          pickup_date: formData.startDate,
          return_date: formData.endDate,
          rental_total: rentalTotal.toString(),
          booking_reference_code: code,
        });
      const response = await fetch(WEBHOOK_URL + '?' + params.toString());
      if (!response.ok) throw new Error('Request failed');
      setRefCode(code);
      setIsSuccess(true);
    } catch {
      setSubmitError('Something went wrong submitting your request. Please try again or call us at (772) 985-6667.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First Name" className={inputClass('firstName')} style={{ ...inputStyle, ...inputBorder('firstName') }} />
            {errors.firstName && <p className="text-red-400 text-xs mt-1 ml-1">{errors.firstName}</p>}
          </div>
          <div>
            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last Name" className={inputClass('lastName')} style={{ ...inputStyle, ...inputBorder('lastName') }} />
            {errors.lastName && <p className="text-red-400 text-xs mt-1 ml-1">{errors.lastName}</p>}
          </div>
        </div>

        <div>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Mobile Phone" className={inputClass('phone')} style={{ ...inputStyle, ...inputBorder('phone') }} />
          {errors.phone && <p className="text-red-400 text-xs mt-1 ml-1">{errors.phone}</p>}
        </div>
        <div>
          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email Address" className={inputClass('email')} style={{ ...inputStyle, ...inputBorder('email') }} />
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
          <input type="text" name="pickupLocation" value={formData.pickupLocation} onChange={handleChange} placeholder="Preferred Pickup Location" className={inputClass('pickupLocation')} style={{ ...inputStyle, ...inputBorder('pickupLocation') }} />
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
                className="py-2.5 rounded-xl text-sm font-medium border transition-all duration-300"
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

        <textarea
          name="notes" value={formData.notes} onChange={handleChange}
          placeholder="Notes or special requests (optional)" rows={3}
          className={`${inputClass('notes')} resize-none`}
          style={{ ...inputStyle, ...inputBorder('notes') }}
        />

        <input type="hidden" name="vehicle_id" value={vehicle.id} />
        <input type="hidden" name="vehicle_name" value={getVehicleDisplayName(vehicle)} />
        <input type="hidden" name="vehicle_daily_rate" value={vehicle.dailyRate} />

        <button
          type="submit"
          disabled={isSubmitting}
          className={`group w-full py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 ${
            isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
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
