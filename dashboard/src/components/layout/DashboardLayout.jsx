import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Bell, Sun, Moon } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../../auth/AuthProvider';
import { api } from '../../api/client';

// Dark mode context so any component can read it
export const ThemeContext = createContext({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const [alerts, setAlerts] = useState({ pending_approvals: 0, pending_agreements: 0 });

  // Persist dark mode in localStorage
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  useEffect(() => {
    api.getOverview()
      .then(ov => setAlerts({
        pending_approvals: ov.pending_approvals || 0,
        pending_agreements: ov.pending_agreements || 0,
      }))
      .catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      <div className="flex h-screen overflow-hidden bg-stone-50 dark:bg-stone-950">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} alerts={alerts} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 -ml-2"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="hidden lg:block" />

            <div className="flex items-center gap-2">
              {/* Dark mode toggle */}
              <button
                onClick={() => setDark(d => !d)}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                aria-label="Notifications"
              >
                <Bell size={18} />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-400 text-sm font-medium">
                  {user?.email?.[0]?.toUpperCase() || 'A'}
                </div>
                <span className="hidden sm:block text-sm text-stone-600 dark:text-stone-400">{user?.email}</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
