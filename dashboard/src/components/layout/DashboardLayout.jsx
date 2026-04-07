import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Sun, Moon } from 'lucide-react';
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


  const initials = user?.email?.[0]?.toUpperCase() || 'A';

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 theme-transition">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} alerts={alerts} />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header — matches template: sticky, white bg, border-b, shadow-theme-xs */}
          <header className="sticky top-0 flex w-full bg-white border-b border-gray-200 z-[99999] dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-grow items-center justify-between px-4 py-3 shadow-xs dark:shadow-none sm:px-6 md:justify-end">
              {/* Mobile toggle */}
              <button
                className="z-[99999] flex lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Toggle sidebar"
              >
                <Menu size={24} strokeWidth={1.5} />
              </button>

              {/* Right controls */}
              <div className="flex items-center gap-2">
                {/* Global Search — functional */}
                <GlobalSearch />

                {/* Theme toggle */}
                <button
                  onClick={() => setDark(d => !d)}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
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
                        ? <Sun size={20} className="text-[#00D4AA]" />
                        : <Moon size={20} />
                      }
                    </motion.div>
                  </AnimatePresence>
                </button>

                {/* Notifications */}
                <NotificationDropdown />

                {/* User avatar */}
                <button className="flex items-center gap-3 pl-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 bg-brand-500 text-white">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-700 dark:text-white/90 truncate max-w-[140px]">
                      {user?.email?.split('@')[0] || 'Admin'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
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
