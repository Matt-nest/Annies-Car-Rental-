import React from 'react';
import { Car, Calendar, DollarSign, MapPin, Truck } from 'lucide-react';
import { formatCurrency, formatDate, type WizardDraft } from '../constants';

interface Props {
  autoFilled: any;
  theme: string;
  onContinue: () => void;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] mb-1 ml-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <div
        className="px-3.5 py-2.5 rounded-xl text-sm"
        style={{
          backgroundColor: 'rgba(200,169,126,0.06)',
          border: '1px solid rgba(200,169,126,0.15)',
          color: 'var(--text-primary)',
        }}
      >
        {value || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
      </div>
    </div>
  );
}

export default function RentalSummaryStep({ autoFilled: af, theme, onContinue }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
            <Car size={16} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Rental Summary</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Customer" value={af.customerName} />
          <ReadOnlyField label="Vehicle" value={af.vehicle} />
          <ReadOnlyField label="Pickup Date" value={formatDate(af.dateOut)} />
          <ReadOnlyField label="Return Date" value={formatDate(af.dateDueIn)} />
          <ReadOnlyField label="VIN" value={af.vin || 'On file'} />
          <ReadOnlyField label="License Plate" value={af.licensePlate || 'On file'} />
          {af.color && <ReadOnlyField label="Color" value={af.color} />}
          <ReadOnlyField label="Pickup Location" value={af.pickupLocation || 'Port St. Lucie'} />
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
          <div className="flex justify-between text-sm font-semibold pt-1.5"
            style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-primary)' }}>Rental Total</span>
            <span style={{ color: 'var(--accent-color)' }}>{formatCurrency(af.totalCost)}</span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Miles allowed: {af.milesPerDay}/day · Security deposit collected at payment
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="group w-full py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
        style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
      >
        Looks Good — Continue
        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
      </button>
    </div>
  );
}
