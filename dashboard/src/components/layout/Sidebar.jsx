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

/* ─── Shared nav content (used by both the rail sidebar and hover overlay) ── */
function NavContent({ alerts, onClose, showLabels, isAdminOrOwner, isExpanded, profile, initials, signOut }) {
  return (
    <>
      {/* Navigation */}
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            {/* Main menu */}
            <div>
              {showLabels && (
                <h3 className="section-label mb-3 ml-4" style={{
                  transition: 'opacity 0.3s ease',
                }}>
                  Menu
                </h3>
              )}
              {!showLabels && <div className="hidden lg:block h-2" />}
              <ul className="flex flex-col gap-0.5">
                {MAIN_NAV.map(item => (
                  <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} showLabels={showLabels} />
                ))}
              </ul>
            </div>

            {/* System — owner/admin only */}
            {isAdminOrOwner && (
            <div>
              {showLabels && (
                <h3 className="section-label mb-4 ml-4" style={{
                  transition: 'opacity 0.3s ease',
                }}>
                  System
                </h3>
              )}
              <ul className="flex flex-col gap-0.5">
                {SYSTEM_NAV.map(item => (
                  <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} showLabels={showLabels} />
                ))}
              </ul>
            </div>
            )}

            {/* Settings */}
            <div>
              {showLabels && <div className="border-t border-[var(--sidebar-border)] my-1" />}
              <ul className="flex flex-col gap-0.5">
                <NavItem {...SETTINGS_NAV} alerts={alerts} onClose={onClose} showLabels={showLabels} />
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
            title={!showLabels ? `${profile.first_name} ${profile.last_name}` : undefined}
            className={`flex items-center gap-3 py-2 rounded-lg transition-colors hover:bg-[var(--sidebar-active-bg)] ${
              showLabels ? 'px-4' : 'lg:justify-center lg:px-1 px-4'
            }`}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #465FFF, #7c3aed)' }}
            >
              {initials}
            </div>
            {showLabels && (
              <div className="min-w-0" style={{ transition: 'opacity 0.3s ease' }}>
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
          title={!showLabels ? 'Sign out' : undefined}
          className={`group relative flex items-center w-full gap-3 py-2.5 font-medium rounded-lg text-sm transition-colors ${
            showLabels ? 'px-4' : 'lg:justify-center lg:px-1 px-4'
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
          {showLabels && <span>Sign out</span>}
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SIDEBAR — TailAdmin-style layout behavior
   - ALWAYS in flex flow (relative positioned) so content resizes with it
   - pinned=true: 260px wide, full expanded view
   - pinned=false: 72px wide rail, hover triggers overlay panel
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function Sidebar({ open, onClose, alerts = {}, pinned }) {
  const { signOut, profile } = useAuth();
  const isAdminOrOwner = profile?.role === 'owner' || profile?.role === 'admin';
  const initials = `${(profile?.first_name || '?')[0]}${(profile?.last_name || '')[0] || ''}`.toUpperCase();

  // Hover-to-expand state (only matters when not pinned)
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimeout = useRef(null);

  function handleMouseEnter() {
    if (pinned) return;
    clearTimeout(hoverTimeout.current);
    setHoverExpanded(true);
  }

  function handleMouseLeave() {
    if (pinned) return;
    hoverTimeout.current = setTimeout(() => setHoverExpanded(false), 200);
  }

  // Shared props for NavContent
  const navProps = { alerts, onClose, isAdminOrOwner, profile, initials, signOut };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* ─── Main sidebar element — ALWAYS relative in flex flow on desktop ─── */}
      <aside
        data-sidebar
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 h-screen
          border-r z-[99999] lg:z-[999]
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:flex lg:relative lg:shrink-0
        `}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          // Mobile: always 260px
          width: 260,
          paddingLeft: 20,
          paddingRight: 20,
          transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1), padding 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Responsive override for desktop width based on pinned state */}
        <style>{`
          @media (min-width: 1024px) {
            aside[data-sidebar] {
              width: ${pinned ? 260 : 72}px !important;
              padding-left: ${pinned ? '20px' : '8px'} !important;
              padding-right: ${pinned ? '20px' : '8px'} !important;
            }
          }
        `}</style>

        {/* Logo area — only show when pinned (expanded) or on mobile drawer */}
        {pinned && (
          <div className="hidden lg:flex items-center justify-between py-8 px-3">
            <NavLink
              to="/"
              onClick={onClose}
              className="relative block flex-1 transition-all duration-300 hover:opacity-75"
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
          </div>
        )}

        {/* Mobile logo — always show in drawer */}
        <div className="lg:hidden flex items-center justify-between py-8 px-3">
          <NavLink
            to="/"
            onClick={onClose}
            className="relative block flex-1 transition-all duration-300 hover:opacity-75"
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
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--sidebar-text-muted)' }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Collapsed icon — only on desktop when unpinned */}
        {!pinned && (
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

        {/* Nav content (in-flow, responds to sidebar width) */}
        <NavContent
          {...navProps}
          showLabels={pinned}
          isExpanded={pinned}
        />
      </aside>

      {/* ─── Hover overlay — fixed panel that appears when hovering collapsed rail ─── */}
      {/* This does NOT affect layout — it's purely visual */}
      {!pinned && hoverExpanded && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="hidden lg:flex flex-col fixed left-0 z-[998]"
          style={{
            top: 0,
            height: '100vh',
            width: 260,
            paddingLeft: 20,
            paddingRight: 20,
            backgroundColor: 'var(--sidebar-bg)',
            borderRight: '1px solid var(--sidebar-border)',
            boxShadow: '8px 0 32px rgba(0,0,0,0.25)',
            animation: 'sidebarSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
        >
          {/* Overlay logo */}
          <div className="flex items-center justify-between py-8 px-3">
            <NavLink
              to="/"
              onClick={onClose}
              className="relative block flex-1 transition-all duration-300 hover:opacity-75"
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
          </div>

          {/* Full nav in overlay */}
          <NavContent
            {...navProps}
            showLabels={true}
            isExpanded={true}
          />
        </div>
      )}

      {/* Slide-in animation for hover overlay */}
      <style>{`
        @keyframes sidebarSlideIn {
          from {
            opacity: 0;
            transform: translateX(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
