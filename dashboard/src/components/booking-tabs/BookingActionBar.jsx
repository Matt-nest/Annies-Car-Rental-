import { Check, Key, Package, Flag, X } from 'lucide-react';
import MobileTaskBar from '../shared/MobileTaskBar';
import { haptic } from '../../lib/haptic';
import { hasCompletedRentalPayment, isReadyForHandoff, needsOwnerCounterSignature } from '../../lib/bookingOps';

/**
 * BookingActionBar — sticky bottom primary-action CTA for the admin booking
 * detail page. Phone-only (`md:hidden`) — desktop already has the action
 * buttons visible inside the Overview / Check-In tabs.
 *
 * The bar reads the booking status and renders the single most-important
 * next action. Tapping it calls `onAction(actionName)` which the parent
 * (BookingDetailPage) wires to its existing `setModal(action)` flow, so
 * all the existing BookingModals.jsx flows (decline reason, pickup
 * mileage/fuel/photos, etc.) remain the source of truth.
 *
 * Positioning: sits ABOVE the dashboard BottomNav using shared mobile chrome
 * variables so iOS Safari's dynamic toolbar does not leave a floating slab.
 *
 * Sprint 8b. NEVER-TOUCH respected: doesn't change api/client.js, modal
 * shapes, status state machine, or the BookingModals component itself.
 */
const STATUS_ACTIONS = {
  pending_approval: {
    primary:   { action: 'approve', label: 'Approve',  icon: Check, tone: 'success' },
    secondary: { action: 'decline', label: 'Decline',  icon: X,     tone: 'danger'  },
  },
  approved: {
    primary: { action: 'overview', label: 'Send Continue Link', icon: Package, tone: 'accent' },
  },
  confirmed: {
    primary: { action: 'checkin', label: 'Prep Pickup', icon: Package, tone: 'accent' },
  },
  ready_for_pickup: {
    primary: { action: 'checkin', label: 'Open Check-In', icon: Key, tone: 'accent' },
  },
  active: {
    primary: { action: 'checkout', label: 'Open Check-Out', icon: Flag, tone: 'accent' },
  },
  returned: {
    primary: { action: 'checkout', label: 'Settle Checkout', icon: Check, tone: 'success' },
  },
  // completed / cancelled / declined → no action bar shown
};

const STATUS_EYEBROWS = {
  pending_approval: 'Approval',
  approved: 'Payment',
  confirmed: 'Pickup',
  ready_for_pickup: 'Pickup',
  active: 'Return',
  returned: 'Settlement',
};

function getConfig(status, booking) {
  if (status === 'approved' && !hasCompletedRentalPayment(booking)) {
    return { primary: { action: 'overview', label: 'Send Continue Link', icon: Package, tone: 'accent' } };
  }
  if (['approved', 'confirmed'].includes(status) && needsOwnerCounterSignature(booking)) {
    return { primary: { action: 'overview', label: 'Counter-Sign', icon: Check, tone: 'success' } };
  }
  if (status === 'confirmed' && !isReadyForHandoff(booking)) {
    return { primary: { action: 'overview', label: 'Finish Documents', icon: Package, tone: 'accent' } };
  }
  return STATUS_ACTIONS[status];
}

export default function BookingActionBar({ booking, status, onAction, disabled = false }) {
  const cfg = getConfig(status, booking);
  if (!cfg) return null;

  function handlePrimary() {
    haptic('commit');
    onAction?.(cfg.primary.action);
  }
  function handleSecondary() {
    haptic('tap');
    if (cfg.secondary) onAction?.(cfg.secondary.action);
  }

  const PrimaryIcon = cfg.primary.icon;
  const SecondaryIcon = cfg.secondary?.icon;

  return (
    <MobileTaskBar
      eyebrow={STATUS_EYEBROWS[status] || 'Next'}
      title={booking.booking_code || 'Booking'}
      subtitle="Swipe down to return here"
      primaryLabel={cfg.primary.label}
      primaryIcon={PrimaryIcon}
      primaryTone={cfg.primary.tone}
      secondaryLabel={cfg.secondary?.label}
      secondaryIcon={SecondaryIcon}
      secondaryTone={cfg.secondary?.tone}
      onPrimary={handlePrimary}
      onSecondary={handleSecondary}
      disabled={disabled}
    />
  );
}
