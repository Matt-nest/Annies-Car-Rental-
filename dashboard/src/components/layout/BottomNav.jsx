import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Car,
  Users,
  Menu,
} from 'lucide-react';
import { useAlerts } from '../../lib/alertsContext';
import { haptic } from '../../lib/haptic';

/**
 * Mobile bottom navigation — `lg:hidden` so it only shows below 1024px.
 *
 * Design decisions:
 * - 5 slots total (research max: 5; >5 reads as a toolbar, not nav).
 * - 4 destinations + 1 "More" that opens the existing Sidebar drawer so
 *   admins still reach Calendar / Telematics / Revenue / Settings / etc.
 * - Reuses Sidebar's icons so visual recognition transfers when admins
 *   switch between phone and desktop.
 * - Safe-area-bottom padding via `.safe-bottom` utility from globals.css
 *   so the bar lands above the iOS home indicator.
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
  { to: '/',          label: 'Home',      icon: LayoutDashboard, end: true },
  { to: '/bookings',  label: 'Bookings',  icon: BookOpen, alertKey: 'pending_approvals' },
  { to: '/fleet',     label: 'Fleet',     icon: Car },
  { to: '/customers', label: 'Clients',   icon: Users },
];

function BottomNavItem({ to, label, icon: Icon, end, alertKey, alerts }) {
  const count = alertKey ? (alerts[alertKey] || 0) : 0;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => haptic('tap')}
      className={({ isActive }) =>
        `tap-target flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-[color,transform] duration-150 active:scale-[0.92] ${
          isActive
            ? 'text-[var(--sidebar-active-text)]'
            : 'text-[var(--text-tertiary)]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon
              size={22}
              strokeWidth={isActive ? 2.2 : 1.8}
              style={{ color: isActive ? 'var(--sidebar-active-icon)' : 'var(--text-tertiary)' }}
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
            className="text-[10px] font-semibold tracking-wide"
            style={{ color: isActive ? 'var(--sidebar-active-text)' : 'var(--text-tertiary)' }}
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
    <nav
      aria-label="Primary navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-[100] safe-bottom"
      style={{
        backgroundColor: 'var(--header-bg)',
        borderTop: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-stretch">
        {PRIMARY_ITEMS.map((item) => (
          <BottomNavItem key={item.to} {...item} alerts={alerts} />
        ))}
        <button
          type="button"
          onClick={() => { haptic('tap'); onOpenMore(); }}
          aria-label="Open full navigation menu"
          className="tap-target flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-[color,transform] duration-150 active:scale-[0.92]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <Menu size={22} strokeWidth={1.8} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-[10px] font-semibold tracking-wide">More</span>
        </button>
      </div>
    </nav>
  );
}
