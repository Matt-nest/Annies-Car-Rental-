import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Bell, Sun, Moon } from 'lucide-react';
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

  // Apply both .dark and .light classes so CSS vars resolve correctly
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
    // Cleanup on unmount — remove dashboard theme classes
    return () => {
      html.classList.remove('dark', 'light');
    };
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
      <div
        className="flex h-screen overflow-hidden theme-transition"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} alerts={alerts} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header
            className="px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 border-b"
            style={{
              backgroundColor: 'var(--header-bg)',
              borderColor: 'var(--border-subtle)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl -ml-2 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="hidden lg:block" />

            <div className="flex items-center gap-1.5">
              {/* Dark mode toggle */}
              <button
                onClick={() => setDark(d => !d)}
                className="p-2 rounded-xl transition-all duration-200"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              <button
                className="p-2 rounded-xl transition-all duration-200"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                aria-label="Notifications"
              >
                <Bell size={17} />
              </button>

              <div
                className="flex items-center gap-2.5 pl-2 ml-1 border-l"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  {user?.email?.[0]?.toUpperCase() || 'A'}
                </div>
                <span
                  className="hidden sm:block text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {user?.email}
                </span>
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
