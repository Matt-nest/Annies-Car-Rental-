import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Car, Users, BookOpen,
  TrendingUp, Settings, X, LogOut, AlertTriangle, CreditCard,
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
  { to: '/settings',         label: 'Settings', icon: Settings },
  { to: '/webhook-failures', label: 'Webhooks', icon: AlertTriangle },
];

function NavItem({ to, label, icon: Icon, end, alertKey, alerts, onClose }) {
  const count = alertKey ? (alerts[alertKey] || 0) : 0;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 relative group"
      style={({ isActive }) => isActive
        ? {
            backgroundColor: 'var(--sidebar-active-bg)',
            color: 'var(--sidebar-active-text)',
          }
        : {
            color: 'var(--sidebar-text)',
          }
      }
      onMouseEnter={e => {
        if (!e.currentTarget.getAttribute('aria-current')) {
          e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
        }
      }}
      onMouseLeave={e => {
        if (!e.currentTarget.getAttribute('aria-current')) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--sidebar-text)';
        }
      }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
              style={{ backgroundColor: 'var(--sidebar-active-text)' }}
            />
          )}
          <Icon
            size={15}
            strokeWidth={isActive ? 2.2 : 1.8}
            style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }}
          />
          <span className="flex-1 truncate">{label}</span>
          {count > 0 && (
            <span
              className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0"
              style={{ backgroundColor: '#ef4444', color: '#fff' }}
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
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
        style={{
          width: '280px',
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center justify-between px-5 h-14 shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#D4AF37' }}
            >
              <Car size={15} color="#0F172A" strokeWidth={2.2} />
            </div>
            <div>
              <p
                className="text-[13px] font-semibold tracking-tight leading-tight"
                style={{ color: 'rgba(255,255,255,0.92)' }}
              >
                Annie's &amp; Co
              </p>
              <p
                className="text-[9px] font-bold uppercase tracking-[0.18em]"
                style={{ color: 'rgba(255,255,255,0.30)' }}
              >
                Admin
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.40)', minWidth: 36, minHeight: 36 }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto no-scrollbar">
          <p
            className="px-3 text-[9px] font-bold uppercase tracking-[0.18em] mb-2"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            Main Menu
          </p>
          <div className="space-y-0.5">
            {MAIN_NAV.map(item => (
              <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} />
            ))}
          </div>

          <div
            className="my-4 mx-3"
            style={{ height: '1px', backgroundColor: 'var(--sidebar-border)' }}
          />

          <p
            className="px-3 text-[9px] font-bold uppercase tracking-[0.18em] mb-2"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            System
          </p>
          <div className="space-y-0.5">
            {SYSTEM_NAV.map(item => (
              <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium w-full transition-all duration-200"
            style={{ color: 'var(--sidebar-text)', minHeight: 40 }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)';
              e.currentTarget.style.color = '#fca5a5';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--sidebar-text)';
            }}
          >
            <LogOut size={15} style={{ opacity: 0.7 }} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
