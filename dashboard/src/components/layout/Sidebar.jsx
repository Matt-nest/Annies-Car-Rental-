import { useState, useRef } from 'react';
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
  { to: '/webhook-failures', label: 'Webhooks', icon: AlertTriangle },
];

const SETTINGS_NAV = { to: '/settings', label: 'Settings', icon: Settings };

/* ─── Nav item with magnify hover effect ──────────────────────────────────── */
function NavItem({ to, label, icon: Icon, end, alertKey, alerts, onClose, showLabels }) {
  const count = alertKey ? (alerts[alertKey] || 0) : 0;
  const [hovered, setHovered] = useState(false);

  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onClose}
        title={!showLabels ? label : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={({ isActive }) =>
          `group relative flex items-center w-full gap-3 font-medium rounded-lg text-sm transition-all duration-200 ${
            showLabels ? 'px-4 py-2.5' : 'justify-center px-2 py-2.5'
          } ${
            isActive
              ? 'text-[var(--sidebar-active-text)]'
              : 'text-[var(--sidebar-text)] hover:text-[var(--text-primary)]'
          }`
        }
        style={({ isActive }) => ({
          backgroundColor: isActive ? 'var(--sidebar-active-bg)' : undefined,
          // Magnify effect on hover when labels are showing
          ...(showLabels && hovered && !isActive ? {
            transform: 'translateX(4px) scale(1.02)',
            backgroundColor: 'var(--sidebar-hover)',
          } : {}),
          transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        })}
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
              style={{
                color: isActive ? 'var(--sidebar-active-icon)' : undefined,
                // Icon magnify when collapsed and hovered
                transform: !showLabels && hovered ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.2s ease',
              }}
            />
            {showLabels && (
              <span
                className="flex-1 truncate"
                style={{
                  fontWeight: hovered && !isActive ? 600 : undefined,
                  transition: 'font-weight 0.2s ease',
                }}
              >
                {label}
              </span>
            )}
            {count > 0 && (
              <span
                className={`text-[10px] font-bold rounded-full flex items-center justify-center bg-red-500 text-white shrink-0 ${
                  !showLabels ? 'absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5' : 'min-w-[18px] h-[18px] px-1'
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

/* ═══════════════════════════════════════════════════════════════════════════════
   SIDEBAR
   - pinned=true: always expanded, full width
   - pinned=false: collapsed to 72px icon rail, hover to temporarily expand overlay
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function Sidebar({ open, onClose, alerts = {}, pinned }) {
  const { signOut, profile } = useAuth();
  const isAdminOrOwner = profile?.role === 'owner' || profile?.role === 'admin';
  const initials = `${(profile?.first_name || '?')[0]}${(profile?.last_name || '')[0] || ''}`.toUpperCase();

  // Hover-to-expand state (only matters when not pinned)
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimeout = useRef(null);

  // Determine visual state
  const isExpanded = pinned || hoverExpanded;

  function handleMouseEnter() {
    if (pinned) return; // pinned = always expanded, no hover logic
    clearTimeout(hoverTimeout.current);
    setHoverExpanded(true);
  }

  function handleMouseLeave() {
    if (pinned) return;
    // Small delay before collapsing so cursor can travel across gaps
    hoverTimeout.current = setTimeout(() => setHoverExpanded(false), 200);
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 h-screen
          border-r z-[99999] lg:z-[999]
          w-[260px] px-5
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:flex
          ${pinned
            ? 'lg:relative lg:w-[260px] lg:px-5'
            : hoverExpanded
              ? 'lg:fixed lg:w-[260px] lg:px-5 lg:shadow-2xl'
              : 'lg:fixed lg:w-[72px] lg:px-2'
          }
        `}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1), padding 0.45s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s ease, top 0.3s ease, height 0.3s ease',
          // When unpinned, position sidebar below the header
          ...(!pinned ? { top: 72, height: 'calc(100vh - 72px)' } : {}),
          // When hover-expanding, add elevated shadow for overlay feel
          ...(hoverExpanded && !pinned ? { boxShadow: '8px 0 32px rgba(0,0,0,0.3)' } : {}),
        }}
      >
        {/* Logo area — only show when pinned (full sidebar) or on mobile */}
        {(pinned || open) && (
        <div className={`flex items-center justify-between ${isExpanded ? 'py-8 px-3' : 'py-5 px-2'}`}>
          {/* Full logo — show when expanded */}
          <NavLink
            to="/"
            onClick={onClose}
            className={`relative block transition-all duration-300 hover:opacity-75 ${
              isExpanded ? 'flex-1 opacity-100' : 'lg:hidden flex-1 opacity-100'
            }`}
          >
            <img
              src="/logo-dark.png"
              alt="Annie's & Co"
              className="w-full h-auto object-contain dark:hidden"
              style={{ maxHeight: 160 }}
            />
            <img
              src="/logo-light.png"
              alt="Annie's & Co"
              className="w-full h-auto object-contain hidden dark:block"
              style={{ maxHeight: 160 }}
            />
          </NavLink>

          {/* Collapsed icon (desktop only, when not expanded) */}
          {!isExpanded && (
            <NavLink
              to="/"
              onClick={onClose}
              className="hidden lg:flex mx-auto items-center justify-center transition-opacity duration-200 hover:opacity-75"
            >
              <img
                src="/logo-icon.png"
                alt="Annie's & Co"
                className="w-9 h-9 object-contain"
              />
            </NavLink>
          )}

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'var(--sidebar-text-muted)' }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        )}

        {/* Collapsed icon at top of rail when unpinned */}
        {!pinned && !hoverExpanded && (
          <div className="hidden lg:flex items-center justify-center py-4">
            <NavLink
              to="/"
              onClick={onClose}
              className="flex items-center justify-center transition-all duration-300 hover:opacity-75 hover:scale-110"
            >
              <img
                src="/logo-icon.png"
                alt="Annie's & Co"
                className="w-9 h-9 object-contain"
              />
            </NavLink>
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1">
          <nav className="mb-6">
            <div className="flex flex-col gap-4">
              {/* Main menu */}
              <div>
                {isExpanded && (
                  <h3 className="section-label mb-3 ml-4" style={{
                    opacity: isExpanded ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                  }}>
                    Menu
                  </h3>
                )}
                {!isExpanded && <div className="hidden lg:block h-2" />}
                <ul className="flex flex-col gap-0.5">
                  {MAIN_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} showLabels={isExpanded} />
                  ))}
                </ul>
              </div>

              {/* System — owner/admin only */}
              {isAdminOrOwner && (
              <div>
                {isExpanded && (
                  <h3 className="section-label mb-4 ml-4" style={{
                    opacity: isExpanded ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                  }}>
                    System
                  </h3>
                )}
                <ul className="flex flex-col gap-0.5">
                  {SYSTEM_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} showLabels={isExpanded} />
                  ))}
                </ul>
              </div>
              )}

              {/* Settings */}
              <div>
                {isExpanded && <div className="border-t border-[var(--sidebar-border)] my-1" />}
                <ul className="flex flex-col gap-0.5">
                  <NavItem {...SETTINGS_NAV} alerts={alerts} onClose={onClose} showLabels={isExpanded} />
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* Footer — user info + sign out */}
        <div className="mt-auto py-4 space-y-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          {profile && (
            <NavLink
              to="/settings"
              onClick={onClose}
              title={!isExpanded ? `${profile.first_name} ${profile.last_name}` : undefined}
              className={`flex items-center gap-3 py-2 rounded-lg transition-colors hover:bg-[var(--sidebar-active-bg)] ${
                isExpanded ? 'px-4' : 'lg:justify-center lg:px-1 px-4'
              }`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #465FFF, #7c3aed)' }}
              >
                {initials}
              </div>
              {isExpanded && (
                <div className="min-w-0" style={{ opacity: 1, transition: 'opacity 0.2s ease' }}>
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
            title={!isExpanded ? 'Sign out' : undefined}
            className={`group relative flex items-center w-full gap-3 py-2.5 font-medium rounded-lg text-sm transition-colors ${
              isExpanded ? 'px-4' : 'lg:justify-center lg:px-1 px-4'
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
            {isExpanded && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
