import React from 'react';
import { Car, Calendar, MapPin, Truck, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '../constants';
import { brand } from '../../../../config/brand';

interface Props {
  autoFilled: any;
  theme: string;
  onContinue: () => void;
}

/** "14:30" → "2:30 PM"; passes through anything it can't parse. */
function formatTime(t?: string): string {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}

export default function RentalSummaryStep({ autoFilled: af, theme, onContinue }: Props) {
  const firstName = (af.customerName || '').trim().split(' ')[0];
  const isDelivery = af.deliveryType === 'delivery' && !!af.deliveryAddress;
  const LocationIcon = isDelivery ? Truck : MapPin;
  const locationLabel = isDelivery ? 'Delivery to' : 'Pickup at';
  const locationValue = isDelivery ? af.deliveryAddress : (af.pickupLocation || brand.location.city);

  const DateTile = ({ label, date, time }: { label: string; date: string; time?: string }) => (
    <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Calendar size={12} style={{ color: 'var(--accent-color)' }} />
        <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{date}</p>
      {time && (
        <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          <Clock size={11} /> {formatTime(time)}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        {/* Car photo */}
        {af.vehicleImage ? (
          <img src={af.vehicleImage} alt={af.vehicle || 'Your rental vehicle'} className="w-full object-cover" style={{ aspectRatio: '16 / 10' }} />
        ) : (
          <div className="w-full flex items-center justify-center" style={{ aspectRatio: '16 / 10', backgroundColor: 'var(--accent-glow)' }}>
            <Car size={40} style={{ color: 'var(--accent-color)' }} />
          </div>
        )}

        <div className="p-4 sm:p-5">
          {/* Greeting + vehicle */}
          {firstName && (
            <p className="text-[13px] mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Here's your rental, {firstName}.</p>
          )}
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {af.vehicle || 'Your vehicle'}
          </h3>

          {/* Location */}
          <div className="flex items-start gap-2 mb-4">
            <LocationIcon size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-color)' }} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-tertiary)' }}>{locationLabel}</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{locationValue}</p>
            </div>
          </div>

          {/* Dates + times */}
          <div className="grid grid-cols-2 gap-3">
            <DateTile label="Pickup" date={formatDate(af.dateOut)} time={af.pickupTime} />
            <DateTile label="Return" date={formatDate(af.dateDueIn)} time={af.returnTime} />
          </div>

          {/* Pricing */}
          <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>{af.rentalDays} day{af.rentalDays !== 1 ? 's' : ''} × {formatCurrency(af.dailyRate)}/day</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(af.subtotal)}</span>
            </div>
            {af.deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Delivery fee</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(af.deliveryFee)}</span>
              </div>
            )}
            {af.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                <span style={{ color: '#22c55e' }}>-{formatCurrency(af.discountAmount)}</span>
              </div>
            )}
            {af.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Tax</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(af.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold pt-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-primary)' }}>Rental Total</span>
              <span style={{ color: 'var(--accent-color)' }}>{formatCurrency(af.totalCost)}</span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Miles allowed: {af.milesPerDay}/day · Security deposit collected at payment
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="group w-full py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
        style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
      >
        Looks Good, Continue
        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
      </button>
    </div>
  );
}
