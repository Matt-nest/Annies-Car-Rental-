import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Car, Users, BookOpen,
  TrendingUp, Settings, X, LogOut, AlertTriangle, CreditCard, Landmark, MessageSquare,
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
  { to: '/messaging', label: 'Messaging',  icon: MessageSquare },
];

const SYSTEM_NAV = [
  { to: '/stripe',          label: 'Stripe',   icon: Landmark },
  { to: '/settings',        label: 'Settings',  icon: Settings },
  { to: '/webhook-failures', label: 'Webhooks', icon: AlertTriangle },
];

function NavItem({ to, label, icon: Icon, end, alertKey, alerts, onClose }) {
  const count = alertKey ? (alerts[alertKey] || 0) : 0;

  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onClose}
        className={({ isActive }) =>
          `group relative flex items-center w-full gap-3 px-4 py-2.5 font-medium rounded-lg text-sm transition-all duration-150 ${
            isActive
              ? 'text-[var(--sidebar-active-text)]'
              : 'text-[var(--sidebar-text)] hover:text-[var(--text-primary)]'
          }`
        }
        style={({ isActive }) => isActive ? { backgroundColor: 'var(--sidebar-active-bg)' } : {}}
      >
        {({ isActive }) => (
          <>
            <Icon
              size={20}
              strokeWidth={1.8}
              className={
                isActive
                  ? 'shrink-0'
                  : 'text-[var(--sidebar-text-muted)] group-hover:text-[var(--sidebar-text)] shrink-0'
              }
              style={isActive ? { color: 'var(--sidebar-active-icon)' } : {}}
            />
            <span className="flex-1 truncate">{label}</span>
            {count > 0 && (
              <span className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 bg-red-500 text-white">
                {count}
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}

export default function Sidebar({ open, onClose, alerts = {} }) {
  const { signOut } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 h-screen
          border-r transition-all duration-300 ease-in-out z-[99999] lg:z-[999]
          w-[260px]
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
        }}
      >
        {/* Logo — theme-aware, links home */}
        <div className="flex items-center justify-between px-2 py-5">
          <NavLink to="/" onClick={onClose} className="relative w-full block transition-opacity duration-200 hover:opacity-75">
            {/* Light mode: black text logo */}
            <img
              src="/logo-dark.png"
              alt="Annie's & Co"
              className="w-full h-auto object-contain dark:hidden"
              style={{ maxHeight: 120 }}
            />
            {/* Dark mode: white text logo */}
            <img
              src="/logo-light.png"
              alt="Annie's & Co"
              className="w-full h-auto object-contain hidden dark:block"
              style={{ maxHeight: 120 }}
            />
          </NavLink>

          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'var(--sidebar-text-muted)' }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
          <nav className="mb-6">
            <div className="flex flex-col gap-4">
              {/* Main menu */}
              <div>
                <h3 className="section-label mb-4 ml-4">
                  Menu
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {MAIN_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} />
                  ))}
                </ul>
              </div>

              {/* System */}
              <div>
                <h3 className="section-label mb-4 ml-4">
                  System
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {SYSTEM_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} />
                  ))}
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* Footer — sign out */}
        <div className="mt-auto py-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <button
            onClick={signOut}
            className="group relative flex items-center w-full gap-3 px-4 py-2.5 font-medium rounded-lg text-sm transition-colors"
            style={{ color: 'var(--sidebar-text)' }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)';
              e.currentTarget.style.color = '#EF4444';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--sidebar-text)';
            }}
          >
            <LogOut size={20} strokeWidth={1.8} className="shrink-0" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
