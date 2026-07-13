import { formatDateOnly } from './dates';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateTime(date, time, fallbackTime = '23:59:00') {
  if (!date) return null;
  const rawTime = time || fallbackTime;
  const normalizedTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
  const value = new Date(`${date}T${normalizedTime}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameLocalDay(date, compare = new Date()) {
  if (!date) return false;
  const d = new Date(`${date}T00:00:00`);
  return startOfDay(d).getTime() === startOfDay(compare).getTime();
}

export function isWithinDays(date, days, compare = new Date()) {
  if (!date) return false;
  const d = new Date(`${date}T00:00:00`);
  const delta = startOfDay(d).getTime() - startOfDay(compare).getTime();
  return delta >= 0 && delta <= days * DAY_MS;
}

export function getReturnDateTime(booking) {
  return toDateTime(booking?.return_date, booking?.return_time);
}

export function getPickupDateTime(booking) {
  return toDateTime(booking?.pickup_date, booking?.pickup_time, '09:00:00');
}

export function isReturnOverdue(booking, now = new Date()) {
  if (booking?.status !== 'active') return false;
  const dt = getReturnDateTime(booking);
  return Boolean(dt && dt.getTime() < now.getTime());
}

export function formatBookingWindow(booking) {
  if (!booking?.pickup_date || !booking?.return_date) return 'Dates not set';
  return `${formatDateOnly(booking.pickup_date, 'MMM d')} -> ${formatDateOnly(booking.return_date, 'MMM d')}`;
}

export function getCustomerName(booking) {
  const c = booking?.customers || {};
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return name || booking?.customer_name || 'Customer';
}

export function getVehicleName(booking) {
  const v = booking?.vehicles || {};
  const name = [v.year, v.make, v.model].filter(Boolean).join(' ');
  return name || booking?.vehicle_name || 'Vehicle not assigned';
}

export function getAgreement(booking) {
  return Array.isArray(booking?.rental_agreements)
    ? booking.rental_agreements[0]
    : booking?.rental_agreements;
}

export function hasCompletedRentalPayment(booking) {
  const payments = Array.isArray(booking?.payments) ? booking.payments : [];
  if (payments.some((p) => p.payment_type === 'rental' && ['completed', 'paid', 'succeeded'].includes(p.status))) {
    return true;
  }
  return ['paid', 'held', 'collected', 'refunded', 'applied', 'partial_refund'].includes(booking?.deposit_status);
}

export function hasCustomerSignedAgreement(booking) {
  return Boolean(getAgreement(booking)?.customer_signed_at);
}

export function needsOwnerCounterSignature(booking) {
  const agreement = getAgreement(booking);
  return Boolean(agreement?.customer_signed_at && !agreement?.owner_signed_at);
}

export function isReadyForHandoff(booking) {
  if (!booking) return false;
  if (booking.status === 'ready_for_pickup') return true;
  if (booking.status !== 'confirmed') return false;
  return hasCompletedRentalPayment(booking) && hasCustomerSignedAgreement(booking) && !needsOwnerCounterSignature(booking);
}

export function getBookingLifecycle(booking) {
  const status = booking?.status || 'unknown';
  const paid = hasCompletedRentalPayment(booking);
  const signed = hasCustomerSignedAgreement(booking);
  const needsCounterSign = needsOwnerCounterSignature(booking);

  if (status === 'pending_approval') {
    return {
      key: 'needs_approval',
      label: 'Needs approval',
      tone: 'amber',
      step: 1,
      action: 'Review booking',
      description: 'Confirm customer, vehicle, dates, risk, deposit, and delivery before sending payment instructions.',
    };
  }

  if (status === 'approved' && !paid) {
    return {
      key: 'payment_due',
      label: 'Payment due',
      tone: 'sky',
      step: 2,
      action: 'Send continue link',
      description: 'Booking is approved, but the customer still needs to complete payment before the trip is operationally safe.',
    };
  }

  if (['approved', 'confirmed'].includes(status) && !signed) {
    return {
      key: 'agreement_due',
      label: 'Agreement due',
      tone: 'violet',
      step: 3,
      action: 'Send continue link',
      description: 'Payment is handled, but the customer still needs to complete the rental agreement, license, insurance, and signature.',
    };
  }

  if (['approved', 'confirmed'].includes(status) && needsCounterSign) {
    return {
      key: 'counter_sign_needed',
      label: 'Counter-sign needed',
      tone: 'amber',
      step: 4,
      action: 'Counter-sign',
      description: 'Customer completed their agreement. Owner counter-signature is the last document step before handoff.',
    };
  }

  if (status === 'ready_for_pickup') {
    return {
      key: 'ready_for_pickup',
      label: 'Ready for pickup',
      tone: 'emerald',
      step: 5,
      action: 'Open check-in',
      description: 'Vehicle is prepped. Confirm handoff details, lockbox/code, photos, fuel, and customer pickup instructions.',
    };
  }

  if (status === 'confirmed') {
    if (isSameLocalDay(booking?.pickup_date)) {
      return {
        key: 'pickup_today',
        label: 'Pickup today',
        tone: 'blue',
        step: 5,
        action: 'Prep handoff',
        description: 'Vehicle handoff is due today. Confirm photos, fuel, odometer, lockbox, and instructions.',
      };
    }
    return {
      key: 'confirmed',
      label: 'Confirmed',
      tone: 'emerald',
      step: 4,
      action: 'Prep handoff',
      description: 'Booking is paid, signed, and confirmed. Prep vehicle handoff before pickup day.',
    };
  }

  if (status === 'active') {
    if (isReturnOverdue(booking)) {
      return {
        key: 'overdue_return',
        label: 'Overdue return',
        tone: 'red',
        step: 7,
        action: 'Contact renter',
        description: 'Return time has passed. Prioritize customer contact and vehicle recovery/extension decision.',
      };
    }
    if (isSameLocalDay(booking?.return_date)) {
      return {
        key: 'return_today',
        label: 'Return today',
        tone: 'purple',
        step: 7,
        action: 'Prepare checkout',
        description: 'Trip is active and due back today. Prepare return inspection and deposit decision.',
      };
    }
    return {
      key: 'active_trip',
      label: 'Active trip',
      tone: 'emerald',
      step: 6,
      action: 'Monitor trip',
      description: 'Rental is active. Watch return timing, extensions, mileage, and customer messages.',
    };
  }

  if (status === 'returned') {
    return {
      key: 'needs_checkout',
      label: 'Needs checkout',
      tone: 'orange',
      step: 8,
      action: 'Inspect and settle',
      description: 'Customer return is recorded. Complete inspection, incidentals, and deposit settlement.',
    };
  }

  if (status === 'completed') {
    return {
      key: 'complete',
      label: 'Complete',
      tone: 'slate',
      step: 9,
      action: 'View record',
      description: 'Booking is complete. Use it for customer history and reporting.',
    };
  }

  if (['declined', 'cancelled'].includes(status)) {
    return {
      key: status,
      label: status === 'declined' ? 'Declined' : 'Cancelled',
      tone: 'slate',
      step: 0,
      action: 'View record',
      description: 'No active operational work remains unless follow-up is needed.',
    };
  }

  return {
    key: status,
    label: status.replace(/_/g, ' '),
    tone: 'slate',
    step: 0,
    action: 'Review',
    description: 'Review booking details and decide the next action.',
  };
}

export const BOOKING_LIFECYCLE_STEPS = [
  'Approval',
  'Payment',
  'Agreement',
  'Counter-sign',
  'Pickup',
  'Active',
  'Return',
  'Checkout',
  'Complete',
];

export function toneClasses(tone) {
  const tones = {
    amber: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    sky: { text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
    blue: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    violet: { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    emerald: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    purple: { text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    red: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    orange: { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    slate: { text: 'text-[var(--text-secondary)]', bg: 'bg-[var(--bg-card-hover)]', border: 'border-[var(--border-subtle)]' },
  };
  return tones[tone] || tones.slate;
}
