import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePushSubscription } from '../../hooks/usePushSubscription';

/**
 * PushOptInCard - phone-friendly "Get a buzz when your ride is ready"
 * opt-in surface for the customer portal.
 *
 * Sprint 12b. Renders only when:
 *   - Browser supports the Push API + Notification API
 *   - Backend has VAPID keys configured (GET /push/vapid-key returns enabled)
 *   - The booking is in a state where push is useful (pre-completion).
 *
 * iOS 16.4+ requires the site to be installed as a home-screen PWA before
 * push can work. When the hook detects we're NOT installed, the card shows
 * the install instructions instead of the enable button.
 *
 * Permission flow follows the research doc's double-prompt pattern: we never
 * call Notification.requestPermission() until the user taps Enable.
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

interface PushOptInCardProps {
  status: BookingStatus;
  portalToken: string | null;
}

// Push only useful before completion + during settlement.
const ELIGIBLE_STATUSES: BookingStatus[] = [
  'pending_approval', 'approved', 'confirmed', 'ready_for_pickup', 'active', 'returned',
];

export default function PushOptInCard({ status, portalToken }: PushOptInCardProps) {
  const push = usePushSubscription(portalToken);

  // Hide entirely when:
  //   • The booking is past the point where push matters
  //   • The browser doesn't support it (don't promise something we can't deliver)
  //   • The backend isn't configured yet (VAPID missing)
  if (!ELIGIBLE_STATUSES.includes(status)) return null;
  if (!push.supported) return null;
  if (!push.serverEnabled) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.35 }}
      className="rounded-2xl px-4 py-3 flex items-center gap-3"
      style={{
        backgroundColor: push.subscribed ? 'rgba(34,197,94,0.06)' : 'var(--bg-card)',
        border: `1px solid ${push.subscribed ? 'rgba(34,197,94,0.2)' : 'var(--border-subtle)'}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{
          backgroundColor: push.subscribed ? 'rgba(34,197,94,0.12)' : 'var(--bg-elevated)',
          border: `1px solid ${push.subscribed ? 'rgba(34,197,94,0.25)' : 'var(--border-subtle)'}`,
        }}
        aria-hidden="true"
      >
        {push.subscribed
          ? <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
          : <Bell size={16} style={{ color: 'var(--accent-color)' }} />}
      </div>

      <div className="flex-1 min-w-0">
        {push.subscribed ? (
          <>
            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              Notifications are on
            </p>
            <p className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              We&apos;ll buzz this device when your booking changes.
            </p>
          </>
        ) : push.requiresInstall ? (
          <>
            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              Add to Home Screen first
            </p>
            <p className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              On iPhone: tap <span aria-label="Share">⎙</span> → <em>Add to Home Screen</em>. Then return here to enable notifications.
            </p>
          </>
        ) : push.permission === 'denied' ? (
          <>
            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              Notifications blocked
            </p>
            <p className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Allow notifications for this site in your browser settings, then come back.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              Get instant booking updates
            </p>
            <p className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Buzz when your car&apos;s ready, when your trip starts, and when settlement is done.
            </p>
            <AnimatePresence>
              {push.error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[11px] mt-1 flex items-center gap-1"
                  style={{ color: '#ef4444' }}
                >
                  <AlertCircle size={11} /> {push.error}
                </motion.p>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* CTA - different per state */}
      {push.subscribed ? (
        <button
          type="button"
          onClick={push.unsubscribe}
          disabled={push.loading}
          aria-label="Turn off notifications"
          className="tap-target px-3 py-2 rounded-full text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50"
          style={{ color: 'var(--text-secondary)', background: 'transparent' }}
        >
          {push.loading ? <Loader2 size={14} className="animate-spin" /> : <BellOff size={14} />}
        </button>
      ) : push.requiresInstall || push.permission === 'denied' ? null : (
        <button
          type="button"
          onClick={push.subscribe}
          disabled={push.loading}
          className="tap-target px-4 py-2 rounded-full font-semibold text-xs whitespace-nowrap active:scale-95 transition-transform disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {push.loading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Enabling…
            </span>
          ) : 'Enable'}
        </button>
      )}
    </motion.div>
  );
}
