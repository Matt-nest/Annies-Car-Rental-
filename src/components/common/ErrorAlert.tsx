import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  className?: string;
}

/**
 * Standardized error alert banner.
 * Extracted from RequestToBookForm, BookingStatusPage, ConfirmBooking,
 * and RentalAgreement where the identical pattern was copy-pasted.
 */
export default function ErrorAlert({ message, className = '' }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${className}`}
      style={{
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderColor: 'rgba(239,68,68,0.25)',
        color: '#ef4444',
      }}
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
