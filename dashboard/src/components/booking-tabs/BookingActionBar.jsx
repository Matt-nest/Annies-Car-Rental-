import { Check, Key, Package, Flag, X } from 'lucide-react';
import { haptic } from '../../lib/haptic';

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
 * Positioning: sits ABOVE the dashboard BottomNav (Sprint 3a) which is
 * 64 px + safe-area-bottom. Calculated via the same env() math.
 */
const STATUS_ACTIONS = {
  pending_approval: {
    primary:   { action: 'approve', label: 'Approve',  icon: Check, tone: 'success' },
    secondary: { action: 'decline', label: 'Decline',  icon: X,     tone: 'danger'  },
  },
  approved: {
    primary: { action: 'pickup', label: 'Mark Pickup', icon: Package, tone: 'accent' },
  },
  confirmed: {
    primary: { action: 'pickup', label: 'Mark Pickup', icon: Package, tone: 'accent' },
  },
  ready_for_pickup: {
    primary: { action: 'pickup', label: 'Mark Pickup', icon: Key, tone: 'accent' },
  },
  active: {
    primary: { action: 'return', label: 'Mark Returned', icon: Flag, tone: 'accent' },
  },
  returned: {
    primary: { action: 'complete', label: 'Complete Booking', icon: Check, tone: 'success' },
  },
};

const TONE_STYLE = {
  success: { backgroundColor: '#22c55e', color: '#fff' },
  accent:  { backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg, #fff)' },
  danger:  { backgroundColor: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' },
};

export default function BookingActionBar({ status, onAction, disabled = false }) {
  const cfg = STATUS_ACTIONS[status];
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
    <div
      className="md:hidden fixed inset-x-0 z-[80]"
      style={{
        bottom: 'var(--bottom-nav-offset)',
        backgroundColor: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-subtle)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
      }}
    >
      <div className="px-4 py-3 flex items-center gap-2 safe-x">
        {cfg.secondary && SecondaryIcon && (
          <button
            type="button"
            onClick={handleSecondary}
            disabled={disabled}
            className="tap-target flex items-center justify-center gap-2 px-4 py-3 rounded-full font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
            style={TONE_STYLE[cfg.secondary.tone]}
          >
            <SecondaryIcon size={16} />
            {cfg.secondary.label}
          </button>
        )}
        <button
          type="button"
          onClick={handlePrimary}
          disabled={disabled}
          className="tap-target flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm active:scale-95 transition-transform shadow-lg disabled:opacity-50"
          style={TONE_STYLE[cfg.primary.tone]}
        >
          <PrimaryIcon size={18} />
          {cfg.primary.label}
        </button>
      </div>
    </div>
  );
}
