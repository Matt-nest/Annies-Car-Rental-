import { Car, Calendar } from 'lucide-react';

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
          <span>Total</span>
          <span>${(bookingSummary.totalCost || 0).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
