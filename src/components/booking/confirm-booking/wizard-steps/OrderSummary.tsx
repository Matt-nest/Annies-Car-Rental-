import React from 'react';
import { Receipt, Shield, Car, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate, INSURANCE_TIERS, type WizardDraft } from '../constants';

interface Props {
  bookingSummary: any;
  draft: WizardDraft;
  depositAmount: number;
  theme: string;
}

export default function OrderSummary({ bookingSummary: bs, draft, depositAmount, theme }: Props) {
  const rentalDays = bs?.rentalDays || 1;

  // Calculate insurance cost
  let insuranceCost = 0;
  let insuranceLabel = 'No coverage selected';
  if (draft.insuranceChoice === 'annies' && draft.anniesTier) {
    const tier = INSURANCE_TIERS.find(t => t.key === draft.anniesTier);
    if (tier) {
      insuranceCost = tier.dailyRate * rentalDays;
      insuranceLabel = `${tier.name} (${formatCurrency(tier.dailyRate)}/day × ${rentalDays} days)`;
    }
  } else if (draft.insuranceChoice === 'own') {
    insuranceLabel = 'Your own insurance — no charge';
  }

  const rentalTotal = bs?.totalCost || 0;
  const grandTotal = rentalTotal + insuranceCost + depositAmount;

  return (
    <div className="rounded-xl border p-4 sm:p-5"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
          <Receipt size={16} />
        </div>
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Order Summary</h3>
      </div>

      {/* Vehicle + dates */}
      <div className="flex items-center gap-2 mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Car size={14} style={{ color: 'var(--accent-color)' }} />
        <span>{bs?.vehicle || 'Vehicle'}</span>
      </div>
      <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <Calendar size={12} />
        <span>{formatDate(bs?.pickupDate)} → {formatDate(bs?.returnDate)} · {rentalDays} day{rentalDays !== 1 ? 's' : ''}</span>
      </div>

      {/* Line items */}
      <div className="space-y-2 text-sm" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
        {bs?.lineItems?.length > 0 ? (
          // Weekly/mixed bookings: use the structured line_items from DB
          bs.lineItems.map((item: { label: string; amount: number }, i: number) => (
            <div key={i} className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
              <span style={{ color: item.amount < 0 ? '#22c55e' : 'var(--text-primary)' }}>
                {item.amount < 0 ? `-${formatCurrency(Math.abs(item.amount))}` : formatCurrency(item.amount)}
              </span>
            </div>
          ))
        ) : (
          // Legacy/daily fallback: individual named fields
          <>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Rental ({rentalDays} day{rentalDays !== 1 ? 's' : ''} × {formatCurrency(bs?.dailyRate || 0)}/day)</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(bs?.subtotal || 0)}</span>
            </div>

            {(bs?.deliveryFee || 0) > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Delivery fee</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(bs.deliveryFee)}</span>
              </div>
            )}

            {(bs?.discountAmount || 0) > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                <span style={{ color: '#22c55e' }}>-{formatCurrency(bs.discountAmount)}</span>
              </div>
            )}

            {(bs?.mileageAddonFee || 0) > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Unlimited Miles</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(bs.mileageAddonFee)}</span>
              </div>
            )}

            {(bs?.tollAddonFee || 0) > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Unlimited Tolls</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(bs.tollAddonFee)}</span>
              </div>
            )}

            {(bs?.taxAmount || 0) > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Tax</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(bs.taxAmount)}</span>
              </div>
            )}
          </>
        )}

        {/* Rental subtotal */}
        <div className="flex justify-between font-medium pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ color: 'var(--text-primary)' }}>Rental Total</span>
          <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(rentalTotal)}</span>
        </div>

        {/* Insurance */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Shield size={14} style={{ color: 'var(--accent-color)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Insurance</span>
          </div>
          <span style={{ color: insuranceCost > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            {insuranceCost > 0 ? formatCurrency(insuranceCost) : 'Included'}
          </span>
        </div>
        <p className="text-[10px] ml-[22px]" style={{ color: 'var(--text-tertiary)' }}>{insuranceLabel}</p>

        {/* Security Deposit */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <DollarSign size={14} style={{ color: 'var(--accent-color)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Refundable Deposit</span>
          </div>
          <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(depositAmount)}</span>
        </div>
        <p className="text-[10px] ml-[22px]" style={{ color: 'var(--text-tertiary)' }}>
          Returned after vehicle inspection at check-in
        </p>

        {/* Grand Total */}
        <div className="flex justify-between text-base font-bold pt-2 mt-1"
          style={{ borderTop: '2px solid var(--border-subtle)' }}>
          <span style={{ color: 'var(--text-primary)' }}>Total Charge Today</span>
          <span style={{ color: 'var(--accent-color)' }}>{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
