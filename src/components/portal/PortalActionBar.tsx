import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, MessageSquare, Star, Receipt, Key } from 'lucide-react';
import { haptic } from '../../hooks/useHaptic';

/**
 * PortalActionBar - floating mobile primary CTA for the customer portal.
 *
 * Always renders one clear next action per booking state, one-thumb-tap, above
 * the iOS home indicator (safe-area-inset-bottom). Phone-only (`md:hidden`) so
 * desktop users still scroll to the existing in-page form.
 *
 * Strategy: pickup and return actions open the guided Vaul sheets when wired by
 * CustomerPortal; other states still scroll to the relevant in-page section.
 *
 * Haptics: `navigator.vibrate(10)` on Android - iOS Safari silently ignores it.
 */

type BookingStatus =
  | 'pending_approval'
  | 'approved'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'active'
  | 'returned'
  | 'completed'
  | 'cancelled'
  | 'declined';

interface PortalActionBarProps {
  status: BookingStatus;
  /** True when an action API call is already in-flight (disables the bar) */
  disabled?: boolean;
  /** Customer phone for fallback tel: link, used when no inline action exists */
  ownerPhone?: string;
  /**
   * If provided, called for `ready_for_pickup` instead of scroll-to-anchor.
   * Used to open the mobile Vaul check-in sheet (Sprint 7c).
   */
  onCheckIn?: () => void;
  /** If provided, called for `active` instead of scroll-to-anchor (Sprint 7c). */
  onCheckOut?: () => void;
}

interface ActionConfig {
  label: string;
  icon: typeof ArrowRight;
  /** CSS anchor to smooth-scroll to */
  scrollTo: string;
  tone: 'accent' | 'neutral' | 'success';
}

// Per-state primary action. Returning `null` hides the bar (pending/cancelled/declined).
function actionFor(status: BookingStatus): ActionConfig | null {
  switch (status) {
    case 'ready_for_pickup':
      return { label: 'Check In', icon: Key, scrollTo: '#portal-checkin', tone: 'accent' };
    case 'active':
      return { label: 'Return Vehicle', icon: ArrowRight, scrollTo: '#portal-checkout', tone: 'accent' };
    case 'returned':
      return { label: 'View Inspection', icon: Receipt, scrollTo: '#portal-inspection', tone: 'neutral' };
    case 'completed':
      return { label: 'Leave a Review', icon: Star, scrollTo: '#portal-review', tone: 'success' };
    case 'approved':
    case 'confirmed':
      // Booking confirmed but not pickup-day yet - encourage messaging the owner.
      return { label: 'Message Us', icon: MessageSquare, scrollTo: '#portal-message', tone: 'neutral' };
    default:
      return null;
  }
}

const statusEyebrow: Partial<Record<BookingStatus, string>> = {
  approved: 'Booking',
  confirmed: 'Booking',
  ready_for_pickup: 'Pickup',
  active: 'Return',
  returned: 'Inspection',
  completed: 'Complete',
};

export default function PortalActionBar({
  status,
  disabled = false,
  onCheckIn,
  onCheckOut,
}: PortalActionBarProps) {
  const action = actionFor(status);
  const toneStyle = action?.tone === 'success'
    ? { backgroundColor: '#22c55e', color: '#fff' }
    : action?.tone === 'neutral'
      ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }
      : { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' };

  function handleTap() {
    haptic('tap');
    // Sprint 7c: if a direct trigger is wired, prefer it over scroll-to-anchor.
    if (status === 'ready_for_pickup' && onCheckIn) return onCheckIn();
    if (status === 'active' && onCheckOut) return onCheckOut();
    if (action) {
      const el = document.querySelector(action.scrollTo);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="md:hidden pointer-events-none fixed bottom-0 inset-x-0 z-[90] px-4"
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <div className="pointer-events-auto mx-auto max-w-lg">
            <button
              type="button"
              disabled={disabled}
              onClick={handleTap}
              aria-label={`${action.label}: ${statusEyebrow[status] || 'Next'} action`}
              className="tap-target flex h-14 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-2xl active:scale-95 transition-transform disabled:opacity-50"
              style={{
                ...toneStyle,
                boxShadow: '0 10px 30px rgba(11,26,48,0.32)',
              }}
            >
              <span className="min-w-0 truncate">{action.label}</span>
              <action.icon size={18} className="shrink-0" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
