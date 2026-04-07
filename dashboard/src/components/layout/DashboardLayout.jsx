import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Bell, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { useAuth } from '../../auth/AuthProvider';
import { api } from '../../api/client';

export const ThemeContext = createContext({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const [alerts, setAlerts] = useState({ pending_approvals: 0, pending_agreements: 0 });

  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('dash-theme') === 'dark'; } catch { return false; }
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

  useEffect(() => {
    api.getOverview()
      .then(ov => setAlerts({
        pending_approvals: ov.pending_approvals || 0,
        pending_agreements: ov.pending_agreements || 0,
      }))
      .catch(() => {});
  }, []);

  const totalAlerts = alerts.pending_approvals + alerts.pending_agreements;
  const initials = user?.email?.[0]?.toUpperCase() || 'A';

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      <div
        className="flex h-screen overflow-hidden theme-transition"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} alerts={alerts} />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <header
            className="flex items-center justify-between px-5 sm:px-6 shrink-0"
            style={{
              height: '56px',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--header-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center justify-center rounded-lg transition-colors -ml-1"
              style={{
                width: 36, height: 36,
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            <div className="hidden lg:block" />

            {/* Right controls */}
            <div className="flex items-center gap-1">
              {/* Theme toggle */}
              <button
                onClick={() => setDark(d => !d)}
                className="flex items-center justify-center rounded-lg transition-colors"
                style={{ width: 36, height: 36, color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
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
                      ? <Sun size={16} style={{ color: 'var(--accent-color)' }} />
                      : <Moon size={16} />
                    }
                  </motion.div>
                </AnimatePresence>
              </button>

              {/* Notifications */}
              <button
                className="flex items-center justify-center rounded-lg transition-colors relative"
                style={{ width: 36, height: 36, color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Notifications"
              >
                <Bell size={16} />
                {totalAlerts > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full pulse-dot"
                    style={{ backgroundColor: '#ef4444' }}
                  />
                )}
              </button>

              {/* User */}
              <div
                className="flex items-center gap-2.5 pl-3 ml-1"
                style={{ borderLeft: '1px solid var(--border-subtle)' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #1E3A5F, #3f72a2)',
                    color: '#FFFFFF',
                  }}
                >
                  {initials}
                </div>
                <span
                  className="hidden sm:block text-sm font-medium truncate max-w-[160px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {user?.email}
                </span>
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
