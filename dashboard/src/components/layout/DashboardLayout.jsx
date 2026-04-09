import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, Sun, Moon, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import NotificationDropdown from './NotificationDropdown';
import { useAuth } from '../../auth/AuthProvider';
import { api } from '../../api/client';

export const ThemeContext = createContext({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState({ pending_approvals: 0, pending_agreements: 0 });
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  // ── Sidebar collapse (desktop only, persisted) ──────────────────────────────
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  }

  // ── Theme ───────────────────────────────────────────────────────────────────
  const [dark, setDark] = useState(() => {
    try { const t = localStorage.getItem('dash-theme'); return t ? t === 'dark' : true; } catch { return true; }
  });

  useEffect(() => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
      html.classList.remove('light');
      localStorage.setItem('dash-theme', 'dark');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
      localStorage.setItem('dash-theme', 'light');
    }
    return () => { html.classList.remove('dark', 'light'); };
  }, [dark]);

  // ── Alerts polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadAlerts = () => {
      api.getOverview()
        .then(ov => setAlerts({
          pending_approvals: ov.pending_approvals || 0,
          pending_agreements: ov.pending_agreements || 0,
        }))
        .catch(() => {});
    };
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Profile dropdown dismiss ────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : user?.email?.split('@')[0] || 'Admin';
  const initials = profile
    ? `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'A';
  const roleName = profile?.role || 'User';

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      <div className="flex h-screen overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          alerts={alerts}
          collapsed={collapsed}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <header
            className="sticky top-0 flex w-full z-[99999]"
            style={{
              backgroundColor: 'var(--header-bg)',
              borderBottom: '1px solid var(--border-subtle)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex flex-grow items-center gap-3 px-4 py-3 sm:px-6">
              {/* ── Sidebar toggle button (TailAdmin style) ──────────── */}
              {/* Mobile: opens drawer   •   Desktop: toggles collapse */}
              <button
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setSidebarOpen(true);
                  } else {
                    toggleCollapse();
                  }
                }}
                className="flex items-center justify-center w-10 h-10 rounded-lg border-2 shrink-0 transition-colors"
                style={{
                  borderColor: 'var(--accent-color)',
                  color: 'var(--text-primary)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(70,95,255,0.1)'; e.currentTarget.style.color = 'var(--accent-color)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {/* Three-line hamburger icon (☰) */}
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect y="0" width="16" height="2" rx="1" fill="currentColor" />
                  <rect y="5" width="16" height="2" rx="1" fill="currentColor" />
                  <rect y="10" width="16" height="2" rx="1" fill="currentColor" />
                </svg>
              </button>

              {/* Search bar — fills most of the remaining header space */}
              <div className="flex-1 min-w-0">
                <GlobalSearch />
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                {/* Theme toggle */}
                <button
                  onClick={() => setDark(d => !d)}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={dark ? 'sun' : 'moon'}
                      initial={{ y: -12, opacity: 0, rotate: -45 }}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      exit={{ y: 12, opacity: 0, rotate: 45 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    >
                      {dark
                        ? <Sun size={20} style={{ color: 'var(--accent-color)' }} />
                        : <Moon size={20} />
                      }
                    </motion.div>
                  </AnimatePresence>
                </button>

                {/* Notifications */}
                <NotificationDropdown />

                {/* ─── User profile dropdown ─────────────── */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-3 pl-2 rounded-lg transition-colors py-1 pr-2"
                    style={profileOpen ? { backgroundColor: 'var(--sidebar-active-bg)' } : {}}
                    onMouseEnter={e => { if (!profileOpen) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'; }}
                    onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, #465FFF 0%, #7c3aed 100%)' }}
                    >
                      {initials}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium truncate max-w-[140px]" style={{ color: 'var(--text-primary)' }}>
                        {displayName}
                      </p>
                      <p className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
                        {roleName}
                      </p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`hidden sm:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--text-tertiary)' }}
                    />
                  </button>

                  {/* Dropdown menu */}
                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-[260px] rounded-xl shadow-2xl overflow-hidden z-[999999]"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
                        }}
                      >
                        {/* User info header */}
                        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{displayName}</p>
                          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{profile?.email || user?.email}</p>
                        </div>

                        {/* Menu items */}
                        <div className="py-1.5">
                          <DropdownItem
                            icon={User}
                            label="Edit Profile"
                            onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                          />
                          <DropdownItem
                            icon={Settings}
                            label="Account Settings"
                            onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                          />
                        </div>

                        {/* Sign out */}
                        <div style={{ borderTop: '1px solid var(--border-subtle)' }} className="py-1.5">
                          <DropdownItem
                            icon={LogOut}
                            label="Sign Out"
                            danger
                            onClick={() => { setProfileOpen(false); signOut(); }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto glass-scroll">
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

/* ─── Dropdown menu item ──────────────────────────────── */
function DropdownItem({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-5 py-2.5 text-sm font-medium transition-colors"
      style={{ color: danger ? '#ef4444' : 'var(--text-secondary)' }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = danger ? 'rgba(239,68,68,0.08)' : 'var(--sidebar-hover)';
        if (!danger) e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = danger ? '#ef4444' : 'var(--text-secondary)';
      }}
    >
      <Icon size={18} strokeWidth={1.5} />
      {label}
    </button>
  );
}
