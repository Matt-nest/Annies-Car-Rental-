import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  CreditCard,
  ClipboardCheck,
  Menu,
} from 'lucide-react';
import { useAlerts } from '../../lib/alertsContext';
import { haptic } from '../../lib/haptic';
import { SPRING_NATURAL } from '../../lib/animation';

/**
 * Mobile bottom navigation — `lg:hidden` so it only shows below 1024px.
 *
 * Design decisions:
 * - 5 slots total (research max: 5; >5 reads as a toolbar, not nav).
 * - 4 destinations + 1 "More" that opens the existing Sidebar drawer so
 *   admins still reach Calendar / Telematics / Revenue / Settings / etc.
 * - Reuses Sidebar's icons so visual recognition transfers when admins
 *   switch between phone and desktop.
 * - The tab bar consumes the iOS home-indicator safe area instead of floating
 *   above it. In Safari/Home Screen PWAs, floating fixed bars can leave a
 *   solid slab underneath and jump while the browser chrome settles.
 * - Tap targets are 56×64 px (well above the 44 px WCAG AAA minimum) —
 *   the spec for native mobile nav per Material Design 3 + iOS HIG.
 * - Active state pulls from react-router's NavLink rather than tracking
 *   manually, so deep-linked routes (e.g. /bookings/:id) light the parent.
 *
 * NOTE: The `Sidebar` still renders separately. On mobile it acts as a
 * full-height overlay drawer (existing behavior); this BottomNav simply
 * gives one-thumb access to the 4 most-used routes without opening the
 * drawer each time.
 */

const PRIMARY_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/bookings', label: 'Bookings', icon: BookOpen, alertKey: 'pending_approvals' },
  { to: '/check-ins', label: 'Check-Ins', icon: ClipboardCheck, alertKey: 'pickups_today_count' },
  { to: '/payments', label: 'Money', icon: CreditCard, alertKey: 'pending_deposit_reviews' },
];

function BottomNavItem({
  to, label, icon: Icon, end, alertKey, alerts,
}) {
  const count = alertKey ? (alerts[alertKey] || 0) : 0;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => haptic('tap')}
      className={({ isActive }) =>
        `tap-target relative flex-1 flex flex-col items-center justify-center gap-1 py-2 h-[var(--app-bottomnav-content-h)] transition-[color,transform] duration-150 active:scale-[0.92] ${
          isActive
            ? 'text-[var(--sidebar-active-text)]'
            : 'text-[var(--text-tertiary)]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Animated active-indicator pill — `layoutId` makes Framer Motion
              slide the SAME element between BottomNav slots when the active
              tab changes, with a spring physics curve. That's the native
              iOS tab-bar active-state animation in 5 lines of code. */}
          {isActive && (
            <motion.div
              layoutId="bottomnav-active-pill"
              className="absolute inset-x-1 top-1 bottom-1 rounded-2xl -z-10"
              style={{ backgroundColor: 'var(--sidebar-active-bg)' }}
              transition={SPRING_NATURAL}
            />
          )}
          <span className="relative">
            <Icon
              size={23}
              strokeWidth={isActive ? 2.4 : 2}
              style={{ color: isActive ? 'var(--sidebar-active-icon)' : 'var(--text-secondary)' }}
            />
            {count > 0 && (
              <span
                aria-label={`${count} alert${count > 1 ? 's' : ''}`}
                className="absolute -top-1 -right-2 text-[10px] font-bold rounded-full flex items-center justify-center bg-red-500 text-white min-w-[16px] h-[16px] px-1"
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </span>
          <span
            className="text-[11px] font-semibold tracking-wide"
            style={{ color: isActive ? 'var(--sidebar-active-text)' : 'var(--text-secondary)' }}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export default function BottomNav({ onOpenMore }) {
  const { alerts } = useAlerts();

  return (
    // Docked rail: it owns the bottom safe area so iOS Home Screen/Safari
    // doesn't render a separate slab under the navigation.
    <div
      aria-hidden={false}
      className="lg:hidden fixed inset-x-0 bottom-0 z-[100] flex justify-center pointer-events-none mobile-tabbar-root"
    >
      <nav
        aria-label="Primary navigation"
        className={[
          'pointer-events-auto w-full flex items-start overflow-hidden',
          'origin-bottom transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'bg-[rgba(238,243,248,0.94)] dark:bg-[rgba(17,25,40,0.92)]',
          'border-t border-black/[0.06] dark:border-white/10',
          'scale-100',
        ].join(' ')}
        style={{
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow: '0 -8px 32px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.14)',
          height: 'var(--app-bottomnav-h)',
          paddingBottom: 'var(--app-bottomnav-safe-bottom)',
          willChange: 'transform',
        }}
      >
        {PRIMARY_ITEMS.map((item) => (
          <BottomNavItem key={item.to} {...item} alerts={alerts} />
        ))}
        <button
          type="button"
          onClick={() => { haptic('tap'); onOpenMore(); }}
          aria-label="Open full navigation menu"
          className="tap-target flex-1 flex flex-col items-center justify-center gap-1 py-2 h-[var(--app-bottomnav-content-h)] transition-[color,transform] duration-150 active:scale-[0.88]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Menu size={23} strokeWidth={2} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-[11px] font-semibold tracking-wide">More</span>
        </button>
      </nav>
    </div>
  );
}
