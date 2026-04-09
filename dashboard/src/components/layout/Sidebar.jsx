import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Car, Users, BookOpen,
  TrendingUp, Settings, X, LogOut, AlertTriangle, CreditCard, Landmark, MessageSquare,
  ChevronsLeft, ChevronsRight,
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
  { to: '/webhook-failures', label: 'Webhooks', icon: AlertTriangle },
];

// Settings always visible
const SETTINGS_NAV = { to: '/settings', label: 'Settings', icon: Settings };

function NavItem({ to, label, icon: Icon, end, alertKey, alerts, onClose, collapsed }) {
  const count = alertKey ? (alerts[alertKey] || 0) : 0;

  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onClose}
        title={collapsed ? label : undefined}
        className={({ isActive }) =>
          `group relative flex items-center w-full gap-3 font-medium rounded-lg text-sm transition-all duration-150 ${
            collapsed ? 'justify-center px-2 py-2.5' : 'px-4 py-2.5'
          } ${
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
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {count > 0 && (
              <span
                className={`text-[10px] font-bold rounded-full flex items-center justify-center bg-red-500 text-white shrink-0 ${
                  collapsed ? 'absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5' : 'min-w-[18px] h-[18px] px-1'
                }`}
              >
                {count}
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}

export default function Sidebar({ open, onClose, alerts = {}, collapsed, onToggleCollapse }) {
  const { signOut, profile } = useAuth();
  const isAdminOrOwner = profile?.role === 'owner' || profile?.role === 'admin';
  const initials = `${(profile?.first_name || '?')[0]}${(profile?.last_name || '')[0] || ''}`.toUpperCase();

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
          fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 h-screen
          border-r transition-all duration-300 ease-in-out z-[99999] lg:z-[999]
          ${collapsed ? 'w-[72px] px-2' : 'w-[260px] px-5'}
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
        }}
      >
        {/* Logo + collapse toggle */}
        <div className={`flex items-center justify-between py-5 ${collapsed ? 'px-0' : 'px-2'}`}>
          {!collapsed ? (
            <NavLink to="/" onClick={onClose} className="relative flex-1 block transition-opacity duration-200 hover:opacity-75">
              <img
                src="/logo-dark.png"
                alt="Annie's & Co"
                className="w-full h-auto object-contain dark:hidden"
                style={{ maxHeight: 120 }}
              />
              <img
                src="/logo-light.png"
                alt="Annie's & Co"
                className="w-full h-auto object-contain hidden dark:block"
                style={{ maxHeight: 120 }}
              />
            </NavLink>
          ) : (
            <NavLink to="/" onClick={onClose} className="mx-auto block transition-opacity duration-200 hover:opacity-75">
              <img
                src="/logo-icon.png"
                alt="Annie's & Co"
                className="w-8 h-8 object-contain"
                onError={e => {
                  // Fallback: show initials circle if icon logo doesn't exist
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div
                className="w-8 h-8 rounded-lg items-center justify-center text-xs font-bold text-white hidden"
                style={{ background: 'linear-gradient(135deg, #465FFF, #7c3aed)' }}
              >
                A
              </div>
            </NavLink>
          )}

          {/* Desktop collapse / mobile close */}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                onClose();
              } else {
                onToggleCollapse();
              }
            }}
            className="p-2 rounded-lg transition-colors shrink-0"
            style={{ color: 'var(--sidebar-text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {/* Mobile: X, Desktop: chevrons */}
            <X size={20} className="lg:hidden" />
            {collapsed
              ? <ChevronsRight size={18} className="hidden lg:block" />
              : <ChevronsLeft size={18} className="hidden lg:block" />
            }
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
          <nav className="mb-6">
            <div className="flex flex-col gap-4">
              {/* Main menu */}
              <div>
                {!collapsed && (
                  <h3 className="section-label mb-4 ml-4">
                    Menu
                  </h3>
                )}
                <ul className="flex flex-col gap-0.5">
                  {MAIN_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} collapsed={collapsed} />
                  ))}
                </ul>
              </div>

              {/* System — Stripe/Webhooks only visible to owner/admin */}
              {isAdminOrOwner && (
              <div>
                {!collapsed && (
                  <h3 className="section-label mb-4 ml-4">
                    System
                  </h3>
                )}
                <ul className="flex flex-col gap-0.5">
                  {SYSTEM_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} collapsed={collapsed} />
                  ))}
                </ul>
              </div>
              )}

              {/* Settings — always visible */}
              <div>
                {!collapsed && <div className="border-t border-[var(--sidebar-border)] my-1" />}
                <ul className="flex flex-col gap-0.5">
                  <NavItem {...SETTINGS_NAV} alerts={alerts} onClose={onClose} collapsed={collapsed} />
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* Footer — user info + sign out */}
        <div className="mt-auto py-4 space-y-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          {/* User profile pill */}
          {profile && (
            <NavLink
              to="/settings"
              onClick={onClose}
              title={collapsed ? `${profile.first_name} ${profile.last_name}` : undefined}
              className={`flex items-center gap-3 py-2 rounded-lg transition-colors hover:bg-[var(--sidebar-active-bg)] ${
                collapsed ? 'justify-center px-1' : 'px-4'
              }`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #465FFF, #7c3aed)' }}
              >
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-text)' }}>
                    {profile.first_name} {profile.last_name}
                  </p>
                  <p className="text-[10px] truncate capitalize" style={{ color: 'var(--sidebar-text-muted)' }}>
                    {profile.role}
                  </p>
                </div>
              )}
            </NavLink>
          )}

          <button
            onClick={signOut}
            title={collapsed ? 'Sign out' : undefined}
            className={`group relative flex items-center w-full gap-3 py-2.5 font-medium rounded-lg text-sm transition-colors ${
              collapsed ? 'justify-center px-1' : 'px-4'
            }`}
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
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  );
}
