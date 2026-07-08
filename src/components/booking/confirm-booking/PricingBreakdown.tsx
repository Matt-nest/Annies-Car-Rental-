import React from 'react';
import { formatCurrency } from './constants';

export interface PricingSnapshot {
  rentalDays?: number;
  dailyRate?: number;
  subtotal?: number;
  deliveryFee?: number;
  discountAmount?: number;
  mileageAddonFee?: number;
  tollAddonFee?: number;
  taxAmount?: number;
  totalCost?: number;
  lineItems?: { label: string; amount: number }[] | null;
  mileageAllowance?: string | null;
  milesPerDay?: number;
}

interface Props {
  pricing: PricingSnapshot;
  /** Show the bold "Rental Total" footer row */
  showTotal?: boolean;
  className?: string;
}

/** Human-readable mileage note for receipt footers. */
export function mileageAllowanceNote(pricing: PricingSnapshot): string {
  if (pricing.mileageAllowance === 'unlimited') {
    return 'Unlimited miles included';
  }
  if ((pricing.mileageAddonFee || 0) > 0) {
    return 'Unlimited miles add-on';
  }
  const perDay = pricing.milesPerDay || 150;
  return `Miles allowed: ${perDay}/day`;
}

/**
 * Itemized rental pricing — mirrors the booking's stored line_items when
 * available, otherwise reconstructs from individual DB fields.
 */
export default function PricingBreakdown({ pricing, showTotal = true, className = '' }: Props) {
  const rentalDays = pricing.rentalDays || 1;
  const lineItems = Array.isArray(pricing.lineItems) ? pricing.lineItems : null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {lineItems && lineItems.length > 0 ? (
        lineItems.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            <span style={{ color: item.amount < 0 ? '#22c55e' : 'var(--text-primary)' }}>
              {item.amount < 0
                ? `-${formatCurrency(Math.abs(Number(item.amount)))}`
                : formatCurrency(Number(item.amount))}
            </span>
          </div>
        ))
      ) : (
        <>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>
              {rentalDays} day{rentalDays !== 1 ? 's' : ''} × {formatCurrency(pricing.dailyRate || 0)}/day
            </span>
            <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(pricing.subtotal || 0)}</span>
          </div>

          {(pricing.deliveryFee || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Delivery fee</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(pricing.deliveryFee!)}</span>
            </div>
          )}

          {(pricing.discountAmount || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
              <span style={{ color: '#22c55e' }}>-{formatCurrency(pricing.discountAmount!)}</span>
            </div>
          )}

          {(pricing.mileageAddonFee || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Unlimited miles</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(pricing.mileageAddonFee!)}</span>
            </div>
          )}

          {(pricing.tollAddonFee || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Unlimited tolls</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(pricing.tollAddonFee!)}</span>
            </div>
          )}

          {(pricing.taxAmount || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Tax</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(pricing.taxAmount!)}</span>
            </div>
          )}
        </>
      )}

      {showTotal && (
        <div
          className="flex justify-between text-sm font-semibold pt-1.5"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <span style={{ color: 'var(--text-primary)' }}>Rental Total</span>
          <span style={{ color: 'var(--accent-color)' }}>{formatCurrency(pricing.totalCost || 0)}</span>
        </div>
      )}
    </div>
  );
}
