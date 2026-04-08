import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, Sun, Moon, CheckCircle2, PenLine } from 'lucide-react';
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
  const { user } = useAuth();
  const [alerts, setAlerts] = useState({ pending_approvals: 0, pending_agreements: 0 });
  const navigate = useNavigate();

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
    // Re-poll every 30s so chips update after approve/sign
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);


  const initials = user?.email?.[0]?.toUpperCase() || 'A';

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      <div className="flex h-screen overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} alerts={alerts} />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header — matches template: sticky, white bg, border-b, shadow-theme-xs */}
          <header className="sticky top-0 flex w-full z-[99999]" style={{ backgroundColor: 'var(--header-bg)', borderBottom: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <div className="flex flex-grow items-center justify-between px-4 py-3 sm:px-6 md:justify-end">
              {/* Mobile toggle */}
              <button
                className="z-[99999] flex lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Toggle sidebar"
              >
                <Menu size={24} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
              </button>

              {/* Right controls */}
              <div className="flex items-center gap-2">
                {/* Global Search — functional */}
                <GlobalSearch />

                {/* Glowing action buttons */}
                <AnimatePresence>
                  {alerts.pending_approvals > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                      style={{
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        color: '#F59E0B',
                        animation: 'pulseYellow 2s ease-in-out infinite',
                      }}
                      onClick={() => {
                        navigate('/');
                        setTimeout(() => {
                          const el = document.querySelector('[data-widget="pending-approvals"]');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 300);
                      }}
                    >
                      <CheckCircle2 size={12} />
                      <span className="font-bold">{alerts.pending_approvals}</span>
                      <span className="hidden sm:inline">Approve</span>
                    </motion.button>
                  )}
                  {alerts.pending_agreements > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                      style={{
                        background: 'rgba(0,122,255,0.12)',
                        border: '1px solid rgba(0,122,255,0.2)',
                        color: '#007AFF',
                        animation: 'pulseBlue 2s ease-in-out infinite',
                      }}
                      onClick={() => {
                        navigate('/');
                        setTimeout(() => {
                          const el = document.querySelector('[data-widget="pending-counter-sign"]');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 300);
                      }}
                    >
                      <PenLine size={12} />
                      <span className="font-bold">{alerts.pending_agreements}</span>
                      <span className="hidden sm:inline">Counter-Sign</span>
                    </motion.button>
                  )}
                </AnimatePresence>

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

                {/* User avatar */}
                <button className="flex items-center gap-3 pl-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}>
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium truncate max-w-[140px]" style={{ color: 'var(--text-primary)' }}>
                      {user?.email?.split('@')[0] || 'Admin'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Owner
                    </p>
                  </div>
                </button>
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
