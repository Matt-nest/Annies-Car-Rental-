import React, { useState, useRef } from 'react';
import { ArrowRight, CheckCircle2, Loader2, AlertCircle, Camera, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Vehicle, BookingRequest, DeliveryOption } from '../../types';
import { getVehicleDisplayName } from '../../data/vehicles';
import { useTheme } from '../../context/ThemeContext';
import { API_URL, API_KEY } from '../../config';


interface RequestToBookFormProps {
  vehicle: Vehicle;
}

export default function RequestToBookForm({ vehicle }: RequestToBookFormProps) {
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
    insuranceNeeded: 'not-sure', notes: '',
    unlimitedMiles: false, unlimitedTolls: false,
    vehicleId: vehicle.id, vehicleName: getVehicleDisplayName(vehicle), vehicleDailyRate: vehicle.dailyRate,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [refCode, setRefCode] = useState('');
  const [submitError, setSubmitError] = useState('');

  // ID Photo upload state
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState('');
  const idPhotoRef = useRef<HTMLInputElement>(null);

  // Compress image before upload (keeps under Vercel's 4.5MB limit)
  const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      // If already small enough, skip compression
      if (file.size < 1 * 1024 * 1024) return resolve(file);
      
      const img = new Image();
      const canvas = document.createElement('canvas');
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleIdPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, idPhoto: 'File too large. Max 10MB.' }));
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) {
      setErrors(prev => ({ ...prev, idPhoto: 'Only JPEG, PNG, WebP, or HEIC images accepted.' }));
      return;
    }
    // Compress before setting state
    const compressed = await compressImage(file);
    setIdPhoto(compressed);
    setIdPhotoPreview(URL.createObjectURL(compressed));
    setErrors(prev => { const n = { ...prev }; delete n.idPhoto; return n; });
  };

  // Programmatic click on file input (most reliable cross-browser/mobile method)
  const triggerFileInput = () => {
    idPhotoRef.current?.click();
  };

  // Drag-and-drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleIdPhotoChange({ target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeIdPhoto = () => {
    setIdPhoto(null);
    setIdPhotoPreview('');
    if (idPhotoRef.current) idPhotoRef.current.value = '';
  };

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
    if (!idPhoto) errs.idPhoto = 'Photo ID is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError('');

    // 1. Upload ID photo first
    let id_photo_url = '';
    if (idPhoto) {
      try {
        const photoForm = new FormData();
        photoForm.append('file', idPhoto);
        const uploadRes = await fetch(`${API_URL}/uploads/id-photo`, {
          method: 'POST',
          body: photoForm,
        });
        if (!uploadRes.ok) {
          const errData = await uploadRes.text();
          console.error('Upload failed:', uploadRes.status, errData);
          throw new Error(`Photo upload failed: ${uploadRes.status}`);
        }
        const uploadData = await uploadRes.json();
        id_photo_url = uploadData.url;
      } catch {
        setSubmitError('Failed to upload your photo ID. Please try again.');
        setIsSubmitting(false);
        return;
      }
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
      insurance_provider: formData.insuranceNeeded === 'yes' ? 'bonzah' : formData.insuranceNeeded === 'no' ? 'none' : undefined,
      special_requests: formData.notes.trim() || undefined,
      id_photo_url: id_photo_url || undefined,
      unlimited_miles: formData.unlimitedMiles || undefined,
      unlimited_tolls: formData.unlimitedTolls || undefined,
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
        if (response.status === 409) {
          setSubmitError('Those dates are no longer available for this vehicle. Please choose different dates.');
        } else if (response.status === 404) {
          setSubmitError('This vehicle isn\'t available for online booking right now. Please call us at (772) 985-6667.');
        } else {
          throw new Error(errData.error || 'Booking submission failed');
        }
      }
    } catch {
      setSubmitError('Something went wrong submitting your request. Please try again or call us at (772) 985-6667.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Price estimate computed from selected dates + delivery option
  const priceEstimate = (() => {
    if (!formData.startDate || !formData.endDate) return null;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return null;
    let subtotal: number;
    if (days >= 7 && vehicle.weeklyRate) {
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      subtotal = weeks * vehicle.weeklyRate + remainingDays * vehicle.dailyRate;
    } else {
      subtotal = days * vehicle.dailyRate;
    }
    const deliveryFee = DELIVERY_FEES[formData.deliveryOption];
    const mileageFee = formData.unlimitedMiles ? 100 : 0;
    const tollFee = formData.unlimitedTolls ? 20 : 0;
    const taxable = subtotal + deliveryFee;
    const tax = taxable * 0.07;
    return { days, subtotal, deliveryFee, mileageFee, tollFee, tax, total: taxable + tax + mileageFee + tollFee };
  })();

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
        <a
          href={`/booking-status?code=${refCode}`}
          className="inline-block text-sm underline transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          Check booking status anytime →
        </a>
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
            <label className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Check-In Time</label>
            <select name="pickupTime" value={formData.pickupTime} onChange={handleChange} className={inputClass('pickupTime')} style={{ ...inputStyle, ...inputBorder('pickupTime') }}>
              {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Check-Out Time</label>
            <select name="returnTime" value={formData.returnTime} onChange={handleChange} className={inputClass('returnTime')} style={{ ...inputStyle, ...inputBorder('returnTime') }}>
              {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Price estimate */}
        {priceEstimate && (
          <div
            className="rounded-xl border p-4 space-y-2 text-sm"
            style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-[10px] uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Estimated Total — {priceEstimate.days} day{priceEstimate.days !== 1 ? 's' : ''}
            </p>
            <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
              <span>Rental ({priceEstimate.days} day{priceEstimate.days !== 1 ? 's' : ''})</span>
              <span>${priceEstimate.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {priceEstimate.deliveryFee > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                <span>Delivery fee</span>
                <span>${priceEstimate.deliveryFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
              <span>FL Sales Tax (7%)</span>
              <span>${priceEstimate.tax.toFixed(2)}</span>
            </div>
            {priceEstimate.mileageFee > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                <span>Unlimited Miles</span>
                <span>${priceEstimate.mileageFee.toFixed(2)}</span>
              </div>
            )}
            {priceEstimate.tollFee > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                <span>Unlimited Tolls</span>
                <span>${priceEstimate.tollFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}>
              <span>Estimated Total</span>
              <span>${priceEstimate.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              Final price confirmed at approval. No charge until approved.
            </p>
          </div>
        )}

        {/* Pickup or Delivery */}
        <div>
          <label className="text-[10px] uppercase tracking-widest mb-2 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Pickup or Delivery?</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { val: 'pickup',               label: 'I\'ll Pick It Up',      sub: 'Port St. Lucie',        price: null },
              { val: 'psl_delivery',         label: 'Deliver to Me',          sub: 'Port St. Lucie area',   price: '$39' },
              { val: 'surrounding_delivery', label: 'Deliver to Me',          sub: 'Surrounding areas',     price: '$49' },
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

          {/* Surrounding areas hint */}
          {formData.deliveryOption === 'surrounding_delivery' && (
            <p className="text-[11px] mt-2 ml-1" style={{ color: 'var(--text-tertiary)' }}>
              Includes Stuart, Jensen Beach, Fort Pierce, Palm City, and nearby areas.
            </p>
          )}

          {/* Delivery address field */}
          {formData.deliveryOption !== 'pickup' && (
            <div className="mt-3">
              <label className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>
                Delivery Address
              </label>
              <input
                type="text"
                value={formData.deliveryAddress}
                onChange={e => setFormData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                placeholder="Street address, city, ZIP"
                className={inputClass('deliveryAddress')}
                style={{ ...inputStyle, ...inputBorder('deliveryAddress') }}
              />
            </div>
          )}
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

        {/* Add-Ons */}
        <div>
          <label className="text-[10px] uppercase tracking-widest mb-2 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Optional Add-Ons</label>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, unlimitedMiles: !prev.unlimitedMiles }))}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 cursor-pointer text-left"
              style={{
                backgroundColor: formData.unlimitedMiles ? 'rgba(200,169,126,0.08)' : (theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
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
                  {formData.unlimitedMiles && '✓'}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, unlimitedTolls: !prev.unlimitedTolls }))}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 cursor-pointer text-left"
              style={{
                backgroundColor: formData.unlimitedTolls ? 'rgba(200,169,126,0.08)' : (theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
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
                  {formData.unlimitedTolls && '✓'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Photo ID Upload */}
        <div>
          <label className="text-[10px] uppercase tracking-widest mb-1 block ml-1" style={{ color: 'var(--text-tertiary)' }}>Photo ID *</label>
          <input
            ref={idPhotoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={handleIdPhotoChange}
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' }}
            id="idPhotoInput"
            aria-label="Upload photo ID"
          />
          {!idPhoto ? (
            <div
              role="button"
              tabIndex={0}
              onClick={triggerFileInput}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') triggerFileInput(); }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className={`flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 hover:border-[var(--accent)] ${
                errors.idPhoto ? 'border-red-500/60' : ''
              }`}
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderColor: errors.idPhoto ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
              }}
            >
              <Camera size={28} style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Upload Driver's License or ID</span>
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Tap to take a photo or choose from gallery</span>
              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>JPEG, PNG, or WebP · Max 10MB</span>
            </div>
          ) : (
            <div
              className="relative flex items-center gap-3 p-3 rounded-xl border"
              style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: 'var(--border-subtle)' }}
            >
              <img src={idPhotoPreview} alt="ID Preview" className="w-16 h-12 object-cover rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{idPhoto.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{(idPhoto.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button
                type="button"
                onClick={removeIdPhoto}
                className="p-1.5 rounded-full transition-colors hover:bg-red-500/20"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {errors.idPhoto && <p className="text-red-400 text-xs mt-1 ml-1">{errors.idPhoto}</p>}
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
