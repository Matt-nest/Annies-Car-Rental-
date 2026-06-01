import { Car, Calendar, Shield, Gauge } from 'lucide-react';

interface BookingSummaryCardProps {
  bookingSummary: any;
  theme: string;
}

/**
 * Displays the booking cost breakdown inside the payment step.
 * Extracted from StripeCheckoutForm for clarity.
 */
export default function BookingSummaryCard({ bookingSummary, theme }: BookingSummaryCardProps) {
  if (!bookingSummary) return null;

  const addOns = [
    bookingSummary.hasUnlimitedMiles && 'Unlimited Miles',
    bookingSummary.hasUnlimitedTolls && 'Unlimited Tolls',
    bookingSummary.hasDelivery && 'Delivery',
  ].filter(Boolean);

  return (
    <div
      className="rounded-xl p-4 mb-6 space-y-2.5"
      style={{
        backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {bookingSummary.vehicle && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <Car size={14} style={{ color: 'var(--accent-color)' }} />
          <span className="font-medium">{bookingSummary.vehicle}</span>
        </div>
      )}
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
        <span>
          {new Date(bookingSummary.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' → '}
          {new Date(bookingSummary.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          <span className="opacity-60"> · {bookingSummary.rentalDays} day{bookingSummary.rentalDays !== 1 ? 's' : ''}</span>
        </span>
      </div>

      {/* Add-on badges */}
      {addOns.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {addOns.map((label) => (
            <span
              key={label as string}
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(200,169,126,0.12)',
                color: 'var(--accent-color)',
                border: '1px solid rgba(200,169,126,0.2)',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div
        className="pt-2 mt-2 space-y-1 text-sm"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
          <span>${bookingSummary.dailyRate}/day × {bookingSummary.rentalDays} days</span>
          <span>${bookingSummary.subtotal?.toFixed(2)}</span>
        </div>
        {bookingSummary.deliveryFee > 0 && (
          <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
            <span>Delivery fee</span>
            <span>${bookingSummary.deliveryFee.toFixed(2)}</span>
          </div>
        )}
        {bookingSummary.discountAmount > 0 && (
          <div className="flex justify-between" style={{ color: '#22c55e' }}>
            <span>Discount</span>
            <span>-${bookingSummary.discountAmount.toFixed(2)}</span>
          </div>
        )}
        {bookingSummary.mileageAddonFee > 0 && (
          <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
            <span>Unlimited Miles</span>
            <span>${bookingSummary.mileageAddonFee.toFixed(2)}</span>
          </div>
        )}
        {bookingSummary.tollAddonFee > 0 && (
          <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
            <span>Unlimited Tolls</span>
            <span>${bookingSummary.tollAddonFee.toFixed(2)}</span>
          </div>
        )}
        {bookingSummary.taxAmount > 0 && (
          <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
            <span>Tax</span>
            <span>${bookingSummary.taxAmount.toFixed(2)}</span>
          </div>
        )}
        <div
          className="flex justify-between font-semibold pt-1.5 mt-1.5"
          style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <span>Rental Total</span>
          <span>${(bookingSummary.totalCost || 0).toFixed(2)}</span>
        </div>

        {/* Mileage allowance */}
        {bookingSummary.rentalDays > 0 && (
          <div className="flex justify-between text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            <span className="flex items-center gap-1.5">
              <Gauge size={11} />
              Mileage included
            </span>
            <span>{(bookingSummary.rentalDays * 200).toLocaleString()} miles ({bookingSummary.rentalDays} × 200 mi/day)</span>
          </div>
        )}

        {/* Security Deposit — included in Stripe charge */}
        {bookingSummary.depositAmount > 0 && (
          <>
            <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1.5">
                <Shield size={12} />
                Refundable security deposit
              </span>
              <span>${bookingSummary.depositAmount.toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between font-bold pt-1.5 mt-1"
              style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <span>Total Charged Today</span>
              <span>${(bookingSummary.totalChargedWithDeposit || (bookingSummary.totalCost + bookingSummary.depositAmount)).toFixed(2)}</span>
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Your ${bookingSummary.depositAmount.toFixed(2)} deposit is fully refundable after vehicle inspection.
            </p>
          </>
        )}

        {/* Incidentals disclosure */}
        <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          Additional charges may apply for tolls ($50 admin fee each), fuel refill ($20/quarter tank), 
          late returns ($30/day), mileage over 200 mi/day ($0.34/mile), or cleaning (up to $250). 
          These are only charged if incurred and are deducted from your security deposit.
        </p>
      </div>
    </div>
  );
}
