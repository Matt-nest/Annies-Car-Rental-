import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, MessageSquare, Star, Receipt, Key } from 'lucide-react';
import { haptic } from '../../hooks/useHaptic';

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
  disabled?: boolean;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
}

interface ActionConfig {
  label: string;
  icon: typeof ArrowRight;
  scrollTo: string;
  tone: 'accent' | 'neutral' | 'success';
}

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
                    : { backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg, #1c1917)' }
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
