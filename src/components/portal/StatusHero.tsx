import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, Car, Key, AlertCircle, Hourglass } from 'lucide-react';
import { EASE } from '../../utils/motion';

/**
 * StatusHero — the big "what's happening NOW" card at the top of the portal.
 *
 * Replaces the small identity header. Each booking state gets:
 *   • A color-tinted badge
 *   • A large primary copy line
 *   • A live countdown / elapsed timer (refreshes every minute)
 *   • Customer name + booking code in a small footer row
 *
 * Used by CustomerPortal — Sprint 7b.
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

interface StatusHeroProps {
  status: BookingStatus;
  customerName: string;
  bookingCode: string;
  /** ISO YYYY-MM-DD */
  pickupDate?: string;
  /** "HH:MM" 24h */
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
}

interface HeroConfig {
  label: string;
  headline: string;
  icon: typeof Clock;
  fg: string;
  bg: string;
  borderRgba: string;
}

const CONFIGS: Record<BookingStatus, HeroConfig> = {
  pending_approval: {
    label: 'Pending Approval',
    headline: 'Awaiting Annie’s approval',
    icon: Hourglass,
    fg: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    borderRgba: 'rgba(245,158,11,0.25)',
  },
  approved: {
    label: 'Approved',
    headline: 'You’re approved — see you soon',
    icon: CheckCircle2,
    fg: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    borderRgba: 'rgba(59,130,246,0.22)',
  },
  confirmed: {
    label: 'Confirmed',
    headline: 'You’re confirmed — see you soon',
    icon: CheckCircle2,
    fg: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    borderRgba: 'rgba(59,130,246,0.22)',
  },
  ready_for_pickup: {
    label: 'Ready for Pickup',
    headline: 'Your ride is ready',
    icon: Key,
    fg: '#D4AF37',
    bg: 'rgba(212,175,55,0.08)',
    borderRgba: 'rgba(212,175,55,0.28)',
  },
  active: {
    label: 'Active Rental',
    headline: 'You’re on the road',
    icon: Car,
    fg: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    borderRgba: 'rgba(34,197,94,0.22)',
  },
  returned: {
    label: 'Returned',
    headline: 'Inspection in progress',
    icon: Clock,
    fg: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    borderRgba: 'rgba(245,158,11,0.22)',
  },
  completed: {
    label: 'Trip Complete',
    headline: 'Thanks for renting with Annie’s',
    icon: CheckCircle2,
    fg: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    borderRgba: 'rgba(34,197,94,0.22)',
  },
  cancelled: {
    label: 'Cancelled',
    headline: 'This booking was cancelled',
    icon: AlertCircle,
    fg: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    borderRgba: 'rgba(239,68,68,0.22)',
  },
  declined: {
    label: 'Declined',
    headline: 'This booking was declined',
    icon: AlertCircle,
    fg: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    borderRgba: 'rgba(239,68,68,0.22)',
  },
};

function parseBookingTime(date?: string, time?: string): Date | null {
  if (!date) return null;
  try {
    // pickup_time is "HH:MM"; default to noon if missing
    const t = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '12:00';
    return new Date(`${date}T${t}:00`);
  } catch {
    return null;
  }
}

function formatRelative(ms: number, suffix: 'until' | 'ago' | 'in' | 'overdue' = 'in'): string {
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const hRem = hours - days * 24;
    return `${days}d ${hRem}h ${suffix === 'in' ? '' : suffix}`.trim();
  }
  if (hours > 0) {
    const mRem = minutes - hours * 60;
    return `${hours}h ${mRem}m ${suffix === 'in' ? '' : suffix}`.trim();
  }
  if (minutes > 0) return `${minutes}m ${suffix === 'in' ? '' : suffix}`.trim();
  return suffix === 'overdue' ? 'just now' : 'any minute';
}

