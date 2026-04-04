import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Car, Users, BookOpen,
  TrendingUp, Settings, X, LogOut, AlertTriangle, CreditCard
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

const MAIN_NAV = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bookings',  label: 'Bookings',  icon: BookOpen, alertKey: 'pending_approvals' },
  { to: '/fleet',     label: 'Fleet',     icon: Car },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/calendar',  label: 'Calendar',  icon: Calendar },
  { to: '/payments',  label: 'Payments',  icon: CreditCard },
  { to: '/revenue',   label: 'Revenue',   icon: TrendingUp },
];

const SYSTEM_NAV = [
  { to: '/settings',         label: 'Settings',  icon: Settings },
  { to: '/webhook-failures', label: 'Webhooks',  icon: AlertTriangle },
];

function NavItem({ to, label, icon: Icon, end, alertKey, alerts, onClose }) {
  const count = alertKey ? (alerts[alertKey] || 0) : 0;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      className="nav-link flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group relative"
      style={({ isActive }) => isActive
        ? {
            backgroundColor: 'var(--bg-card-hover)',
            color: 'var(--text-primary)',
          }
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
      {({ isActive }) => (
        <>
          {isActive && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
              style={{ backgroundColor: 'var(--accent-color)' }}
            />
          )}
          <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
          <span className="flex-1">{label}</span>
          {count > 0 && (
            <span
              className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
              style={{ backgroundColor: 'var(--danger-color)', color: '#ffffff' }}
            >
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

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
          fixed inset-y-0 left-0 z-40 w-56 flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        {/* Brand Header */}
        <div
          className="flex items-center justify-between px-4 h-14"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              <Car className="text-white" size={16} />
            </div>
            <div>
              <p
                className="text-[13px] font-semibold tracking-tight leading-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                Annie's <span className="serif-accent">&</span> Co
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--text-tertiary)' }}>
                Admin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)', minWidth: 36, minHeight: 36 }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto glass-scroll">
          <p
            className="px-3 text-[9px] font-bold uppercase tracking-[0.15em] mb-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Main Menu
          </p>
          <div className="space-y-0.5">
            {MAIN_NAV.map(item => (
              <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} />
            ))}
          </div>

          <p
            className="px-3 text-[9px] font-bold uppercase tracking-[0.15em] mb-2 mt-6"
            style={{ color: 'var(--text-tertiary)' }}
          >
            System
          </p>
          <div className="space-y-0.5">
            {SYSTEM_NAV.map(item => (
              <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} />
            ))}
          </div>
        </nav>

        {/* Sign out */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium w-full transition-all duration-200"
            style={{ color: 'var(--text-tertiary)', minHeight: 40 }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--danger-glow)';
              e.currentTarget.style.color = 'var(--danger-color)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
