import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Car, Users, BookOpen,
  TrendingUp, Settings, X, LogOut, AlertTriangle, CreditCard
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

const NAV = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bookings',  label: 'Bookings',  icon: BookOpen, alertKey: 'pending_approvals' },
  { to: '/fleet',     label: 'Fleet',     icon: Car },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/calendar',  label: 'Calendar',  icon: Calendar },
  { to: '/payments',  label: 'Payments',  icon: CreditCard },
  { to: '/revenue',          label: 'Revenue',          icon: TrendingUp },
  { to: '/settings',         label: 'Settings',         icon: Settings },
  { to: '/webhook-failures', label: 'Webhook Failures', icon: AlertTriangle },
];

export default function Sidebar({ open, onClose, alerts = {} }) {
  const { signOut } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-60 flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div>
            <p
              className="text-sm font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Annie's Rentals
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Admin</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end, alertKey }) => {
            const count = alertKey ? (alerts[alertKey] || 0) : 0;
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group"
                style={({ isActive }) => isActive
                  ? { backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }
                  : { color: 'var(--text-secondary)' }
                }
                onMouseEnter={e => {
                  if (!e.currentTarget.getAttribute('aria-current')) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.getAttribute('aria-current')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>
                {count > 0 && (
                  <span
                    className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                    style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
                  >
                    {count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all duration-150"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
