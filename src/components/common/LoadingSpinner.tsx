import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  size?: number;
  className?: string;
}

/**
 * Consistent loading spinner with optional label.
 * Replaces duplicate Loader2 + animate-spin patterns across
 * BookingStatusPage, ConfirmBooking, and RentalAgreement.
 */
export default function LoadingSpinner({
  label = 'Loading…',
  size = 22,
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <Loader2
        className="animate-spin"
        size={size}
        style={{ color: 'var(--accent-color)' }}
      />
      {label && (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      )}
    </div>
  );
}