/** Compute the timer copy for the current state. */
function useCountdownCopy({
  status,
  pickupDate,
  pickupTime,
  returnDate,
  returnTime,
}: {
  status: BookingStatus;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Update every 30s for accuracy without burning a render budget.
    // Only relevant for states that show a live countdown.
    if (!['ready_for_pickup', 'active', 'pending_approval'].includes(status)) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [status]);

  const pickup = parseBookingTime(pickupDate, pickupTime);
  const ret = parseBookingTime(returnDate, returnTime);

  switch (status) {
    case 'pending_approval':
      return { label: 'Annie typically responds within 30 minutes', tone: 'neutral' as const };
    case 'approved':
    case 'confirmed': {
      if (!pickup) return { label: 'Pickup details coming soon', tone: 'neutral' as const };
      const dt = pickup.getTime() - now;
      if (dt > 0) return { label: `Pickup ${formatRelative(dt, 'in')}`, tone: 'accent' as const };
      return { label: 'Pickup time has arrived', tone: 'success' as const };
    }
    case 'ready_for_pickup': {
      if (!pickup) return { label: 'Your vehicle is ready', tone: 'accent' as const };
      const dt = pickup.getTime() - now;
      if (dt > 60 * 60_000) return { label: `Pickup ${formatRelative(dt, 'in')}`, tone: 'accent' as const };
      if (dt > 0) return { label: `Pickup ${formatRelative(dt, 'in')} — head over`, tone: 'success' as const };
      return { label: 'Available now — check in below', tone: 'success' as const };
    }
    case 'active': {
      if (!ret) return { label: 'Enjoy your ride', tone: 'success' as const };
      const dt = ret.getTime() - now;
      if (dt > 24 * 60 * 60_000) return { label: `Return ${formatRelative(dt, 'in')}`, tone: 'success' as const };
      if (dt > 0) return { label: `Return ${formatRelative(dt, 'in')}`, tone: 'accent' as const };
      return { label: `Overdue by ${formatRelative(-dt, 'overdue')}`, tone: 'warning' as const };
    }
    case 'returned':
      return { label: 'Settlement complete within ~24 hours', tone: 'neutral' as const };
    case 'completed':
      return { label: 'Leave a review below — it helps a lot', tone: 'success' as const };
    case 'cancelled':
    case 'declined':
      return { label: 'Contact Annie if this is unexpected', tone: 'neutral' as const };
  }
}

export default function StatusHero({
  status,
  customerName,
  bookingCode,
  pickupDate,
  pickupTime,
  returnDate,
  returnTime,
}: StatusHeroProps) {
  const cfg = CONFIGS[status] ?? CONFIGS.pending_approval;
  const Icon = cfg.icon;
  const timer = useCountdownCopy({ status, pickupDate, pickupTime, returnDate, returnTime });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE.dramatic }}
      className="rounded-3xl p-6 sm:p-7"
      style={{
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.borderRgba}`,
      }}
    >
      {/* Top row — status pill */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: 'var(--bg-elevated)', color: cfg.fg, border: `1px solid ${cfg.borderRgba}` }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.fg }} />
          {cfg.label}
        </div>
      </div>

      {/* Headline + icon */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <h1
          className="text-2xl sm:text-3xl font-light leading-tight"
          style={{ color: 'var(--text-primary)', textWrap: 'balance' }}
        >
          {cfg.headline}
        </h1>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--bg-elevated)', border: `1px solid ${cfg.borderRgba}` }}
        >
          <Icon size={22} style={{ color: cfg.fg }} />
        </div>
      </div>

      {/* Timer line */}
      <p
        className="text-sm font-medium mb-5"
        style={{
          color:
            timer.tone === 'warning'
              ? '#ef4444'
              : timer.tone === 'accent'
                ? cfg.fg
                : timer.tone === 'success'
                  ? '#15803d'
                  : 'var(--text-secondary)',
        }}
        aria-live="polite"
      >
        {timer.label}
      </p>

      {/* Identity footer */}
      <div
        className="flex items-center justify-between pt-4 text-xs"
        style={{ color: 'var(--text-tertiary)', borderTop: `1px solid ${cfg.borderRgba}` }}
      >
        <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
          {customerName}
        </span>
        <span className="font-mono font-semibold tracking-wider" style={{ color: 'var(--text-primary)' }}>
          {bookingCode}
        </span>
      </div>
    </motion.div>
  );
}
