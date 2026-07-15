import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, MessageSquare, Star, Receipt, Key } from 'lucide-react';
import { haptic } from '../../hooks/useHaptic';

/**
 * PortalActionBar - sticky bottom-center primary CTA for the customer portal.
 *
 * Always renders one clear next action per booking state, one-thumb-tap, above
 * the iOS home indicator (safe-area-inset-bottom). Phone-only (`md:hidden`) so
 * desktop users still scroll to the existing in-page form.
 *
 * Strategy: this bar is a navigation aid - taps scroll to the relevant section
 * of the existing portal page rather than triggering the API call directly.
 * That keeps the existing forms (with their photo validation, signature pads,
 * error handling) as the single source of truth. Sprint 7b will replace those
 * forms with bottom-sheet modals so the action bar becomes a direct trigger.
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

export default function PortalActionBar({
  status,
  disabled = false,
  onCheckIn,
  onCheckOut,
}: PortalActionBarProps) {
  const action = actionFor(status);

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
          className="md:hidden fixed bottom-0 inset-x-0 z-[90]"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderTop: '1px solid var(--border-subtle)',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <div className="px-4 pt-3">
            <button
              type="button"
              disabled={disabled}
              onClick={handleTap}
              className="tap-target w-full flex items-center justify-center gap-2 py-4 rounded-full font-semibold text-sm shadow-lg active:scale-95 transition-transform disabled:opacity-50"
              style={
                action.tone === 'success'
                  ? { backgroundColor: '#22c55e', color: '#fff' }
                  : action.tone === 'neutral'
                    ? { backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }
                    : { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
              }
            >
              <action.icon size={18} />
              {action.label}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
