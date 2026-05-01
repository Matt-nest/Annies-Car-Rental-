import { useState, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Car, Users, BookOpen,
  TrendingUp, Settings, X, LogOut, AlertTriangle, CreditCard, Landmark, MessageSquare,
  ArrowUpFromLine, CalendarClock, Star, Percent, Crown, Shield,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

const MAIN_NAV = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bookings',  label: 'Bookings',  icon: BookOpen, alertKey: 'pending_approvals' },
  { to: '/fleet',     label: 'Fleet',     icon: Car },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/calendar',  label: 'Calendar',  icon: Calendar },
  { to: '/check-ins', label: 'Check-Ins',  icon: ArrowUpFromLine },
  { to: '/payments',  label: 'Payments',  icon: CreditCard },
  { to: '/insurance', label: 'Insurance', icon: Shield },
  { to: '/revenue',   label: 'Revenue',   icon: TrendingUp },
  { to: '/messaging', label: 'Messaging',  icon: MessageSquare },
  { to: '/monthly-inquiries', label: 'Monthly Leads', icon: CalendarClock },
  { to: '/reviews',           label: 'Reviews',       icon: Star, alertKey: 'pending_reviews' },
  { to: '/pricing-rules',     label: 'Pricing Rules', icon: Percent },
  { to: '/loyalty',           label: 'Loyalty',       icon: Crown },
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

/* ─── External link nav item (opens in new tab) ──────────────────────────── */
function ExternalNavItem({ href, label, icon: Icon, showLabels }) {
  const [hovered, setHovered] = useState(false);
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={!showLabels ? label : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`group relative flex items-center w-full gap-3 font-medium rounded-lg text-sm transition-all duration-200 text-[var(--sidebar-text)] hover:text-[var(--text-primary)] ${
          showLabels ? 'px-4 py-2.5' : 'justify-center px-2 py-2.5'
        }`}
        style={{
          ...(showLabels && hovered ? {
            transform: 'translateX(4px) scale(1.02)',
            backgroundColor: 'var(--sidebar-hover)',
          } : {}),
          transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
          textDecoration: 'none',
        }}
      >
        <Icon
          size={20}
          strokeWidth={1.8}
          className="text-[var(--sidebar-text-muted)] group-hover:text-[var(--sidebar-text)] shrink-0"
          style={{
            transform: !showLabels && hovered ? 'scale(1.2)' : 'scale(1)',
            transition: 'transform 0.2s ease',
          }}
        />
        {showLabels && <span className="flex-1 truncate">{label}</span>}
      </a>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SIDEBAR — Single element, always in flex flow
   - pinned=true:  260px, expanded, content adjusts
   - pinned=false: 72px collapsed, content adjusts (wider)
   - hover on collapsed: temporarily widens to 260px (content shifts 1:1)
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function Sidebar({ open, onClose, alerts = {}, pinned }) {
  const { signOut, profile } = useAuth();
  const isAdminOrOwner = profile?.role === 'owner' || profile?.role === 'admin';
  const initials = `${(profile?.first_name || '?')[0]}${(profile?.last_name || '')[0] || ''}`.toUpperCase();

  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimeout = useRef(null);

  // Effective visual width state
  const isWide = pinned || hoverExpanded;

  function handleMouseEnter() {
    if (pinned) return;
    clearTimeout(hoverTimeout.current);
    setHoverExpanded(true);
  }

  function handleMouseLeave() {
    if (pinned) return;
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

      {/* ─── ONE sidebar — always lg:relative, width transitions smoothly ─── */}
      <aside
        data-sidebar-rail
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
          // Mobile always 260px; desktop controlled by media query below
          width: 260,
          paddingLeft: 20,
          paddingRight: 20,
          transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1), padding 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Desktop width override via CSS — changes with pinned/hover state */}
        <style>{`
          @media (min-width: 1024px) {
            aside[data-sidebar-rail] {
              width: ${isWide ? 260 : 72}px !important;
              padding-left: ${isWide ? '20px' : '8px'} !important;
              padding-right: ${isWide ? '20px' : '8px'} !important;
            }
          }
        `}</style>
        {/* Marker attribute for CSS targeting */}
        <div style={{ display: 'none' }} />

        {/* ── Logo area ──────────────────────────────────────────────── */}
        <div className={`flex items-center ${isWide ? 'justify-between py-7 px-1' : 'justify-center py-4'}`}
          style={{ transition: 'padding 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          {/* Full logo — visible when wide */}
          <NavLink
            to="/"
            onClick={onClose}
            className="relative block transition-all duration-300 hover:opacity-75"
            style={{
              width: isWide ? '100%' : 0,
              opacity: isWide ? 1 : 0,
              overflow: 'hidden',
              transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
            }}
          >
            <img
              src="/logo-dark.png"
              alt="Annie's & Co"
              className="w-full h-auto object-contain dark:hidden"
              style={{ maxHeight: 140 }}
            />
            <img
              src="/logo-light.png"
              alt="Annie's & Co"
              className="w-full h-auto object-contain hidden dark:block"
              style={{ maxHeight: 140 }}
            />
          </NavLink>

          {/* Small icon — visible when collapsed */}
          <NavLink
            to="/"
            onClick={onClose}
            className="hidden lg:flex items-center justify-center transition-all duration-300 hover:opacity-75 hover:scale-110"
            style={{
              width: isWide ? 0 : 36,
              height: isWide ? 0 : 36,
              opacity: isWide ? 0 : 1,
              overflow: 'hidden',
              transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <img
              src="/logo-icon.png"
              alt="Annie's & Co"
              className="w-9 h-9 object-contain"
            />
          </NavLink>

          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'var(--sidebar-text-muted)' }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <div className="flex flex-col overflow-y-auto no-scrollbar flex-1">
          <nav className="mb-6">
            <div className="flex flex-col gap-4">
              {/* Main menu */}
              <div>
                <h3
                  className="section-label mb-3 ml-4"
                  style={{
                    opacity: isWide ? 1 : 0,
                    height: isWide ? 'auto' : 0,
                    overflow: 'hidden',
                    transition: 'opacity 0.3s ease, height 0.3s ease',
                  }}
                >
                  Menu
                </h3>
                {!isWide && <div className="hidden lg:block h-2" />}
                <ul className="flex flex-col gap-0.5">
                  {MAIN_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} showLabels={isWide} />
                  ))}
                </ul>
              </div>

              {/* System — owner/admin only */}
              {isAdminOrOwner && (
              <div>
                <h3
                  className="section-label mb-4 ml-4"
                  style={{
                    opacity: isWide ? 1 : 0,
                    height: isWide ? 'auto' : 0,
                    overflow: 'hidden',
                    transition: 'opacity 0.3s ease, height 0.3s ease',
                  }}
                >
                  System
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {SYSTEM_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} showLabels={isWide} />
                  ))}
                  <ExternalNavItem
                    href="https://app.crisp.chat"
                    label="Crisp Chat"
                    icon={MessageSquare}
                    showLabels={isWide}
                  />
                </ul>
              </div>
              )}

              {/* Settings */}
              <div>
                {isWide && <div className="border-t border-[var(--sidebar-border)] my-1" />}
                <ul className="flex flex-col gap-0.5">
                  <NavItem {...SETTINGS_NAV} alerts={alerts} onClose={onClose} showLabels={isWide} />
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* ── Footer — user info + sign out ───────────────────────────── */}
        <div className="mt-auto py-4 space-y-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          {profile && (
            <NavLink
              to="/settings"
              onClick={onClose}
              title={!isWide ? `${profile.first_name} ${profile.last_name}` : undefined}
              className={`flex items-center gap-3 py-2 rounded-lg transition-colors hover:bg-[var(--sidebar-active-bg)] ${
                isWide ? 'px-4' : 'lg:justify-center lg:px-1 px-4'
              }`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #465FFF, #7c3aed)' }}
              >
                {initials}
              </div>
              {isWide && (
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
            title={!isWide ? 'Sign out' : undefined}
            className={`group relative flex items-center w-full gap-3 py-2.5 font-medium rounded-lg text-sm transition-colors ${
              isWide ? 'px-4' : 'lg:justify-center lg:px-1 px-4'
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
            {isWide && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
